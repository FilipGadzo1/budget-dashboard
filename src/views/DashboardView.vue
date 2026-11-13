<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import GettingStarted, { type SetupStep } from '@/components/dashboard/GettingStarted.vue'
import GoalsSnapshot from '@/components/dashboard/GoalsSnapshot.vue'
import NextSteps, { type NextStep } from '@/components/dashboard/NextSteps.vue'
import MonthFlow from '@/components/plan/MonthFlow.vue'
import LineChart, { type ChartSeries } from '@/components/shared/LineChart.vue'
import MoneyFlow from '@/components/shared/MoneyFlow.vue'
import MonthStrip from '@/components/shared/MonthStrip.vue'
import Sparkline from '@/components/shared/Sparkline.vue'
import { useAuth } from '@/composables/useAuth'
import { useCurrency } from '@/composables/useCurrency'
import { useEffectiveProjection } from '@/composables/useEffectiveProjection'
import { useTimeTravel } from '@/composables/useTimeTravel'
import { computeIsOnTrack, computeRequiredMonthly } from '@/services/savingsService'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'
import { useSavingsStore } from '@/stores/savings'

// Overview: the whole plan on one screen. Four headline tiles, the forecast
// beside what needs attention and the savings goals, and a strip of months with
// the monthly split along the bottom. Everything follows the month picked by
// clicking the chart or the month strip (the end of the plan when none is).

const router = useRouter()
const projectionStore = useProjectionStore()
const savingsStore = useSavingsStore()
const collabStore = useCollaborationStore()
const { user } = useAuth()
const { formatCurrency, formatCompactCurrency, formatMoney, locale } = useCurrency()
const {
  rows, summary, milestones, hasSavings, baseTotals,
  hasFocus, focusIdx, focusRow,
} = useEffectiveProjection()
const { focus } = useTimeTravel()

// A short desktop window (a 768px laptop): show one "worth a look" item, not two,
// so the goals keep their space. The matching CSS trims the tiles and the strip.
const SHORT_SCREEN = '(min-width: 1024px) and (max-height: 800px)'
const shortScreen = ref(false)
let shortQuery: MediaQueryList | undefined
const onShortChange = (event: MediaQueryListEvent): void => { shortScreen.value = event.matches }
onMounted(() => {
  if (typeof window.matchMedia !== 'function') return
  shortQuery = window.matchMedia(SHORT_SCREEN)
  shortScreen.value = shortQuery.matches
  shortQuery.addEventListener('change', onShortChange)
})
onBeforeUnmount(() => shortQuery?.removeEventListener('change', onShortChange))

// ── Greeting ────────────────────────────────────────────────────────────────
// On your own budget the page greets you; on a shared one it says whose it is.
const greeting = computed(() => {
  const context = collabStore.activeBudgetContext
  if (context) return `${context.ownerName || context.ownerEmail}'s budget`
  const hour = new Date().getHours()
  const part = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = (user.value?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0]
  return first ? `${part}, ${first}` : part
})

const when = computed(() => {
  const row = focusRow.value
  if (!row) return 'No plan yet'
  return `${hasFocus.value ? 'As of' : 'End of plan,'} ${row.monthLabel} · ${rows.value.length} months`
})

// ── Headline tiles (all for the month being looked at) ──────────────────────
const cash = computed(() => focusRow.value?.cumulativeBalance ?? 0)
const cashChange = computed(() => focusRow.value?.cashChange ?? 0)
const savings = computed(() => focusRow.value?.savingsBalance ?? 0)
// Months of typical spending the cash would cover
const runway = computed(() => (baseTotals.value.expenses > 0 ? Math.max(0, cash.value) / baseTotals.value.expenses : null))

// Typical month: the first month's figures, as elsewhere in the app
const monthlyNet = computed(() => rows.value[0]?.net ?? 0)
const monthlyCashChange = computed(() => rows.value[0]?.cashChange ?? 0)
const monthlyToSavings = computed(() => rows.value[0]?.savingsContribution ?? 0)

const noData = computed(() => summary.value.totalIncome === 0 && summary.value.totalExpenses === 0)

// "Strong" = the plan ends with at least three months of expenses in reserve.
const hasStrongReserve = computed(() => {
  const avgMonthlyExpenses = summary.value.totalExpenses / Math.max(1, rows.value.length)
  return avgMonthlyExpenses > 0 && summary.value.endingBalance >= avgMonthlyExpenses * 3
})

const statusPill = computed(() => {
  if (noData.value) return { label: 'No data', tone: '' }
  if (monthlyNet.value < 0) return { label: 'Deficit', tone: 'status-pill-negative' }
  if (hasStrongReserve.value) return { label: 'Strong', tone: 'status-pill-positive' }
  return { label: 'On track', tone: 'status-pill-positive' }
})

// ── Chart ───────────────────────────────────────────────────────────────────
const series = computed((): ChartSeries[] => [
  { key: 'cash', label: 'Cash', color: 'var(--chart-1)', values: rows.value.map((r) => r.cumulativeBalance), area: true },
  ...(hasSavings.value
    ? [{ key: 'worth', label: 'Net worth', color: 'var(--chart-2)', values: rows.value.map((r) => r.netWorth), dashed: true }]
    : []),
])

// ── First-run guide: stays until the plan has both income and expenses ──────
const setupSteps = computed((): SetupStep[] => [
  { key: 'balance', title: 'Enter your starting balance', description: 'The cash you have today.', to: '/plan', done: (projectionStore.inputs.startingBalance ?? 0) !== 0, optional: true },
  { key: 'income', title: 'Add your income', description: 'One number, or each source separately.', to: '/plan', done: baseTotals.value.income > 0 },
  { key: 'expenses', title: 'Add your expenses', description: 'Monthly bills, plus yearly ones if you like.', to: '/plan', done: baseTotals.value.expenses > 0 },
  { key: 'goal', title: 'Create a savings goal', description: 'See when you will reach it.', to: '/savings', done: savingsStore.goals.length > 0, optional: true },
])
const showSetup = computed(
  () => projectionStore.isReady && !(baseTotals.value.income > 0 && baseTotals.value.expenses > 0),
)

// ── Worth a look: problems first, then things to set up, then the good news ─
const steps = computed((): NextStep[] => {
  if (noData.value) return []
  const list: NextStep[] = []

  if (monthlyNet.value < 0) {
    list.push({ key: 'deficit', tone: 'warning', icon: 'pi pi-exclamation-triangle', title: 'You spend more than you earn', body: `Expenses are ${formatCurrency(-monthlyNet.value)} a month above income.`, to: '/plan', action: 'Review the plan' })
  }
  if (milestones.value.firstNegativeMonthLabel) {
    list.push({ key: 'negative', tone: 'warning', icon: 'pi pi-arrow-down-right', title: `Cash runs out in ${milestones.value.firstNegativeMonthLabel}`, body: 'That is the first month the balance goes below zero.', to: '/forecast', action: 'See the month' })
  }
  if (monthlyNet.value >= 0 && monthlyCashChange.value < 0) {
    list.push({ key: 'oversaving', tone: 'warning', icon: 'pi pi-wallet', title: 'Saving more than you have spare', body: `Savings take ${formatCurrency(-monthlyCashChange.value)} a month more than your surplus.`, to: '/savings', action: 'Adjust the goals' })
  }
  const behind = savingsStore.sortedGoals.find((goal) => goal.status === 'active' && computeIsOnTrack(goal) === false)
  if (behind) {
    const required = computeRequiredMonthly(behind)
    list.push({ key: 'behind', tone: 'warning', icon: 'pi pi-flag', title: `${behind.name} is behind`, body: required !== null ? `It needs ${formatMoney(required, behind.currency)} a month to reach its target date.` : 'At this rate it misses its target date.', to: '/savings', action: 'Open savings' })
  }
  if (!projectionStore.savedScenarios.length && !collabStore.isReadOnly) {
    list.push({ key: 'scenario', tone: 'neutral', icon: 'pi pi-bookmark', title: 'Keep a copy of this plan', body: 'Save it as a scenario, then change things and compare the two.', to: '/scenarios', action: 'Save a scenario' })
  }
  if (monthlyNet.value >= 0) {
    list.push({ key: 'positive', tone: 'positive', icon: 'pi pi-check', title: hasStrongReserve.value ? 'A strong reserve at the end' : 'Income covers your spending', body: hasStrongReserve.value ? 'The plan ends with more than three months of expenses in cash.' : 'Every month ends with something left over.' })
  }
  return list
})
</script>

<template>
  <div class="page">

    <!-- ── Header ────────────────────────────────────────────────── -->
    <header class="page-head">
      <div>
        <div class="dash-title-row">
          <h1 class="page-title">{{ greeting }}</h1>
          <span class="status-pill" :class="statusPill.tone">
            <span class="status-pill-dot" />
            {{ statusPill.label }}
          </span>
        </div>
        <p class="page-description">
          {{ when }}
          <button v-if="hasFocus" class="focus-clear" @click="focus(null)">Back to the end of the plan</button>
        </p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" @click="router.push('/forecast')">
          <i class="pi pi-chart-line text-sm" aria-hidden="true" /> Month by month
        </button>
        <button class="btn btn-primary" @click="router.push('/plan')">
          <i class="pi pi-sliders-h text-sm" aria-hidden="true" /> Edit plan
        </button>
      </div>
    </header>

    <!-- ── First-run guide ────────────────────────────────────────── -->
    <GettingStarted v-if="showSetup" :steps="setupSteps" />

    <template v-if="!noData">
      <!-- ── Headline tiles ───────────────────────────────────────── -->
      <div class="cockpit-tiles">
        <section class="card tile-card">
          <p class="tile-label">Cash</p>
          <p class="tile-value" :class="{ 'text-negative': cash < 0 }"><MoneyFlow :value="cash" /></p>
          <Sparkline :values="rows.map((r) => r.cumulativeBalance)" />
        </section>

        <section class="card tile-card">
          <p class="tile-label">Left that month</p>
          <p class="tile-value" :class="{ 'text-negative': cashChange < 0 }"><MoneyFlow :value="cashChange" signed /></p>
          <p class="tile-note">
            {{ formatCompactCurrency(focusRow?.income ?? 0) }} in, {{ formatCompactCurrency(focusRow?.expenses ?? 0) }} out<template v-if="focusRow?.savingsContribution">, {{ formatCompactCurrency(focusRow.savingsContribution) }} saved</template>
          </p>
        </section>

        <section class="card tile-card">
          <p class="tile-label">Runway</p>
          <p class="tile-value">
            {{ runway === null ? '—' : runway.toFixed(1) }}<span class="tile-unit"> months</span>
          </p>
          <div class="tile-bar" aria-hidden="true"><i :style="{ width: `${Math.min(100, ((runway ?? 0) / 12) * 100)}%` }" /></div>
          <p class="tile-note">of spending covered by cash</p>
        </section>

        <section class="card tile-card">
          <template v-if="hasSavings">
            <p class="tile-label">Savings</p>
            <p class="tile-value"><MoneyFlow :value="savings" /></p>
            <Sparkline :values="rows.map((r) => r.savingsBalance)" color="var(--chart-2)" />
          </template>
          <template v-else>
            <p class="tile-label">Spending a month</p>
            <p class="tile-value"><MoneyFlow :value="baseTotals.expenses" /></p>
            <p class="tile-note">{{ formatCompactCurrency(baseTotals.income) }} comes in</p>
          </template>
        </section>
      </div>

      <!-- ── Forecast beside what needs attention and the goals ────── -->
      <div class="cockpit-mid">
        <section class="card card-col chart-box">
          <LineChart
            :month-keys="rows.map((r) => r.monthKey)"
            :month-labels="rows.map((r) => r.monthLabel)"
            :series="series"
            :format-currency="formatCurrency"
            :format-compact="formatCompactCurrency"
            :locale="locale"
            :focus-index="hasFocus ? focusIdx : null"
            label="Cash over the plan"
            @select="focus"
          />
        </section>

        <div class="cockpit-side">
          <NextSteps v-if="steps.length" compact :steps="steps.slice(0, shortScreen ? 1 : 2)" />
          <GoalsSnapshot />
        </div>
      </div>

      <!-- ── Every month, and how a typical one splits ─────────────── -->
      <div class="cockpit-bot">
        <section class="card card-col">
          <div class="card-head">
            <h2 class="card-title">Every month</h2>
            <span class="strip-hint">darker means more left over</span>
          </div>
          <MonthStrip :rows="rows" :focus-index="focusIdx" :locale="locale" :format-currency="formatCurrency" @select="focus" />
        </section>

        <MonthFlow
          compact
          :income="baseTotals.income"
          :expenses="baseTotals.expenses"
          :to-savings="monthlyToSavings"
          :format-currency="formatCurrency"
        />
      </div>
    </template>

  </div>
</template>

<style scoped>
.dash-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* ─── Tiles ───────────────────────────────────────────────────── */
.cockpit-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--gap);
  flex: none;
}

.tile-card {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding-block: calc(var(--card-pad) * 0.75);
}

.tile-card :deep(.spark) {
  height: 1.25rem;
  margin-top: 0.25rem;
}

.tile-label {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.tile-value {
  margin: 0;
  font-size: clamp(1.5rem, 1.1rem + 0.9vw, 2.125rem);
  font-weight: 620;
  letter-spacing: -0.04em;
  line-height: 1.15;
  color: var(--app-text);
  white-space: nowrap;
}

.tile-unit {
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--app-text-secondary);
}

.tile-note {
  margin: 0;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.tile-bar {
  height: 6px;
  margin: 0.25rem 0;
  border-radius: 3px;
  background: var(--app-surface-hover);
  overflow: hidden;
}

.tile-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--app-accent);
  transition: width 0.3s var(--ease-out);
}

/* Leaves the month picked in a chart or the strip */
.focus-clear {
  margin-left: 0.5rem;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-weight: 550;
  color: var(--app-text);
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

/* ─── Middle and bottom rows ──────────────────────────────────── */
.cockpit-mid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--gap);
}

.cockpit-side {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  min-height: 0;
  /* Whatever happens, the column never spills onto the row below */
  overflow: hidden;
}

/* The goals card takes what is left and scrolls inside */
.cockpit-side > :last-child {
  flex: 1;
  min-height: 0;
}

.cockpit-side > :first-child:not(:last-child) {
  flex: none;
}

.cockpit-bot {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--gap);
  flex: none;
}

.cockpit-bot > .card {
  padding-block: calc(var(--card-pad) * 0.75);
}

.strip-hint {
  font-size: 0.75rem;
  color: var(--app-text-tertiary);
}

/* ─── Short desktop window: keep the essentials, drop the extras ─ */
@media (min-width: 1024px) and (max-height: 800px) {
  .tile-card :deep(.spark),
  .tile-note,
  .tile-bar,
  .strip-hint {
    display: none;
  }

  .tile-value {
    font-size: 1.5rem;
  }

  .cockpit-bot :deep(.flow-legend) {
    display: none;
  }

  /* One line per item, so the goals below keep some room */
  .cockpit-side :deep(.step-body) {
    display: none;
  }
}

/* ─── Phone ───────────────────────────────────────────────────── */
@media (max-width: 1023px) {
  .cockpit-tiles {
    grid-template-columns: 1fr 1fr;
  }

  .cockpit-mid,
  .cockpit-bot {
    display: flex;
    flex-direction: column;
  }

  .cockpit-side > :last-child {
    flex: none;
  }
}
</style>

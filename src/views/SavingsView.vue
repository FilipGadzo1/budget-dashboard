<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { vAutoAnimate } from '@formkit/auto-animate/vue'

import ConfirmDeleteDialog from '@/components/shared/ConfirmDeleteDialog.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import LineChart, { type ChartSeries } from '@/components/shared/LineChart.vue'
import MoneyFlow from '@/components/shared/MoneyFlow.vue'
import DepositDialog from '@/components/savings/DepositDialog.vue'
import SavingsGoalCard from '@/components/savings/SavingsGoalCard.vue'
import SavingsGoalDialog from '@/components/savings/SavingsGoalDialog.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useEffectiveProjection } from '@/composables/useEffectiveProjection'
import { useExchangeRates } from '@/composables/useExchangeRates'
import { useTimeTravel } from '@/composables/useTimeTravel'
import type { SavingsGoal, SavingsGoalStatus } from '@/models'
import { computeProjectedCompletion, computeRequiredMonthly } from '@/services/savingsService'
import { formatShortMonthYear } from '@/utils/date'
import { useCollaborationStore } from '@/stores/collaboration'
import { useSavingsStore } from '@/stores/savings'

const savingsStore = useSavingsStore()
const collabStore = useCollaborationStore()
const { formatCurrency, formatCompactCurrency, formatMoney, formatCompactMoney, toDisplay, currencyCode, locale } = useCurrency()
const { getRate } = useExchangeRates()
const { rows, goalBalances, goalAmountAt, hasFocus, focusIdx, focusRow } = useEffectiveProjection()
const { focus } = useTimeTravel()

const readonly = computed(() => collabStore.isReadOnly)
// Creating and deleting goals is owner-only (enforced by RLS); editors on a shared
// budget can still edit goals and log deposits.
const canManageGoals = computed(() => !collabStore.isViewingSharedBudget)

// ─── Goal dialog (create / edit) ──────────────────────────────────────────────

const showGoalDialog = ref(false)
const editingGoal = ref<SavingsGoal | null>(null)

const openNewGoal = (): void => {
  editingGoal.value = null
  showGoalDialog.value = true
}

// The command palette links here with ?new=1
const route = useRoute()
const router = useRouter()
watch(
  () => route.query.new,
  (flag) => {
    if (!flag) return
    if (canManageGoals.value) openNewGoal()
    void router.replace({ query: {} })
  },
  { immediate: true },
)

const openEditGoal = (goal: SavingsGoal): void => {
  editingGoal.value = goal
  showGoalDialog.value = true
}

const handleGoalSave = async (data: {
  name: string
  emoji: string
  currency: string
  targetAmount: number
  monthlyContribution: number
  targetDate: string | null
  status: SavingsGoalStatus
  note: string | null
  convertAmounts: boolean
}): Promise<void> => {
  const { convertAmounts, currency, ...fields } = data
  const goal = editingGoal.value

  if (!goal) {
    savingsStore.addGoal({ ...fields, currency })
    return
  }

  const from = goal.currency ?? currencyCode.value
  if (currency === from) {
    savingsStore.updateGoal(goal.id, fields)
    return
  }

  if (!convertAmounts) {
    // Relabel: the numbers were in the new currency all along
    savingsStore.updateGoal(goal.id, { ...fields, currency })
    return
  }

  // Convert the saved amount and deposits first, then apply the form's fields
  // (its target and contribution are already in the new currency).
  const rate = getRate(from, currency)
  if (rate === null) return
  await savingsStore.changeGoalCurrency(goal.id, currency, rate)
  savingsStore.updateGoal(goal.id, fields)
}

// ─── Delete dialog ─────────────────────────────────────────────────────────────

const showDeleteDialog = ref(false)
const deleteTargetId = ref<string | null>(null)

const openDelete = (goalId: string): void => {
  deleteTargetId.value = goalId
  showDeleteDialog.value = true
}

const confirmDelete = (): void => {
  if (deleteTargetId.value) {
    savingsStore.deleteGoal(deleteTargetId.value)
  }
  deleteTargetId.value = null
}

// ─── Deposit dialog ────────────────────────────────────────────────────────────

const showDepositDialog = ref(false)
const depositGoal = ref<SavingsGoal | null>(null)

const openDeposit = async (goal: SavingsGoal): Promise<void> => {
  depositGoal.value = goal
  showDepositDialog.value = true
  await savingsStore.loadDeposits(goal.id)
}

const handleDepositSave = async (
  amount: number,
  note: string | null,
  depositDate: string,
): Promise<void> => {
  if (!depositGoal.value) return
  await savingsStore.addDeposit(depositGoal.value.id, { amount, note, depositDate })
  // Sync the ref so the dialog shows the updated goal
  depositGoal.value = savingsStore.goals.find((g) => g.id === depositGoal.value!.id) ?? depositGoal.value
}

const handleDeleteDeposit = async (depositId: string): Promise<void> => {
  if (!depositGoal.value) return
  await savingsStore.removeDeposit(depositId, depositGoal.value.id)
  depositGoal.value = savingsStore.goals.find((g) => g.id === depositGoal.value!.id) ?? depositGoal.value
}

const handleUseRequired = (goal: SavingsGoal): void => {
  const required = computeRequiredMonthly(goal)
  if (required === null) return
  savingsStore.updateGoal(goal.id, { monthlyContribution: required })
}

const depositDeposits = computed(() =>
  depositGoal.value ? (savingsStore.deposits[depositGoal.value.id] ?? []) : [],
)

// ─── Summary strip ─────────────────────────────────────────────────────────────

// Goals can be in different currencies — totals are in the display currency.
const totalSaved = computed(() =>
  savingsStore.goals.reduce((sum, g) => sum + toDisplay(goalAmountAt(g), g.currency), 0),
)
const monthlyAllocated = computed(() =>
  savingsStore.goals
    .filter((g) => g.status === 'active')
    .reduce((sum, g) => sum + toDisplay(g.monthlyContribution, g.currency), 0),
)
const activeGoals = computed(() => savingsStore.goals.filter((g) => g.status === 'active').length)
const totalTarget = computed(() =>
  savingsStore.goals.reduce((sum, g) => sum + toDisplay(g.targetAmount, g.currency), 0),
)
const overallProgress = computed(() =>
  totalTarget.value > 0 ? Math.min(100, Math.round((totalSaved.value / totalTarget.value) * 100)) : 0,
)

// Every goal's balance over the plan, in the display currency, for the chart
const GOAL_HUES = [215, 148, 38, 322, 265, 190, 24, 95]
const goalSeries = computed((): ChartSeries[] =>
  savingsStore.sortedGoals.map((g, i) => ({
    key: g.id,
    label: g.name,
    color: `hsl(${GOAL_HUES[i % GOAL_HUES.length]} 70% 58%)`,
    values: (goalBalances.value[g.id] ?? []).map((amount) => toDisplay(amount, g.currency)),
    area: i === 0,
  })),
)

// Open goals in the order they are projected to finish
const timeline = computed(() =>
  savingsStore.goals
    .filter((g) => g.status === 'active')
    .map((g) => ({ goal: g, key: computeProjectedCompletion(g) }))
    .filter((entry): entry is { goal: SavingsGoal; key: string } => entry.key !== null)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ goal, key }) => ({
      id: goal.id,
      name: goal.name,
      emoji: goal.emoji,
      when: formatShortMonthYear(key, locale.value),
    })),
)
</script>

<template>
  <div class="page">
    <!-- Page header -->
    <header class="page-head">
      <div>
        <h1 class="page-title">Savings</h1>
        <p class="page-description">
          {{ hasFocus && focusRow ? `As of ${focusRow.monthLabel}` : 'Today' }}: what you are saving towards, and what goes in each month.
          <button v-if="hasFocus" class="focus-clear" @click="focus(null)">Back to today</button>
        </p>
      </div>
      <div class="page-actions">
        <button v-if="canManageGoals" class="btn btn-primary" @click="openNewGoal">
          <i class="pi pi-plus" aria-hidden="true" /> New goal
        </button>
      </div>
    </header>

    <div v-if="savingsStore.sortedGoals.length > 0" class="page-body with-rail">
      <div class="stack">
        <!-- Goals: one card each; with many, the grid scrolls and the chart keeps its place -->
        <div v-auto-animate="{ duration: 200 }" class="goal-grid scroll-y" :class="{ 'goal-grid-many': savingsStore.sortedGoals.length > 4 }">
          <SavingsGoalCard
            v-for="goal in savingsStore.sortedGoals"
            :key="goal.id"
            :goal="goal"
            :amount="goalAmountAt(goal)"
            :format-currency="(n: number) => formatMoney(n, goal.currency)"
            :format-compact="(n: number) => formatCompactMoney(n, goal.currency)"
            :locale="locale"
            :readonly="readonly"
            :can-delete="canManageGoals"
            @deposit="openDeposit(goal)"
            @edit="openEditGoal(goal)"
            @delete="openDelete(goal.id)"
            @use-required="handleUseRequired(goal)"
          />
        </div>

        <section class="card card-col grow chart-box" aria-labelledby="savings-chart-title">
          <div class="card-head">
            <h2 id="savings-chart-title" class="card-title">How the goals fill up</h2>
            <span class="savings-total-note">what each goal holds, month by month</span>
          </div>
          <LineChart
            :month-keys="rows.map((r) => r.monthKey)"
            :month-labels="rows.map((r) => r.monthLabel)"
            :series="goalSeries"
            :format-currency="formatCurrency"
            :format-compact="formatCompactCurrency"
            :locale="locale"
            :focus-index="hasFocus ? focusIdx : null"
            label="Savings goals over the plan"
            @select="focus"
          />
        </section>
      </div>

      <!-- Rail: totals and when each goal lands -->
      <aside class="stack scroll-y">
        <section class="card savings-total" aria-label="Savings totals">
          <p class="savings-total-label">Saved {{ hasFocus ? 'by then' : 'so far' }}</p>
          <p class="savings-total-value" :title="formatCurrency(totalSaved)">
            <MoneyFlow :value="totalSaved" />
          </p>
          <div class="savings-total-track" role="img" :aria-label="`${overallProgress}% of all targets`">
            <div class="savings-total-fill bar-grow" :style="{ width: `${overallProgress}%` }" />
          </div>
          <p class="savings-total-note">{{ overallProgress }}% of {{ formatCompactCurrency(totalTarget) }} across all goals</p>

          <dl class="savings-facts">
            <div class="savings-fact">
              <dt>Going in each month</dt>
              <dd :title="`${formatCurrency(monthlyAllocated)} a month`"><MoneyFlow :value="monthlyAllocated" /></dd>
            </div>
            <div class="savings-fact">
              <dt>Active goals</dt>
              <dd>{{ activeGoals }}</dd>
            </div>
          </dl>
        </section>

        <section class="card card-col grow savings-timeline" aria-labelledby="savings-timeline-title">
          <h2 id="savings-timeline-title" class="card-title">When each goal lands</h2>
          <ol v-if="timeline.length" class="savings-timeline-list scroll-y grow">
            <li v-for="entry in timeline" :key="entry.id" class="savings-timeline-row">
              <span class="savings-timeline-when">{{ entry.when }}</span>
              <span class="savings-timeline-name">
                <span aria-hidden="true">{{ entry.emoji }}</span> {{ entry.name }}
              </span>
            </li>
          </ol>
          <p v-else class="savings-total-note">No goal is on its way right now.</p>
          <p v-if="timeline.length" class="savings-total-note">At the current monthly amounts.</p>
        </section>
      </aside>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else-if="!savingsStore.isReady"
      icon="pi-spin pi-spinner"
      title="Loading goals…"
      description=""
    />
    <EmptyState
      v-else
      icon="pi-wallet"
      title="No savings goals yet"
      :description="canManageGoals ? 'Create your first goal to start tracking your savings.' : 'No goals have been created for this budget.'"
      :action-label="canManageGoals ? 'New goal' : ''"
      @action="openNewGoal"
    />
  </div>

  <!-- Dialogs -->
  <SavingsGoalDialog
    v-model:visible="showGoalDialog"
    :goal="editingGoal"
    @save="handleGoalSave"
  />

  <DepositDialog
    v-model:visible="showDepositDialog"
    :goal="depositGoal"
    :deposits="depositDeposits"
    :format-currency="(n: number) => formatMoney(n, depositGoal?.currency)"
    :readonly="readonly"
    @save="handleDepositSave"
    @delete-deposit="handleDeleteDeposit"
  />

  <ConfirmDeleteDialog
    :visible="showDeleteDialog"
    title="Delete goal"
    message="This will permanently delete the goal and all its deposit history."
    @confirm="confirmDelete"
    @update:visible="showDeleteDialog = $event"
  />
</template>

<style scoped>
/* Leaves the month picked in the chart */
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

/* ── Goal cards ──────────────────────────────────────────────── */
.goal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: var(--gap);
  align-content: start;
  flex: none;
}

/* With many goals the cards get a share of the height and scroll inside it */
.goal-grid-many {
  flex: 0 1 auto;
  max-height: 50%;
  padding-right: 0.25rem;
}

/* ── Rail ────────────────────────────────────────────────────── */
.savings-total {
  flex: none;
}

.savings-total-label {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--app-text-secondary);
}

.savings-total-value {
  margin: 0.125rem 0 0.875rem;
  font-size: 2rem;
  font-weight: 620;
  letter-spacing: -0.04em;
  line-height: 1.1;
  color: var(--app-text);
}

/* Savings is --chart-2 everywhere */
.savings-total-track {
  height: 8px;
  border-radius: 4px;
  background: var(--app-surface-hover);
  overflow: hidden;
}

.savings-total-fill {
  height: 100%;
  border-radius: 4px;
  background: var(--chart-2);
  transition: width 0.4s ease;
}

.savings-total-note {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.card-head .savings-total-note {
  margin: 0;
}

.savings-facts {
  display: flex;
  flex-direction: column;
  margin: 1rem 0 0;
  border-top: 1px solid var(--app-border);
}

.savings-fact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--app-border);
}

.savings-fact:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.savings-fact dt {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.savings-fact dd {
  margin: 0;
  font-size: 1rem;
  font-weight: 550;
  color: var(--app-text);
}

.savings-timeline {
  min-height: 7rem;
}

.savings-timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.savings-timeline-row {
  display: flex;
  align-items: baseline;
  gap: 0.875rem;
  font-size: 0.875rem;
}

.savings-timeline-when {
  flex-shrink: 0;
  width: 4.75rem;
  color: var(--app-text-secondary);
}

.savings-timeline-name {
  min-width: 0;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 1023px) {
  .goal-grid-many {
    max-height: none;
  }
}
</style>

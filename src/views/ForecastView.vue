<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import ProjectionTable from '@/components/projections/ProjectionTable.vue'
import DatePickerField from '@/components/shared/DatePickerField.vue'
import MoneyFlow from '@/components/shared/MoneyFlow.vue'
import MonthStrip from '@/components/shared/MonthStrip.vue'
import StatusMessage from '@/components/shared/StatusMessage.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useEffectiveProjection } from '@/composables/useEffectiveProjection'
import { useTimeTravel } from '@/composables/useTimeTravel'
import type { MonthAdjustment } from '@/models'
import { buildProjectionShareSummary } from '@/services/projectionService'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'
import { addMonthsToKey, formatShortMonthYear, monthsBetween } from '@/utils/date'

// The plan played out month by month: the window it covers, the headline
// figures, and the table where one-time adjustments are made.

const projectionStore = useProjectionStore()
const uiStore = useUiStore()
const collabStore = useCollaborationStore()
const { currencyCode, formatCurrency, formatCompactCurrency, locale, selectedMonth: sharedSelectedMonth } = useCurrency()
const {
  rows, summary, milestones, displayInputs, hasSavings, unconvertibleCurrencies,
  hasFocus, focusIdx, focusRow,
} = useEffectiveProjection()
const { focus } = useTimeTravel()

const selectMonth = (monthKey: string): void => {
  const index = rows.value.findIndex((r) => r.monthKey === monthKey)
  if (index >= 0) focus(index)
}

const readonly = computed(() => collabStore.isReadOnly)
const MAX_MONTHS = 60

// ── Window: a start month and an end month ──────────────────────────────────
// The store keeps a start month and a length in months; the end month is derived
// from those, and editing either end adjusts the length.
const selectedMonth = computed({
  get: () => sharedSelectedMonth.value,
  set: (val: string) => {
    if (collabStore.isViewingSharedBudget) {
      collabStore.updateSharedSelectedMonth(val)
    } else {
      uiStore.setSelectedMonth(val)
      collabStore.broadcastProfileUpdate(uiStore.currencyCode, uiStore.locale, val)
    }
  },
})

const months = computed(() => projectionStore.inputs.months)
const clampMonths = (count: number): number => Math.min(MAX_MONTHS, Math.max(1, count))
const setMonths = (count: number): void => {
  const next = clampMonths(count)
  if (next !== months.value) projectionStore.setInputs({ months: next })
}

const endMonth = computed({
  get: () => addMonthsToKey(selectedMonth.value, Math.max(1, months.value) - 1),
  set: (val: string) => {
    if (val) setMonths(monthsBetween(selectedMonth.value, val) + 1)
  },
})

// Moving the start keeps the end where it is (the window gets shorter or longer)
const startMonth = computed({
  get: () => selectedMonth.value,
  set: (val: string) => {
    if (!val) return
    const end = endMonth.value
    selectedMonth.value = val
    setMonths(monthsBetween(val, end) + 1)
  },
})

const latestEndMonth = computed(() => addMonthsToKey(selectedMonth.value, MAX_MONTHS - 1))

// ── Headline figures ────────────────────────────────────────────────────────
const lowest = computed(() =>
  rows.value.reduce<{ value: number; label: string } | null>(
    (min, row) => (min === null || row.cumulativeBalance < min.value ? { value: row.cumulativeBalance, label: row.monthLabel } : min),
    null,
  ),
)

// ── One-time adjustments (edited in the display currency) ───────────────────
const monthlyAdjustments = computed(() => displayInputs.value.monthlyAdjustments)

const onAdjustmentsUpdate = (adjustments: MonthAdjustment[]): void => {
  const stored = projectionStore.inputs.monthlyAdjustments
  const shown = monthlyAdjustments.value
  projectionStore.setMonthlyAdjustments(
    adjustments.map((next) => {
      const original = stored.find((a) => a.id === next.id)
      const before = shown.find((a) => a.id === next.id)
      const untouched = !!original && !!before
        && before.monthKey === next.monthKey
        && before.incomeAdjustment === next.incomeAdjustment
        && before.expenseAdjustment === next.expenseAdjustment
        && before.note === next.note
      // Untouched adjustments keep the currency they were entered in; an edited
      // one was typed in the display currency.
      return untouched ? original : { ...next, currency: currencyCode.value }
    }),
  )
}

// The adjustments as a list for the rail, in month order
const changes = computed(() =>
  [...monthlyAdjustments.value]
    .sort((x, y) => x.monthKey.localeCompare(y.monthKey))
    .map((adjustment) => ({
      id: adjustment.id,
      label: formatShortMonthYear(adjustment.monthKey, locale.value),
      note: adjustment.note,
      net: adjustment.incomeAdjustment - adjustment.expenseAdjustment,
    })),
)

// ── Share ───────────────────────────────────────────────────────────────────
const shareState = reactive({
  message: '',
  tone: 'neutral' as 'neutral' | 'success' | 'error',
})

const shareSummary = computed(() =>
  buildProjectionShareSummary({
    startMonthLabel: rows.value[0]?.monthLabel ?? 'N/A',
    endMonthLabel: rows.value.at(-1)?.monthLabel ?? 'N/A',
    totalIncome: formatCurrency(summary.value.totalIncome),
    totalExpenses: formatCurrency(summary.value.totalExpenses),
    totalNet: formatCurrency(summary.value.totalNet),
    endingBalance: formatCurrency(summary.value.endingBalance),
    firstNegativeMonthLabel: milestones.value.firstNegativeMonthLabel,
    highestBalanceMonthLabel: milestones.value.highestBalanceMonthLabel,
    highestBalance: formatCurrency(milestones.value.highestBalance),
    endingNetWorth: hasSavings.value ? formatCurrency(summary.value.endingNetWorth) : undefined,
  }),
)

const copyShareSummary = async (): Promise<void> => {
  if (!navigator.clipboard?.writeText) {
    shareState.message = 'Clipboard not available.'
    shareState.tone = 'error'
    return
  }
  try {
    await navigator.clipboard.writeText(shareSummary.value)
    shareState.message = 'Copied to clipboard.'
    shareState.tone = 'success'
  } catch {
    shareState.message = 'Could not copy.'
    shareState.tone = 'error'
  }
}

const downloadShareSummary = (): void => {
  const blob = new Blob([shareSummary.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `budget-forecast-${selectedMonth.value}.txt`
  link.click()
  URL.revokeObjectURL(url)
  shareState.message = 'Downloaded.'
  shareState.tone = 'success'
}

// The status line clears itself so an old "Copied" does not linger
const statusTimer = ref<ReturnType<typeof setTimeout>>()
watch(() => shareState.message, (message) => {
  clearTimeout(statusTimer.value)
  if (message) statusTimer.value = setTimeout(() => { shareState.message = '' }, 4000)
})
</script>

<template>
  <div class="page">

    <!-- ── Header ─────────────────────────────────────────────────── -->
    <header class="page-head">
      <div>
        <h1 class="page-title">Forecast</h1>
        <p class="page-description">Your plan, month by month. Select a month to look at it or add a one-time change.</p>
      </div>
      <div class="page-actions">
        <StatusMessage :message="shareState.message" :tone="shareState.tone" />
        <!-- The period the forecast covers -->
        <div class="fc-period" role="group" aria-label="Period">
          <label class="fc-period-label" for="start-month">From</label>
          <DatePickerField input-id="start-month" v-model="startMonth" :disabled="readonly" />
          <label class="fc-period-label" for="end-month">to</label>
          <DatePickerField
            input-id="end-month"
            v-model="endMonth"
            :min="selectedMonth"
            :max="latestEndMonth"
            :disabled="readonly"
          />
        </div>
        <span v-if="readonly" class="status-pill status-pill-warning">
          <i class="pi pi-eye text-xs" aria-hidden="true" /> View only
        </span>
        <button class="btn btn-ghost btn-icon" title="Copy summary" aria-label="Copy summary" @click="copyShareSummary">
          <i class="pi pi-copy" aria-hidden="true" />
        </button>
        <button class="btn btn-ghost btn-icon" title="Download .txt" aria-label="Download .txt" @click="downloadShareSummary">
          <i class="pi pi-download" aria-hidden="true" />
        </button>
      </div>
    </header>

    <p v-if="unconvertibleCurrencies.length" class="fc-rates-warning">
      <i class="pi pi-exclamation-triangle text-xs" aria-hidden="true" />
      Exchange rates are unavailable, so amounts in {{ unconvertibleCurrencies.join(', ') }} are shown unconverted and totals are wrong.
    </p>

    <!-- ── Every month at a glance ────────────────────────────────── -->
    <section v-if="rows.length" class="card fc-strip">
      <MonthStrip :rows="rows" :focus-index="focusIdx" :locale="locale" :format-currency="formatCurrency" @select="focus" />
    </section>

    <div class="page-body with-rail">

      <!-- ── Table ────────────────────────────────────────────────── -->
      <div class="card card-flush fc-table">
        <ProjectionTable
          :rows="rows"
          :format-currency="formatCurrency"
          :format-compact="formatCompactCurrency"
          :locale="locale"
          :adjustments="monthlyAdjustments"
          :readonly="readonly"
          :show-net-worth="hasSavings"
          :focus-key="focusRow?.monthKey ?? null"
          @update:adjustments="onAdjustmentsUpdate"
          @select="selectMonth"
        />
      </div>

      <!-- ── Rail: the month, the period, one-time changes ─────────── -->
      <aside class="stack scroll-y">
        <section v-if="focusRow" class="card card-col fc-card" aria-labelledby="fc-month-title">
          <div class="card-head">
            <h2 id="fc-month-title" class="card-title">{{ hasFocus ? focusRow.monthLabel : `End of plan, ${focusRow.monthLabel}` }}</h2>
            <button v-if="hasFocus" class="btn btn-ghost btn-sm" @click="focus(null)">End of plan</button>
          </div>
          <p class="fc-big" :class="{ 'text-negative': focusRow.cumulativeBalance < 0 }">
            <MoneyFlow :value="focusRow.cumulativeBalance" />
          </p>
          <dl class="fc-stats">
            <div class="fc-stat">
              <dt>Net that month</dt>
              <dd :class="focusRow.net < 0 ? 'text-negative' : 'text-positive'"><MoneyFlow :value="focusRow.net" signed /></dd>
            </div>
            <div v-if="hasSavings" class="fc-stat">
              <dt>Savings</dt>
              <dd><MoneyFlow :value="focusRow.savingsBalance" /></dd>
            </div>
            <div v-if="hasSavings" class="fc-stat">
              <dt>Net worth</dt>
              <dd><MoneyFlow :value="focusRow.netWorth" /></dd>
            </div>
          </dl>
        </section>

        <section class="card card-col fc-card" aria-labelledby="fc-window-title">
          <h2 id="fc-window-title" class="card-title">Across the plan</h2>
          <dl class="fc-stats">
            <div class="fc-stat">
              <dt>Length</dt>
              <dd>{{ months }} month{{ months === 1 ? '' : 's' }}</dd>
            </div>
            <div v-if="lowest" class="fc-stat">
              <dt>Lowest cash</dt>
              <dd :class="{ 'text-negative': lowest.value < 0 }" :title="lowest.label">{{ formatCompactCurrency(lowest.value) }}</dd>
            </div>
            <div class="fc-stat">
              <dt>Below zero</dt>
              <dd :class="milestones.firstNegativeMonthLabel ? 'text-negative' : ''">{{ milestones.firstNegativeMonthLabel ?? 'Never' }}</dd>
            </div>
          </dl>
        </section>

        <section class="card card-col fc-card grow" aria-labelledby="fc-changes-title">
          <h2 id="fc-changes-title" class="card-title">One-time changes</h2>
          <ul v-if="changes.length" class="fc-changes scroll-y grow">
            <li v-for="change in changes" :key="change.id" class="fc-change">
              <span class="tile tile-sm" :style="{ '--h': 38 }" aria-hidden="true"><i class="pi pi-bolt" /></span>
              <span class="fc-change-text">
                <span class="fc-change-month">{{ change.label }}</span>
                <span v-if="change.note" class="fc-change-note">{{ change.note }}</span>
              </span>
              <span class="fc-change-amount" :class="change.net >= 0 ? 'text-positive' : 'text-negative'">
                {{ change.net >= 0 ? '+' : '' }}{{ formatCurrency(change.net) }}
              </span>
            </li>
          </ul>
          <p v-else class="fc-note">
            None yet. Select a month in the table to add a bonus, a big purchase or anything else that happens once.
          </p>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.fc-rates-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-control);
  font-size: 0.8125rem;
  color: var(--app-negative);
  background: var(--app-negative-soft);
  border: 1px solid var(--app-negative-border);
  flex: none;
}

.fc-strip {
  flex: none;
  padding: 0.75rem var(--card-pad);
}

.fc-table {
  overflow: hidden;
  min-height: 0;
}

/* ── Rail cards ──────────────────────────────────────────────── */
.fc-card {
  flex-shrink: 0;
}

.fc-card.grow {
  flex-shrink: 1;
  min-height: 7rem;
}

.fc-big {
  margin: 0;
  font-size: 1.875rem;
  font-weight: 620;
  letter-spacing: -0.04em;
  line-height: 1.1;
  color: var(--app-text);
}

.fc-period {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fc-period :deep(.p-datepicker),
.fc-period > :not(label) {
  width: 11.5rem;
}

.fc-period-label {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.fc-note {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--app-text-secondary);
}

.fc-stats {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.fc-stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.4375rem 0;
  border-bottom: 1px solid var(--app-border);
}

.fc-stat:first-child {
  padding-top: 0;
}

.fc-stat:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.fc-stat dt {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.fc-stat dd {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 550;
  color: var(--app-text);
  white-space: nowrap;
}

.fc-changes {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fc-change {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.fc-change-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.fc-change-month {
  font-size: 0.875rem;
  color: var(--app-text);
}

.fc-change-note {
  font-size: 0.75rem;
  color: var(--app-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fc-change-amount {
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 550;
}

@media (max-width: 1023px) {
  .fc-table {
    overflow-x: auto;
  }

  .fc-period {
    flex-wrap: wrap;
    width: 100%;
  }

  .fc-period > :not(label) {
    flex: 1;
    min-width: 9rem;
    width: auto;
  }
}
</style>

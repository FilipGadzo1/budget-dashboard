<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'

import MoneyFlow from '@/components/shared/MoneyFlow.vue'
import type { MonthAdjustment, ProjectionRow } from '@/models'
import { formatShortMonth } from '@/utils/date'

const props = defineProps<{
  rows: ProjectionRow[]
  /** Exact amount — used for tooltips and the adjustment panel. */
  formatCurrency: (n: number) => string
  /** Compact amount (€5.9K) — what the cells show. */
  formatCompact: (n: number) => string
  locale: string
  adjustments: MonthAdjustment[]
  readonly?: boolean
  /** Show the net-worth column (only useful when the budget has savings). */
  showNetWorth?: boolean
  /** Month the app is looking at (YYYY-MM); its row is highlighted. */
  focusKey?: string | null
}>()

const emit = defineEmits<{
  'update:adjustments': [adjustments: MonthAdjustment[]]
  /** A month was clicked: make it the month the app is looking at. */
  select: [monthKey: string]
}>()

// Clicking a row looks at that month and, when the plan can be edited, opens
// its one-time adjustment panel.
const onRowClick = (monthKey: string): void => {
  emit('select', monthKey)
  if (!props.readonly) toggleExpand(monthKey)
}

const expandedMonthKey = ref<string | null>(null)

// A cell whose figure changes is re-created (it is keyed by its value) and slides
// in. That is switched on only after the first paint, so opening the page does
// not animate every cell. Plain CSS on purpose: a rolling-digit component in each
// of up to 300 cells froze the page for about a second on every edit.
const live = ref(false)
onMounted(() => requestAnimationFrame(() => { live.value = true }))
const draft = ref({ incomeAdjustment: 0, expenseAdjustment: 0, note: '' })

const toggleExpand = (monthKey: string): void => {
  if (expandedMonthKey.value === monthKey) {
    expandedMonthKey.value = null
    return
  }
  const existing = props.adjustments.find((a) => a.monthKey === monthKey)
  draft.value = {
    incomeAdjustment: existing?.incomeAdjustment ?? 0,
    expenseAdjustment: existing?.expenseAdjustment ?? 0,
    note: existing?.note ?? '',
  }
  expandedMonthKey.value = monthKey
}

const saveAdjustment = (monthKey: string): void => {
  const withoutThis = props.adjustments.filter((a) => a.monthKey !== monthKey)
  const isNoop = draft.value.incomeAdjustment === 0 && draft.value.expenseAdjustment === 0
  const next: MonthAdjustment[] = isNoop
    ? withoutThis
    : [
        ...withoutThis,
        {
          id: props.adjustments.find((a) => a.monthKey === monthKey)?.id ?? crypto.randomUUID(),
          monthKey,
          incomeAdjustment: draft.value.incomeAdjustment,
          expenseAdjustment: draft.value.expenseAdjustment,
          note: draft.value.note.trim() || undefined,
        },
      ]
  emit('update:adjustments', next)
  expandedMonthKey.value = null
}

const clearAdjustment = (monthKey: string): void => {
  emit('update:adjustments', props.adjustments.filter((a) => a.monthKey !== monthKey))
  expandedMonthKey.value = null
}

const isAdjusted = (row: ProjectionRow): boolean =>
  row.incomeAdjustment !== 0 || row.expenseAdjustment !== 0

const hasSavings = (row: ProjectionRow): boolean => row.savingsContribution > 0

// Rows grouped by calendar year, each with that year's total net
const yearGroups = computed(() => {
  const groups: Array<{ year: string; net: number; rows: ProjectionRow[] }> = []
  props.rows.forEach((row) => {
    const year = row.monthKey.slice(0, 4)
    let group = groups.at(-1)
    if (!group || group.year !== year) {
      group = { year, net: 0, rows: [] }
      groups.push(group)
    }
    group.net += row.net
    group.rows.push(row)
  })
  return groups
})

const columnCount = computed(() => (props.readonly ? 6 : 7) + (props.showNetWorth ? 1 : 0))
const anySavings = computed(() => props.rows.some(hasSavings))
const anyAdjusted = computed(() => props.rows.some(isAdjusted))

const signed = (value: number, text: string): string => (value >= 0 ? '+' : '') + text
</script>

<template>
  <div class="ptable-wrap" :class="{ 'ptable-live': live }">
  <div class="ptable-scroll">
    <table class="ptable">
      <thead class="ptable-head">
        <tr>
          <th class="ptable-th-accent" />
          <th class="ptable-th ptable-th-month">Month</th>
          <th class="ptable-th ptable-th-num">Income</th>
          <th class="ptable-th ptable-th-num">Expenses</th>
          <th class="ptable-th ptable-th-num">Net</th>
          <th class="ptable-th ptable-th-num">Cash</th>
          <th v-if="showNetWorth" class="ptable-th ptable-th-num">Net worth</th>
          <th v-if="!readonly" class="ptable-th ptable-th-action" />
        </tr>
      </thead>
      <tbody>
        <template v-for="group in yearGroups" :key="group.year">

          <!-- ── Year header ───────────────────────────────────── -->
          <tr class="ptable-year-row">
            <td :colspan="columnCount" class="ptable-year-cell">
              <span class="ptable-year">{{ group.year }}</span>
              <span class="ptable-year-net" :title="`Net for ${group.year}: ${signed(group.net, formatCurrency(group.net))}`">
                net <MoneyFlow :value="group.net" compact signed />
              </span>
            </td>
          </tr>

        <template v-for="row in group.rows" :key="row.monthKey">

          <!-- ── Main row ──────────────────────────────────────── -->
          <tr
            class="ptable-row"
            :class="{
              'ptable-row-interactive': !readonly,
              'ptable-row-open': expandedMonthKey === row.monthKey,
              'ptable-row-focus': row.monthKey === focusKey,
            }"
            :tabindex="readonly ? undefined : 0"
            :role="readonly ? undefined : 'button'"
            :aria-expanded="readonly ? undefined : expandedMonthKey === row.monthKey"
            :aria-label="readonly ? undefined : `Adjust ${row.monthLabel}`"
            @click="onRowClick(row.monthKey)"
            @keydown.enter.self.prevent="!readonly && toggleExpand(row.monthKey)"
            @keydown.space.self.prevent="!readonly && toggleExpand(row.monthKey)"
          >
            <!-- Left accent bar -->
            <td
              class="ptable-accent"
              :class="{
                'ptable-accent-pos': !isAdjusted(row) && row.net > 0,
                'ptable-accent-neg': !isAdjusted(row) && row.net < 0,
                'ptable-accent-adj': isAdjusted(row),
              }"
            />

            <!-- Month -->
            <td class="ptable-month-cell">
              <span class="ptable-month-name" :title="row.monthLabel">{{ formatShortMonth(row.monthKey, locale) }}</span>
              <span v-if="isAdjusted(row)" class="ptable-adj-badge" :title="row.adjustmentNote || 'Has a one-time adjustment'" />
            </td>

            <!-- Income -->
            <td class="ptable-num-cell">
              <span :key="row.income" class="ptable-num ptable-tick" :title="formatCurrency(row.income)">{{ formatCompact(row.income) }}</span>
              <span
                v-if="row.incomeAdjustment !== 0"
                class="ptable-delta"
                :class="row.incomeAdjustment > 0 ? 'ptable-delta-pos' : 'ptable-delta-neg'"
                :title="formatCurrency(row.incomeAdjustment)"
              >{{ signed(row.incomeAdjustment, formatCompact(row.incomeAdjustment)) }}</span>
            </td>

            <!-- Expenses -->
            <td class="ptable-num-cell">
              <span :key="row.expenses" class="ptable-num ptable-tick" :title="formatCurrency(row.expenses)">{{ formatCompact(row.expenses) }}</span>
              <span
                v-if="row.expenseAdjustment !== 0"
                class="ptable-delta"
                :class="row.expenseAdjustment > 0 ? 'ptable-delta-neg' : 'ptable-delta-pos'"
                :title="formatCurrency(row.expenseAdjustment)"
              >{{ signed(row.expenseAdjustment, formatCompact(row.expenseAdjustment)) }}</span>
            </td>

            <!-- Net -->
            <td class="ptable-num-cell">
              <span
                :key="row.net"
                class="ptable-net ptable-tick"
                :class="row.net >= 0 ? 'ptable-net-pos' : 'ptable-net-neg'"
                :title="formatCurrency(row.net)"
              >{{ signed(row.net, formatCompact(row.net)) }}</span>
            </td>

            <!-- Cumulative balance -->
            <td class="ptable-num-cell">
              <span
                :key="row.cumulativeBalance"
                class="ptable-num ptable-tick"
                :class="row.cumulativeBalance < 0 ? 'ptable-bal-neg' : ''"
                :title="formatCurrency(row.cumulativeBalance)"
              >{{ formatCompact(row.cumulativeBalance) }}</span>
              <!-- A transfer out of cash, shown where the money leaves -->
              <span
                v-if="hasSavings(row)"
                class="ptable-savings-line"
                :title="`${formatCurrency(row.savingsContribution)} moved from cash into savings`"
              >−{{ formatCompact(row.savingsContribution) }}<span class="ptable-savings-word"> to savings</span></span>
            </td>

            <!-- Net worth (cash + savings) -->
            <td v-if="showNetWorth" class="ptable-num-cell">
              <span
                :key="row.netWorth"
                class="ptable-num ptable-tick"
                :class="row.netWorth < 0 ? 'ptable-bal-neg' : ''"
                :title="formatCurrency(row.netWorth)"
              >{{ formatCompact(row.netWorth) }}</span>
            </td>

            <!-- Chevron -->
            <td v-if="!readonly" class="ptable-chevron-cell">
              <i
                aria-hidden="true"
                class="pi ptable-chevron"
                :class="expandedMonthKey === row.monthKey ? 'pi-chevron-up' : 'pi-chevron-down'"
              />
            </td>
          </tr>

          <!-- ── Expanded adjustment panel ─────────────────────── -->
          <tr
            v-if="expandedMonthKey === row.monthKey && !readonly"
            class="ptable-expand-row"
          >
            <td :colspan="columnCount" class="ptable-expand-cell">
              <div class="ptable-panel">
                <p class="ptable-panel-title">
                  Adjust <strong>{{ row.monthLabel }}</strong>
                  <span class="ptable-panel-hint">— one-time income or expense change</span>
                </p>
                <div class="ptable-panel-fields">
                  <div class="ptable-panel-field">
                    <label class="form-label">Extra income</label>
                    <InputNumber
                      v-model="draft.incomeAdjustment"
                      :min-fraction-digits="0"
                      :max-fraction-digits="2"
                      mode="decimal"
                      :use-grouping="true"
                      fluid
                      @click.stop
                    />
                  </div>
                  <div class="ptable-panel-field">
                    <label class="form-label">Extra expense</label>
                    <InputNumber
                      v-model="draft.expenseAdjustment"
                      :min-fraction-digits="0"
                      :max-fraction-digits="2"
                      mode="decimal"
                      :use-grouping="true"
                      fluid
                      @click.stop
                    />
                  </div>
                  <div class="ptable-panel-field ptable-panel-field-note">
                    <label class="form-label">Note <span class="ptable-panel-optional">(optional)</span></label>
                    <InputText
                      v-model="draft.note"
                      placeholder="e.g. Annual bonus"
                      fluid
                      @click.stop
                    />
                  </div>
                </div>
                <div class="ptable-panel-actions" @click.stop>
                  <button class="btn btn-primary btn-sm" @click="saveAdjustment(row.monthKey)">
                    Save
                  </button>
                  <button
                    v-if="isAdjusted(row)"
                    class="btn btn-danger btn-sm"
                    @click="clearAdjustment(row.monthKey)"
                  >
                    Clear
                  </button>
                  <button
                    class="btn btn-secondary btn-sm"
                    @click.stop="expandedMonthKey = null"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </td>
          </tr>

        </template>
        </template>
      </tbody>
    </table>
  </div>

    <!-- Legend -->
    <div v-if="anySavings || anyAdjusted" class="ptable-legend">
      <span v-if="anySavings" class="ptable-legend-item">
        <span class="ptable-legend-dot ptable-legend-dot-savings" />
        Moved to savings — still yours, not an expense
      </span>
      <span v-if="anyAdjusted" class="ptable-legend-item">
        <span class="ptable-legend-dot ptable-legend-dot-adj" />
        One-time adjustment
      </span>
      <span class="ptable-legend-item ptable-legend-hint">Hover an amount for the exact figure</span>
    </div>
  </div>
</template>

<style scoped>
/* ─── Scroll wrapper ──────────────────────────────────────────── */
/* The table scrolls inside its card (the header stays put), not the page */
.ptable-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ptable-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.ptable-row-focus {
  background: var(--app-accent-soft);
}

/* ─── Table base ──────────────────────────────────────────────── */
.ptable {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

/* ─── Header ──────────────────────────────────────────────────── */
.ptable-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--app-surface);
}

.ptable-head tr {
  border-bottom: 2px solid var(--app-border);
}

.ptable-th-accent {
  width: 4px;
  padding: 0;
}

.ptable-th {
  padding: 0.5rem 1rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.ptable-th-month {
  text-align: left;
  padding-left: 0.75rem;
}

.ptable-th-num {
  text-align: right;
}

.ptable-th-action {
  width: 2.5rem;
}

/* ─── Body rows ───────────────────────────────────────────────── */
.ptable-row {
  border-bottom: 1px solid var(--app-border);
  transition: background 0.1s ease;
}

.ptable-row:last-child {
  border-bottom: none;
}

.ptable-row-interactive {
  cursor: pointer;
  user-select: none;
}

.ptable-row-interactive:hover {
  background: var(--app-surface-hover);
}

.ptable-row-open {
  background: var(--app-surface-hover);
}

/* ─── Left accent bar ─────────────────────────────────────────── */
.ptable-accent {
  width: 4px;
  padding: 0;
  border-right: none;
}

.ptable-accent-pos {
  background: var(--app-positive);
  opacity: 0.7;
}

.ptable-accent-neg {
  background: var(--app-negative);
  opacity: 0.7;
}

.ptable-accent-adj {
  background: var(--app-warning, #f59e0b);
}

/* ─── Month cell ──────────────────────────────────────────────── */
.ptable-month-cell {
  padding: 5px 0.75rem;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  vertical-align: middle;
}

.ptable-month-name {
  font-weight: 500;
  color: var(--app-text);
  font-size: 0.8125rem;
}

.ptable-adj-badge {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--app-warning, #f59e0b);
  flex-shrink: 0;
}

/* Transfer to savings: the blue series colour, so it reads as neither a gain
   (green) nor a loss (red) */
.ptable-savings-line {
  display: block;
  font-family: var(--font-num);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: var(--chart-2);
  margin-top: 1px;
}

/* ─── Year header ─────────────────────────────────────────────── */
.ptable-year-cell {
  padding: 0.3125rem 1rem 0.3125rem 0.75rem;
  background: var(--app-surface-hover);
  border-bottom: 1px solid var(--app-border);
  font-size: 0.6875rem;
  color: var(--app-text-secondary);
}

.ptable-year {
  font-weight: 700;
  letter-spacing: 0.05em;
}

.ptable-year-net {
  float: right;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
}

/* ─── Legend ──────────────────────────────────────────────────── */
.ptable-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  padding: 0.5rem 0.875rem;
  border-top: 1px solid var(--app-border);
  font-size: 0.71875rem;
  color: var(--app-text-secondary);
}

.ptable-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.ptable-legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ptable-legend-dot-savings { background: var(--chart-2); }
.ptable-legend-dot-adj { background: var(--app-warning, #f59e0b); }

.ptable-legend-hint {
  margin-left: auto;
  color: var(--app-text-tertiary);
}

/* ─── Number cells ────────────────────────────────────────────── */
.ptable-num-cell {
  padding: 5px 1rem;
  text-align: right;
  white-space: nowrap;
  vertical-align: top;
}

.ptable-num {
  display: block;
  font-family: var(--font-num);
  font-size: 0.8125rem;
  color: var(--app-text);
  font-variant-numeric: tabular-nums;
}

.ptable-delta {
  display: block;
  font-family: var(--font-num);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  margin-top: 1px;
}

.ptable-delta-pos { color: var(--app-positive); }
.ptable-delta-neg { color: var(--app-negative); }

.ptable-net {
  display: inline-block;
  font-family: var(--font-num);
  font-size: 0.875rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.ptable-net-pos { color: var(--app-positive); }
.ptable-net-neg { color: var(--app-negative); }

.ptable-bal-neg {
  color: var(--app-negative);
}

/* ─── Chevron ─────────────────────────────────────────────────── */
.ptable-chevron-cell {
  padding: 5px 0.875rem 5px 0;
  vertical-align: middle;
  text-align: right;
  width: 2.5rem;
}

.ptable-chevron {
  font-size: 0.6875rem;
  color: var(--app-text-secondary);
  transition: transform 0.18s ease;
}

/* ─── Expanded panel ──────────────────────────────────────────── */
.ptable-expand-row {
  background: var(--app-surface-hover);
}

.ptable-expand-cell {
  padding: 0;
  border-bottom: 1px solid var(--app-border);
}

.ptable-panel {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  border-top: 1px solid var(--app-border);
}

.ptable-panel-title {
  font-size: 0.8125rem;
  color: var(--app-text);
  margin: 0;
}

.ptable-panel-hint {
  font-weight: 400;
  color: var(--app-text-secondary);
  font-size: 0.75rem;
}

.ptable-panel-optional {
  font-weight: 400;
  color: var(--app-text-secondary);
}

.ptable-panel-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: end;
}

.ptable-panel-field {
  min-width: 140px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ptable-panel-field-note {
  min-width: 200px;
  flex: 2;
}

.ptable-panel-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* ─── Mobile ──────────────────────────────────────────────────── */
@media (max-width: 1023px) {
  /* Tighter columns so Cash stays on screen at phone width */
  .ptable-th {
    padding: 0.5rem 0.4375rem;
  }

  .ptable-legend-hint {
    display: none;
  }

  /* Phone: the blue amount alone (the legend says what it is), so the Cash
     column stays narrow enough to fit */
  .ptable-savings-word {
    display: none;
  }

  .ptable-month-cell {
    padding: 5px 0.625rem;
  }

  .ptable-num-cell {
    padding: 5px 0.4375rem;
  }

  .ptable-chevron-cell {
    padding: 5px 0.625rem 5px 0;
  }
}

/* ─── A changed figure slides in ──────────────────────────────── */
.ptable-live .ptable-tick {
  animation: ptableTick 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes ptableTick {
  from { opacity: 0; transform: translateY(0.35em); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>

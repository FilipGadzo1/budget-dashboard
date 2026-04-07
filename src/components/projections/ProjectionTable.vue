<script setup lang="ts">
import { ref } from 'vue'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'

import type { MonthAdjustment, ProjectionRow } from '@/models'

const props = defineProps<{
  rows: ProjectionRow[]
  formatCurrency: (n: number) => string
  adjustments: MonthAdjustment[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:adjustments': [adjustments: MonthAdjustment[]]
}>()

const expandedMonthKey = ref<string | null>(null)
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
</script>

<template>
  <div class="ptable-scroll">
    <table class="ptable">
      <thead class="ptable-head">
        <tr>
          <th class="ptable-th-accent" />
          <th class="ptable-th ptable-th-month">Month</th>
          <th class="ptable-th ptable-th-num">Income</th>
          <th class="ptable-th ptable-th-num">Expenses</th>
          <th class="ptable-th ptable-th-num">Net</th>
          <th class="ptable-th ptable-th-num">Balance</th>
          <th v-if="!readonly" class="ptable-th ptable-th-action" />
        </tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="row.monthKey">

          <!-- ── Main row ──────────────────────────────────────── -->
          <tr
            class="ptable-row"
            :class="{
              'ptable-row-interactive': !readonly,
              'ptable-row-open': expandedMonthKey === row.monthKey,
            }"
            @click="!readonly && toggleExpand(row.monthKey)"
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
              <span class="ptable-month-name">{{ row.monthLabel }}</span>
              <span v-if="isAdjusted(row)" class="ptable-adj-badge" title="Has one-time adjustment" />
            </td>

            <!-- Income -->
            <td class="ptable-num-cell">
              <span class="ptable-num">{{ formatCurrency(row.income) }}</span>
              <span
                v-if="row.incomeAdjustment !== 0"
                class="ptable-delta"
                :class="row.incomeAdjustment > 0 ? 'ptable-delta-pos' : 'ptable-delta-neg'"
              >{{ row.incomeAdjustment > 0 ? '+' : '' }}{{ formatCurrency(row.incomeAdjustment) }}</span>
            </td>

            <!-- Expenses -->
            <td class="ptable-num-cell">
              <span class="ptable-num">{{ formatCurrency(row.expenses) }}</span>
              <span
                v-if="row.expenseAdjustment !== 0"
                class="ptable-delta ptable-delta-neg"
              >+{{ formatCurrency(row.expenseAdjustment) }}</span>
            </td>

            <!-- Net -->
            <td class="ptable-num-cell">
              <span
                class="ptable-net"
                :class="row.net >= 0 ? 'ptable-net-pos' : 'ptable-net-neg'"
              >{{ row.net >= 0 ? '+' : '' }}{{ formatCurrency(row.net) }}</span>
            </td>

            <!-- Cumulative balance -->
            <td class="ptable-num-cell">
              <span
                class="ptable-num"
                :class="row.cumulativeBalance < 0 ? 'ptable-bal-neg' : ''"
              >{{ formatCurrency(row.cumulativeBalance) }}</span>
            </td>

            <!-- Chevron -->
            <td v-if="!readonly" class="ptable-chevron-cell">
              <i
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
            <td :colspan="readonly ? 6 : 7" class="ptable-expand-cell">
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
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* ─── Scroll wrapper ──────────────────────────────────────────── */
.ptable-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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
  padding: 0.6875rem 1rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
  padding: 0.875rem 0.75rem 0.875rem 0.75rem;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

/* ─── Number cells ────────────────────────────────────────────── */
.ptable-num-cell {
  padding: 0.875rem 1rem;
  text-align: right;
  white-space: nowrap;
  vertical-align: middle;
}

.ptable-num {
  display: block;
  font-family: 'DM Mono', monospace;
  font-size: 0.8125rem;
  color: var(--app-text);
  font-variant-numeric: tabular-nums;
}

.ptable-delta {
  display: block;
  font-family: 'DM Mono', monospace;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  margin-top: 1px;
}

.ptable-delta-pos { color: var(--app-positive); }
.ptable-delta-neg { color: var(--app-negative); }

.ptable-net {
  font-family: 'DM Mono', monospace;
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
  padding: 0.875rem 0.875rem 0.875rem 0;
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
  .ptable-month-cell {
    padding: 0.75rem 0.625rem 0.75rem 0.625rem;
  }

  .ptable-num-cell {
    padding: 0.75rem 0.75rem;
  }

  .ptable-chevron-cell {
    padding: 0.75rem 0.625rem 0.75rem 0;
  }
}
</style>

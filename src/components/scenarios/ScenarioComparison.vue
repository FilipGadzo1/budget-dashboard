<script setup lang="ts">
import { computed } from 'vue'

import MoneyFlow from '@/components/shared/MoneyFlow.vue'

export interface ComparisonRow {
  id: string
  name: string
  isCurrent: boolean
  isActive: boolean
  income: number         // typical month
  expenses: number       // typical month
  months: number
  endingBalance: number  // cash at the end of the horizon
  firstNegativeMonthLabel: string | null
}

const props = defineProps<{
  rows: ComparisonRow[]
}>()

// Ending cash is only comparable between plans of the same length, so the "best"
// marker is shown only when every row shares one horizon.
const sameHorizon = computed(() => new Set(props.rows.map((r) => r.months)).size === 1)

const bestId = computed(() => {
  if (!sameHorizon.value || props.rows.length < 2) return null
  return props.rows.reduce((best, r) => (r.endingBalance > best.endingBalance ? r : best)).id
})
</script>

<template>
  <div class="card card-flush compare-card">
    <div class="compare-header">
      <h2 class="card-title">Compare plans</h2>
      <p class="compare-hint">
        Each plan projected from your current starting balance and savings.
      </p>
    </div>

    <div class="compare-scroll">
      <table class="compare-table">
        <thead>
          <tr>
            <th class="compare-th compare-th-name">Plan</th>
            <th class="compare-th">Income / mo</th>
            <th class="compare-th">Expenses / mo</th>
            <th class="compare-th">Net / mo</th>
            <th class="compare-th">Horizon</th>
            <th class="compare-th">Ending cash</th>
            <th class="compare-th compare-th-name">First negative month</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" :class="{ 'compare-row-current': row.isCurrent }">
            <td class="compare-td compare-td-name">
              <span class="compare-name">{{ row.name }}</span>
              <span v-if="row.isActive" class="status-pill status-pill-positive compare-pill">Active</span>
            </td>
            <td class="compare-td compare-num"><MoneyFlow :value="row.income" /></td>
            <td class="compare-td compare-num"><MoneyFlow :value="row.expenses" /></td>
            <td
              class="compare-td compare-num"
              :class="row.income - row.expenses >= 0 ? 'text-positive' : 'text-negative'"
            >
              <MoneyFlow :value="row.income - row.expenses" signed />
            </td>
            <td class="compare-td compare-num">{{ row.months }} mo</td>
            <td class="compare-td compare-num" :class="{ 'text-negative': row.endingBalance < 0 }">
              <MoneyFlow :value="row.endingBalance" />
              <span v-if="row.id === bestId" class="compare-best" title="Highest ending cash">
                <i class="pi pi-star-fill" /> Best
              </span>
            </td>
            <td class="compare-td compare-td-name" :class="row.firstNegativeMonthLabel ? 'text-negative' : 'text-secondary'">
              {{ row.firstNegativeMonthLabel ?? 'Never' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="!sameHorizon" class="compare-footnote">
      These plans cover different numbers of months, so their ending cash is not directly comparable.
    </p>
  </div>
</template>

<style scoped>
.compare-card {
  overflow: hidden;
}

.compare-header {
  padding: 1rem 1.25rem 0.75rem;
}

.compare-hint {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.compare-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.compare-th {
  padding: 0.5rem 1rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--app-text-secondary);
  text-align: right;
  white-space: nowrap;
  border-top: 1px solid var(--app-border);
  border-bottom: 1px solid var(--app-border);
}

.compare-th-name {
  text-align: left;
}

.compare-td {
  padding: 0.75rem 1rem;
  white-space: nowrap;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text);
}

tbody tr:last-child .compare-td {
  border-bottom: none;
}

.compare-row-current {
  background: var(--app-surface-hover);
}

.compare-td-name {
  text-align: left;
}

.compare-name {
  font-weight: 500;
}

.compare-pill {
  margin-left: 0.5rem;
  font-size: 0.6875rem;
}

.compare-num {
  text-align: right;
  font-family: var(--font-num);
  font-variant-numeric: tabular-nums;
}

.compare-best {
  margin-left: 0.5rem;
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--app-accent);
}

.compare-best .pi {
  font-size: 0.5625rem;
}

.compare-footnote {
  margin: 0;
  padding: 0.625rem 1.25rem 0.875rem;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
  border-top: 1px solid var(--app-border);
}
</style>

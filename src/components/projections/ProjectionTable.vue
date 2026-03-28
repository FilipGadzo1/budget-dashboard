<script setup lang="ts">
import type { ProjectionRow } from '@/models'

defineProps<{
  rows: ProjectionRow[]
  formatCurrency: (n: number) => string
}>()
</script>

<template>
  <div class="mt-6 overflow-x-auto rounded-lg border border-app">
    <table class="data-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Income</th>
          <th>Expenses</th>
          <th>Net</th>
          <th>Cumulative Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.monthKey">
          <td class="font-medium">{{ row.monthLabel }}</td>
          <td class="tabular-nums">{{ formatCurrency(row.income) }}</td>
          <td class="tabular-nums">{{ formatCurrency(row.expenses) }}</td>
          <td class="tabular-nums" :class="row.net >= 0 ? 'text-positive' : 'text-negative'">{{ formatCurrency(row.net) }}</td>
          <td class="tabular-nums" :class="row.cumulativeBalance >= 0 ? '' : 'text-negative'">{{ formatCurrency(row.cumulativeBalance) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

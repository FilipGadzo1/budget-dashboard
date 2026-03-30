<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import TrendChart from '@/components/dashboard/TrendChart.vue'
import MilestonesCard from '@/components/dashboard/MilestonesCard.vue'
import { useCurrency } from '@/composables/useCurrency'
import {
  buildProjectionMilestones,
  buildProjectionRows,
  buildProjectionSummary,
  buildProjectionTrendPath,
  calculateBreakEvenGap,
} from '@/services/projectionService'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'

const router = useRouter()
const projectionStore = useProjectionStore()
const uiStore = useUiStore()
const { formatCurrency, formatCompactCurrency, locale, selectedMonth } = useCurrency()

const projectionRows = computed(() =>
  buildProjectionRows(projectionStore.inputs, selectedMonth.value, locale.value),
)
const summary = computed(() => buildProjectionSummary(projectionRows.value))
const milestones = computed(() => buildProjectionMilestones(projectionRows.value))
const monthlyNet = computed(() => projectionStore.inputs.monthlyIncome - projectionStore.inputs.monthlyExpenses)
const breakEvenGap = computed(() => calculateBreakEvenGap(projectionStore.inputs))
const trendPath = computed(() => buildProjectionTrendPath(projectionRows.value, 400, 140))
const trendFillPath = computed(() =>
  trendPath.value ? `${trendPath.value} L 390 140 L 10 140 Z` : '',
)

const statusPill = computed(() => {
  const noData = projectionStore.inputs.monthlyIncome === 0 && projectionStore.inputs.monthlyExpenses === 0
  if (noData) return { label: 'No data', tone: '' }
  if (monthlyNet.value < 0) return { label: 'Deficit', tone: 'status-pill-negative' }
  if (summary.value.endingBalance >= 10000) return { label: 'Strong', tone: 'status-pill-positive' }
  return { label: 'On track', tone: 'status-pill-positive' }
})

const kpis = computed(() => [
  { label: 'Monthly Net', value: formatCurrency(monthlyNet.value), tone: monthlyNet.value >= 0 ? 'text-positive' : 'text-negative' },
  { label: 'Total Income', value: formatCompactCurrency(summary.value.totalIncome), tone: 'text-positive' },
  { label: 'Total Expenses', value: formatCompactCurrency(summary.value.totalExpenses), tone: 'text-primary' },
  { label: 'Ending Balance', value: formatCompactCurrency(summary.value.endingBalance), tone: summary.value.endingBalance >= 0 ? 'text-positive' : 'text-negative' },
])

const insights = computed(() => {
  const list: Array<{ title: string; body: string; tone: 'positive' | 'warning' }> = []
  const noData = projectionStore.inputs.monthlyIncome === 0 && projectionStore.inputs.monthlyExpenses === 0
  if (noData) {
    list.push({
      title: 'No data yet',
      body: 'Add your monthly income and expenses on the Projections page to see your financial forecast.',
      tone: 'warning',
    })
  } else if (monthlyNet.value < 0) {
    list.push({
      title: 'Monthly deficit',
      body: `Expenses exceed income by ${formatCurrency(breakEvenGap.value)} per month. Consider reducing costs or increasing revenue.`,
      tone: 'warning',
    })
  } else {
    list.push({
      title: 'Cash-flow positive',
      body: 'Your income covers expenses each month, building a reserve over time.',
      tone: 'positive',
    })
  }
  if (summary.value.endingBalance >= 10000) {
    list.push({
      title: 'Strong ending balance',
      body: 'The projection builds a healthy reserve by the end of the horizon.',
      tone: 'positive',
    })
  }
  return list
})
</script>

<template>
  <div>
    <div class="page-header">
      <div class="flex items-center gap-3">
        <h1 class="page-title">Dashboard</h1>
        <span class="status-pill" :class="statusPill.tone">
          <span class="status-pill-dot" />
          {{ statusPill.label }}
        </span>
      </div>
      <p class="page-description">
        Overview of your {{ projectionStore.inputs.months }}-month projection starting {{ projectionRows[0]?.monthLabel ?? 'N/A' }}
      </p>
    </div>

    <!-- KPI Grid -->
    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <article v-for="kpi in kpis" :key="kpi.label" class="kpi-card">
        <p class="text-label">{{ kpi.label }}</p>
        <p class="kpi-value" :class="kpi.tone">{{ kpi.value }}</p>
      </article>
    </div>

    <!-- Trend + Insights -->
    <div class="mt-4 grid gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <TrendChart
        :trend-path="trendPath"
        :trend-fill-path="trendFillPath"
        :rows="projectionRows"
        :peak-balance="milestones.highestBalance"
        :ending-balance="summary.endingBalance"
        :format-currency="formatCurrency"
      />

      <div class="flex flex-col gap-4">
        <article
          v-for="insight in insights"
          :key="insight.title"
          class="insight-card hidden sm:block"
          :class="insight.tone === 'warning' ? 'insight-warning' : 'insight-positive'"
        >
          <p class="text-sm font-semibold text-primary">{{ insight.title }}</p>
          <p class="text-body mt-1">{{ insight.body }}</p>
        </article>

        <MilestonesCard
          :first-negative-month-label="milestones.firstNegativeMonthLabel"
          :highest-balance-month-label="milestones.highestBalanceMonthLabel"
          :saved-scenarios-count="projectionStore.savedScenarios.length"
        />

        <div class="flex gap-3">
          <button class="btn btn-primary flex-1" @click="router.push('/projections')">
            <i class="pi pi-calculator text-sm" /> Edit plan
          </button>
          <button class="btn btn-secondary flex-1" @click="router.push('/scenarios')">
            <i class="pi pi-bookmark text-sm" /> Scenarios
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

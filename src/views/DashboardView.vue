<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

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
const { formatCurrency, formatCompactCurrency, locale } = useCurrency()

const projectionRows = computed(() =>
  buildProjectionRows(projectionStore.inputs, uiStore.selectedMonth, locale.value),
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
  if (monthlyNet.value < 0) {
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
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="kpi in kpis" :key="kpi.label" class="kpi-card">
        <p class="text-label">{{ kpi.label }}</p>
        <p class="kpi-value" :class="kpi.tone">{{ kpi.value }}</p>
      </article>
    </div>

    <!-- Trend + Insights -->
    <div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <!-- Trend chart -->
      <div class="card">
        <p class="text-label mb-1">Balance trend</p>
        <p class="text-heading">Cumulative balance over time</p>
        <p class="text-body mt-1 mb-4">How your projected balance evolves across the selected horizon.</p>
        <div class="trend-chart-wrap">
          <svg viewBox="0 0 400 140" class="w-full" role="img" aria-label="Balance trend line">
            <defs>
              <linearGradient id="trend-g" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="var(--app-accent)" />
                <stop offset="100%" stop-color="var(--app-accent)" stop-opacity="0.5" />
              </linearGradient>
              <linearGradient id="trend-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="var(--app-accent)" stop-opacity="0.15" />
                <stop offset="100%" stop-color="var(--app-accent)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path v-if="trendFillPath" :d="trendFillPath" fill="url(#trend-fill)" />
            <path v-if="trendPath" :d="trendPath" fill="none" stroke="url(#trend-g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p class="text-label">Start</p>
            <p class="mt-1 text-sm font-semibold tabular-nums" style="color: var(--app-text)">{{ projectionRows[0]?.monthLabel ?? 'N/A' }}</p>
          </div>
          <div>
            <p class="text-label">Peak balance</p>
            <p class="mt-1 text-sm font-semibold tabular-nums text-positive">{{ formatCurrency(milestones.highestBalance) }}</p>
          </div>
          <div>
            <p class="text-label">Ending</p>
            <p class="mt-1 text-sm font-semibold tabular-nums" :class="summary.endingBalance >= 0 ? 'text-positive' : 'text-negative'">{{ formatCurrency(summary.endingBalance) }}</p>
          </div>
        </div>
      </div>

      <!-- Insights -->
      <div class="flex flex-col gap-4">
        <article
          v-for="insight in insights"
          :key="insight.title"
          class="insight-card"
          :class="insight.tone === 'warning' ? 'insight-warning' : 'insight-positive'"
        >
          <p class="text-sm font-semibold" style="color: var(--app-text)">{{ insight.title }}</p>
          <p class="text-body mt-1">{{ insight.body }}</p>
        </article>

        <!-- Milestones -->
        <div class="card">
          <p class="text-label mb-3">Milestones</p>
          <div class="flex flex-col gap-3">
            <div class="flex justify-between items-center">
              <span class="text-body">First negative month</span>
              <span class="text-sm font-semibold tabular-nums" style="color: var(--app-text)">
                {{ milestones.firstNegativeMonthLabel ?? 'Never' }}
              </span>
            </div>
            <div style="height: 1px; background: var(--app-border);" />
            <div class="flex justify-between items-center">
              <span class="text-body">Peak balance month</span>
              <span class="text-sm font-semibold tabular-nums" style="color: var(--app-text)">
                {{ milestones.highestBalanceMonthLabel ?? 'N/A' }}
              </span>
            </div>
            <div style="height: 1px; background: var(--app-border);" />
            <div class="flex justify-between items-center">
              <span class="text-body">Saved scenarios</span>
              <span class="text-sm font-semibold tabular-nums" style="color: var(--app-text)">
                {{ projectionStore.savedScenarios.length }}
              </span>
            </div>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="flex gap-3">
          <button class="btn btn-primary flex-1" @click="router.push('/projections')">
            <i class="pi pi-calculator text-sm" />
            Edit plan
          </button>
          <button class="btn btn-secondary flex-1" @click="router.push('/scenarios')">
            <i class="pi pi-bookmark text-sm" />
            Scenarios
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

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
import type { ProjectionInputs } from '@/models'
import { useProjectionStore } from '@/stores/projection'
import { useSavingsStore } from '@/stores/savings'
import { useUiStore } from '@/stores/ui'

const router = useRouter()
const projectionStore = useProjectionStore()
const savingsStore = useSavingsStore()
const uiStore = useUiStore()
const { formatCurrency, formatCompactCurrency, locale, selectedMonth } = useCurrency()

// Effective inputs include monthly savings contributions as an additional expense.
// When expense items are active, buildProjectionRows ignores monthlyExpenses and uses
// expenseItems sum instead — so we inject savings as a synthetic item in that case.
const effectiveInputs = computed((): ProjectionInputs => {
  const savings = savingsStore.totalMonthlyContributions
  if (savings === 0) return projectionStore.inputs
  const base = projectionStore.inputs
  if (base.expenseItems.length > 0) {
    return {
      ...base,
      expenseItems: [
        ...base.expenseItems,
        { id: '__savings__', name: 'Savings contributions', amount: savings, sortOrder: 9999 },
      ],
    }
  }
  return { ...base, monthlyExpenses: base.monthlyExpenses + savings }
})

const projectionRows = computed(() =>
  buildProjectionRows(effectiveInputs.value, selectedMonth.value, locale.value),
)
const summary = computed(() => buildProjectionSummary(projectionRows.value))
const milestones = computed(() => buildProjectionMilestones(projectionRows.value))
const monthlyNet = computed(() => effectiveInputs.value.monthlyIncome - effectiveInputs.value.monthlyExpenses)
const breakEvenGap = computed(() => calculateBreakEvenGap(effectiveInputs.value))
const trendPath = computed(() => buildProjectionTrendPath(projectionRows.value, 400, 140))
const trendFillPath = computed(() =>
  trendPath.value ? `${trendPath.value} L 390 140 L 10 140 Z` : '',
)

const statusPill = computed(() => {
  const noData = projectionStore.inputs.monthlyIncome === 0 && effectiveInputs.value.monthlyExpenses === 0
  if (noData) return { label: 'No data', tone: '' }
  if (monthlyNet.value < 0) return { label: 'Deficit', tone: 'status-pill-negative' }
  if (summary.value.endingBalance >= 10000) return { label: 'Strong', tone: 'status-pill-positive' }
  return { label: 'On track', tone: 'status-pill-positive' }
})

const kpis = computed(() => [
  { label: 'Total Income', shortLabel: 'Income', value: formatCompactCurrency(summary.value.totalIncome), tone: 'text-positive' },
  { label: 'Total Expenses', shortLabel: 'Expenses', value: formatCompactCurrency(summary.value.totalExpenses), tone: 'text-primary' },
  { label: 'Ending Balance', shortLabel: 'Ending Bal.', value: formatCompactCurrency(summary.value.endingBalance), tone: summary.value.endingBalance >= 0 ? 'text-positive' : 'text-negative' },
])

const insights = computed(() => {
  const list: Array<{ title: string; body: string; tone: 'positive' | 'warning' }> = []
  const noData = projectionStore.inputs.monthlyIncome === 0 && effectiveInputs.value.monthlyExpenses === 0
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

    <!-- Mobile hero zone -->
    <div class="mobile-hero">
      <div class="mobile-hero-label">Net this month</div>
      <div class="mobile-hero-amount" :class="{ 'mobile-hero-amount--negative': monthlyNet < 0 }">
        {{ formatCurrency(monthlyNet) }}
      </div>
    </div>

    <!-- KPI Grid -->
    <div class="kpi-grid">
      <article v-for="kpi in kpis" :key="kpi.label" class="kpi-card">
        <p class="text-label kpi-label-full">{{ kpi.label }}</p>
        <p class="text-label kpi-label-short">{{ kpi.shortLabel }}</p>
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
          class="insight-card sm:block"
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

<style scoped>
/* Short labels hidden on desktop, full labels shown */
.kpi-label-short { display: none; }
.kpi-label-full  { display: block; }

/* KPI grid — desktop: 3 columns */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 0;
}

/* Hide hero on desktop */
.mobile-hero {
  display: none;
}

/* ── Tablet (641–1023px): 3 columns, still enough space ─────────────── */
@media (max-width: 1023px) {
  .mobile-hero {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1.25rem 1.5rem;
    border-radius: 16px;
    background: var(--mobile-hero-gradient);
    border: 1px solid var(--app-border);
    margin-bottom: 1.25rem;
  }

  .mobile-hero-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--app-text-tertiary);
    font-family: 'DM Sans', sans-serif;
  }

  .mobile-hero-amount {
    font-size: 1.75rem;
    font-weight: 400;
    letter-spacing: -0.02em;
    color: var(--app-positive);
    font-family: 'DM Mono', monospace;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-hero-amount--negative {
    color: var(--app-negative);
  }
}

/* ── Small phones (≤ 480px): 2-column grid, 3rd card spans both ─────── */
@media (max-width: 480px) {
  .kpi-label-full  { display: none; }
  .kpi-label-short { display: block; }

  .kpi-grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  /* Third card (Ending Balance) spans full width */
  .kpi-grid .kpi-card:last-child {
    grid-column: 1 / -1;
  }
}
</style>

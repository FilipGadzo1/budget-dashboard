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

// Effective inputs — savings contributions merged as additional expense
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

const statusPill = computed(() => {
  const noData = projectionStore.inputs.monthlyIncome === 0 && effectiveInputs.value.monthlyExpenses === 0
  if (noData) return { label: 'No data', tone: '' }
  if (monthlyNet.value < 0) return { label: 'Deficit', tone: 'status-pill-negative' }
  if (summary.value.endingBalance >= 10000) return { label: 'Strong', tone: 'status-pill-positive' }
  return { label: 'On track', tone: 'status-pill-positive' }
})

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
  <div class="dash-page">

    <!-- ── Header ────────────────────────────────────────────────── -->
    <div class="dash-header">
      <div>
        <div class="dash-title-row">
          <h1 class="page-title">Dashboard</h1>
          <span class="status-pill" :class="statusPill.tone">
            <span class="status-pill-dot" />
            {{ statusPill.label }}
          </span>
        </div>
        <p class="dash-subtitle">
          {{ projectionStore.inputs.months }}-month projection · {{ projectionRows[0]?.monthLabel ?? 'N/A' }} → {{ projectionRows.at(-1)?.monthLabel ?? 'N/A' }}
        </p>
      </div>
      <div class="dash-header-actions">
        <button class="btn btn-primary btn-sm" @click="router.push('/projections')">
          <i class="pi pi-calculator text-sm" /> Edit plan
        </button>
        <button class="btn btn-secondary btn-sm" @click="router.push('/scenarios')">
          <i class="pi pi-bookmark text-sm" /> Scenarios
        </button>
      </div>
    </div>

    <!-- ── Mobile hero ────────────────────────────────────────────── -->
    <div class="mobile-hero">
      <div class="mobile-hero-label">Net this month</div>
      <div class="mobile-hero-amount" :class="{ 'mobile-hero-amount--negative': monthlyNet < 0 }">
        {{ formatCurrency(monthlyNet) }}
      </div>
    </div>

    <!-- ── Summary strip ─────────────────────────────────────────── -->
    <div class="card card-sm dash-summary">
      <div class="dash-summary-items">
        <div class="dash-summary-item dash-summary-item-desktop">
          <span class="dash-summary-label">Monthly Net</span>
          <span class="dash-summary-value" :class="monthlyNet >= 0 ? 'text-positive' : 'text-negative'">
            {{ formatCurrency(monthlyNet) }}/mo
          </span>
        </div>
        <div class="dash-summary-sep dash-summary-sep-desktop" />
        <div class="dash-summary-item">
          <span class="dash-summary-label">Total Income</span>
          <span class="dash-summary-value text-positive">{{ formatCompactCurrency(summary.totalIncome) }}</span>
        </div>
        <div class="dash-summary-sep" />
        <div class="dash-summary-item">
          <span class="dash-summary-label">Total Expenses</span>
          <span class="dash-summary-value">{{ formatCompactCurrency(summary.totalExpenses) }}</span>
        </div>
        <div class="dash-summary-sep" />
        <div class="dash-summary-item">
          <span class="dash-summary-label">Ending Balance</span>
          <span class="dash-summary-value" :class="summary.endingBalance >= 0 ? 'text-positive' : 'text-negative'">
            {{ formatCompactCurrency(summary.endingBalance) }}
          </span>
        </div>
      </div>
    </div>

    <!-- ── Chart + right column ───────────────────────────────────── -->
    <div class="dash-main-grid">

      <TrendChart
        :rows="projectionRows"
        :peak-balance="milestones.highestBalance"
        :ending-balance="summary.endingBalance"
        :format-currency="formatCurrency"
      />

      <div class="dash-right-col">

        <!-- Insights -->
        <article
          v-for="insight in insights"
          :key="insight.title"
          class="insight-card"
          :class="insight.tone === 'warning' ? 'insight-warning' : 'insight-positive'"
        >
          <p class="text-sm font-semibold text-primary">{{ insight.title }}</p>
          <p class="text-body mt-1">{{ insight.body }}</p>
        </article>

        <!-- Milestones -->
        <MilestonesCard
          :first-negative-month-label="milestones.firstNegativeMonthLabel"
          :highest-balance-month-label="milestones.highestBalanceMonthLabel"
          :saved-scenarios-count="projectionStore.savedScenarios.length"
        />

      </div>
    </div>

  </div>
</template>

<style scoped>
.dash-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ─── Header ──────────────────────────────────────────────────── */
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.dash-title-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
}

.dash-subtitle {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
  margin: 0.2rem 0 0;
}

.dash-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  padding-top: 0.25rem;
}

/* ─── Summary strip ───────────────────────────────────────────── */
.dash-summary-items {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
}

.dash-summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem 1.5rem 0.25rem 0;
  flex: 1;
  min-width: 110px;
}

.dash-summary-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.dash-summary-value {
  font-size: 1.125rem;
  font-weight: 400;
  color: var(--app-text);
  font-family: 'DM Mono', monospace;
}

.dash-summary-sep {
  width: 1px;
  height: 2.5rem;
  background: var(--app-border);
  margin: 0 1.5rem 0 0;
  flex-shrink: 0;
}

/* ─── Main grid ───────────────────────────────────────────────── */
.dash-main-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  align-items: start;
}

.dash-right-col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ─── Mobile hero ─────────────────────────────────────────────── */
.mobile-hero {
  display: none;
}

/* ─── Mobile (≤ 1023px) ───────────────────────────────────────── */
@media (max-width: 1023px) {
  .mobile-hero {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1.25rem 1.5rem;
    border-radius: 16px;
    background: var(--mobile-hero-gradient);
    border: 1px solid var(--app-border);
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

  /* Hide Monthly Net from strip on mobile (shown in hero) */
  .dash-summary-item-desktop {
    display: none;
  }

  .dash-summary-sep-desktop {
    display: none;
  }

  /* 2-column grid for the 3 remaining items */
  .dash-summary-items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .dash-summary-sep {
    display: none;
  }

  .dash-summary-item {
    padding: 0;
    min-width: 0;
    flex: none;
  }

  /* Last item (Ending Balance) spans full width */
  .dash-summary-items > :last-child {
    grid-column: 1 / -1;
  }

  .dash-summary-value {
    font-size: 1rem;
  }

  /* Stack chart and right column */
  .dash-main-grid {
    grid-template-columns: 1fr;
  }

  /* Header actions become smaller / wrap */
  .dash-header-actions {
    flex-wrap: wrap;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue'

import MoneyFlow from '@/components/shared/MoneyFlow.vue'

// Where a typical month's income goes: one bar split into spending, the transfer
// to savings, and what is left in cash. When more goes out than comes in, the
// bar is scaled to the outflow and a marker shows where the income runs out.
//
// Colours: spending is neutral (it is the baseline, not a series to compare),
// savings uses --chart-2 (the same blue as "to savings" in the forecast table)
// and the remainder uses --chart-1.

const props = defineProps<{
  /** Monthly figures, all in the display currency. */
  income: number
  expenses: number
  toSavings: number
  formatCurrency: (n: number) => string
  /** One-line legend and no subtitle, for a short strip. */
  compact?: boolean
}>()

const outflow = computed(() => props.expenses + props.toSavings)
const left = computed(() => props.income - outflow.value)
const short = computed(() => left.value < 0)
const scale = computed(() => Math.max(props.income, outflow.value))
const pct = (value: number): number => (scale.value > 0 ? (Math.max(0, value) / scale.value) * 100 : 0)

const segments = computed(() => [
  { key: 'spending', label: 'Spending', value: props.expenses, width: pct(props.expenses) },
  { key: 'savings', label: 'To savings', value: props.toSavings, width: pct(props.toSavings) },
  { key: 'left', label: 'Left in cash', value: Math.max(0, left.value), width: pct(left.value) },
])

const empty = computed(() => scale.value <= 0)

const summary = computed(() =>
  empty.value
    ? 'No income or expenses yet.'
    : `Of ${props.formatCurrency(props.income)} a month: ${props.formatCurrency(props.expenses)} spending, ${props.formatCurrency(props.toSavings)} to savings, ${
        short.value
          ? `${props.formatCurrency(-left.value)} short`
          : `${props.formatCurrency(left.value)} left in cash`
      }.`,
)
</script>

<template>
  <section class="card flow-card" :class="{ 'flow-compact': compact }" aria-labelledby="flow-title">
    <div class="flow-head">
      <div>
        <h2 id="flow-title" class="card-title">Where a typical month goes</h2>
        <p class="flow-sub">
          <template v-if="empty">Add income and expenses below to see the split.</template>
          <template v-else-if="short">
            <span class="text-negative">{{ formatCurrency(-left) }} more goes out than comes in.</span>
          </template>
          <template v-else>
            <MoneyFlow :value="income" /> comes in each month.
          </template>
        </p>
      </div>
    </div>

    <div class="flow-bar" role="img" :aria-label="summary">
      <template v-if="!empty">
        <div
          v-for="segment in segments"
          :key="segment.key"
          class="flow-seg"
          :class="`flow-seg-${segment.key}`"
          :style="{ width: `${segment.width}%` }"
        />
        <!-- Where the income runs out, when spending and savings exceed it -->
        <span v-if="short" class="flow-marker" :style="{ left: `${pct(income)}%` }" aria-hidden="true" />
      </template>
    </div>

    <dl class="flow-legend">
      <div v-for="segment in segments" :key="segment.key" class="flow-item">
        <dt>
          <span class="flow-key" :class="`flow-seg-${segment.key}`" aria-hidden="true" />
          {{ segment.label }}
        </dt>
        <dd>
          <MoneyFlow :value="segment.value" />
          <span v-if="!empty && income > 0" class="flow-share">{{ Math.round((segment.value / income) * 100) }}%</span>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.flow-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.125rem;
}

.flow-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--app-text);
}

.flow-sub {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

/* ── Bar ─────────────────────────────────────────────────────── */
.flow-bar {
  position: relative;
  display: flex;
  gap: 2px;
  height: 2.75rem;
  border-radius: 0.875rem;
  background: var(--app-surface-hover);
  overflow: hidden;
}

.flow-seg {
  height: 100%;
  min-width: 0;
  transition: width 0.5s var(--ease-out);
}

.flow-seg-spending { background: var(--app-text-tertiary); }
.flow-seg-savings  { background: var(--chart-2); }
.flow-seg-left     { background: var(--chart-1); }

.flow-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--app-negative);
  box-shadow: 0 0 0 1px var(--app-surface);
}

/* ── Legend ──────────────────────────────────────────────────── */
.flow-legend {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin: 0;
}

.flow-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.flow-item dt {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--app-text-secondary);
}

.flow-key {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 2px;
  flex-shrink: 0;
}

.flow-item dd {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
  font-size: 1rem;
  font-weight: 550;
  letter-spacing: -0.01em;
  color: var(--app-text);
}

.flow-share {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--app-text-secondary);
}

/* Compact: a strip along the bottom of the Overview */
.flow-compact {
  justify-content: flex-start;
  gap: 0.75rem;
}

.flow-compact .flow-sub {
  display: none;
}

.flow-compact .flow-bar {
  height: 2.25rem;
  flex: none;
}

.flow-compact .flow-legend {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.125rem 1.25rem;
}

.flow-compact .flow-item {
  gap: 0.5rem;
}

.flow-compact .flow-item dt,
.flow-compact .flow-item dd {
  font-size: 0.8125rem;
}

.flow-compact .flow-share {
  display: none;
}
</style>

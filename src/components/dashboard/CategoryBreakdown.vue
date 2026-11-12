<script setup lang="ts">
import { computed } from 'vue'

// Ranked bars: one measure (monthly spending) across categories, so a single hue
// carries magnitude and the labels carry identity. Values sit beside each bar in
// text colour; the bar is never the only place a number can be read.

const props = defineProps<{
  entries: Array<{ category: string; amount: number }>
  formatCurrency: (n: number) => string
}>()

const MAX_ROWS = 6

const total = computed(() => props.entries.reduce((sum, e) => sum + e.amount, 0))

// Largest categories first; anything beyond the limit folds into one "Other" row
// so the list stays scannable.
const rows = computed(() => {
  const shown = props.entries.slice(0, MAX_ROWS)
  const rest = props.entries.slice(MAX_ROWS)
  const list = rest.length
    ? [
        ...shown,
        {
          category: `Other (${rest.length} more)`,
          amount: rest.reduce((sum, e) => sum + e.amount, 0),
        },
      ]
    : shown
  const largest = Math.max(...list.map((e) => e.amount), 0)

  return list.map((e) => ({
    ...e,
    share: total.value > 0 ? Math.round((e.amount / total.value) * 100) : 0,
    width: largest > 0 ? Math.max(2, (e.amount / largest) * 100) : 0,
  }))
})
</script>

<template>
  <div class="card category-card">
    <div class="category-header">
      <p class="text-label">Spending by category</p>
      <span class="category-total">{{ formatCurrency(total) }}/mo</span>
    </div>

    <ul class="category-list">
      <li
        v-for="row in rows"
        :key="row.category"
        class="category-row"
        :title="`${row.category}: ${formatCurrency(row.amount)} a month, ${row.share}% of spending`"
      >
        <div class="category-row-head">
          <span class="category-name">{{ row.category }}</span>
          <span class="category-value">
            {{ formatCurrency(row.amount) }}
            <span class="category-share">{{ row.share }}%</span>
          </span>
        </div>
        <div class="category-track" aria-hidden="true">
          <div class="category-bar" :style="{ width: `${row.width}%` }" />
        </div>
      </li>
    </ul>

    <p class="category-note">Average per month. Yearly and quarterly items are spread evenly.</p>
  </div>
</template>

<style scoped>
.category-card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.category-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.category-total {
  font-family: 'DM Mono', monospace;
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.category-row {
  display: flex;
  flex-direction: column;
  gap: 0.3125rem;
  padding: 0.25rem 0.375rem;
  margin: 0 -0.375rem;
  border-radius: 0.375rem;
  transition: background 0.12s ease;
}

.category-row:hover {
  background: var(--app-surface-hover);
}

.category-row-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.category-name {
  font-size: 0.8125rem;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-value {
  flex-shrink: 0;
  font-family: 'DM Mono', monospace;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--app-text);
}

.category-share {
  display: inline-block;
  min-width: 2.25rem;
  text-align: right;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.category-track {
  height: 6px;
  border-radius: 3px;
  background: var(--app-border);
}

.category-bar {
  height: 100%;
  border-radius: 3px;
  background: var(--app-accent);
  transition: width 0.25s ease;
}

.category-note {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--app-text-tertiary);
}
</style>

<script setup lang="ts">
import { computed } from 'vue'

import type { ProjectionRow } from '@/models'
import { formatShortMonth } from '@/utils/date'

// One cell per month, shaded by that month's net: the darker, the more was left
// (red when the month ends short). A dot marks a month with a one-off change.
// Clicking a cell makes it the month the whole app is looking at.

const props = defineProps<{
  rows: ProjectionRow[]
  /** Index of the month being looked at. */
  focusIndex: number
  locale: string
  formatCurrency: (n: number) => string
}>()

defineEmits<{ select: [index: number] }>()

const largest = computed(() => Math.max(1, ...props.rows.map((r) => Math.abs(r.net))))

const cells = computed(() =>
  props.rows.map((row, index) => {
    const short = formatShortMonth(row.monthKey, props.locale)
    return {
      index,
      key: row.monthKey,
      initial: short.charAt(0),
      // A new year is worth a marker so long plans stay readable
      newYear: index > 0 && row.monthKey.endsWith('-01'),
      negative: row.net < 0,
      strength: Math.round(16 + 64 * (Math.abs(row.net) / largest.value)),
      marked: row.incomeAdjustment !== 0 || row.expenseAdjustment !== 0,
      title: `${row.monthLabel}: ${row.net >= 0 ? '+' : ''}${props.formatCurrency(row.net)}${
        row.incomeAdjustment !== 0 || row.expenseAdjustment !== 0 ? ', includes a one-off change' : ''
      }`,
    }
  }),
)
</script>

<template>
  <div class="strip" role="group" aria-label="Months of the forecast">
    <button
      v-for="cell in cells"
      :key="cell.key"
      class="strip-cell"
      :class="{
        'strip-cell-on': cell.index === focusIndex,
        'strip-cell-neg': cell.negative,
        'strip-cell-year': cell.newYear,
      }"
      :style="{ '--strength': `${cell.strength}%` }"
      :title="cell.title"
      :aria-label="cell.title"
      :aria-pressed="cell.index === focusIndex"
      @click="$emit('select', cell.index)"
    >
      <span v-if="rows.length <= 36" aria-hidden="true">{{ cell.initial }}</span>
      <i v-if="cell.marked" class="strip-dot" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 3px;
}

.strip-cell {
  position: relative;
  height: 2.25rem;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: color-mix(in srgb, var(--app-positive) var(--strength), transparent);
  color: var(--app-text);
  font: inherit;
  font-size: 0.6875rem;
  font-weight: 550;
  cursor: pointer;
  transition: transform 0.12s ease;
}

.strip-cell-neg {
  background: color-mix(in srgb, var(--app-negative) var(--strength), transparent);
}

/* A little air before each January */
.strip-cell-year {
  margin-left: 4px;
}

.strip-cell:hover {
  transform: translateY(-2px);
}

.strip-cell-on {
  outline: 2px solid var(--app-text);
  outline-offset: 1px;
}

.strip-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--app-warning);
}

/* Phone: the cells are too narrow for a letter; the shade and the tooltip remain */
@media (max-width: 639px) {
  .strip {
    gap: 2px;
  }

  .strip-cell span {
    display: none;
  }

  .strip-cell-year {
    margin-left: 3px;
  }
}
</style>

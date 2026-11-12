<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { ProjectionRow } from '@/models'
import { labelStride, linePath, niceScale } from '@/services/chartService'

// Two views of the same months:
//   balance — cash over time (plus net worth when the budget has savings), lines
//   monthly — income against expenses each month, paired columns
// Both have a single y-axis, a hover/keyboard readout for every month, and use
// the two validated series colours (--chart-1 / --chart-2).

const props = defineProps<{
  rows: ProjectionRow[]
  peakBalance: number
  endingBalance: number
  formatCurrency: (n: number) => string
  formatCompactCurrency: (n: number) => string
  locale: string
  /** Draw the net-worth line alongside cash (only meaningful with savings). */
  showNetWorth?: boolean
}>()

type ViewMode = 'balance' | 'monthly'
const viewMode = ref<ViewMode>('balance')

// ── Size: drawn at real pixel size so text stays crisp and constant ──────────
const wrap = ref<HTMLElement | null>(null)
const width = ref(560)
const HEIGHT = 220
const MARGIN = { top: 12, right: 12, bottom: 26, left: 52 }

let observer: ResizeObserver | undefined
onMounted(() => {
  if (!wrap.value) return
  width.value = wrap.value.clientWidth || width.value
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver((entries) => {
    const next = entries[0]?.contentRect.width
    if (next) width.value = next
  })
  observer.observe(wrap.value)
})
onBeforeUnmount(() => observer?.disconnect())

const plotW = computed(() => Math.max(40, width.value - MARGIN.left - MARGIN.right))
const plotH = HEIGHT - MARGIN.top - MARGIN.bottom
const count = computed(() => props.rows.length)
const slotW = computed(() => plotW.value / Math.max(1, count.value))
const xCenter = (i: number): number => MARGIN.left + (i + 0.5) * slotW.value

// ── Series ───────────────────────────────────────────────────────────────────
const series = computed(() =>
  viewMode.value === 'balance'
    ? [
        { key: 'cash', label: 'Cash', color: 'var(--chart-1)', values: props.rows.map((r) => r.cumulativeBalance) },
        ...(props.showNetWorth
          ? [{ key: 'netWorth', label: 'Net worth', color: 'var(--chart-2)', values: props.rows.map((r) => r.netWorth) }]
          : []),
      ]
    : [
        { key: 'income', label: 'Income', color: 'var(--chart-1)', values: props.rows.map((r) => r.income) },
        { key: 'expenses', label: 'Expenses', color: 'var(--chart-2)', values: props.rows.map((r) => r.expenses) },
      ],
)

const scale = computed(() => niceScale(series.value.flatMap((s) => s.values)))
const y = (value: number): number => {
  const { min, max } = scale.value
  return MARGIN.top + plotH - ((value - min) / (max - min)) * plotH
}
const zeroY = computed(() => y(0))

// ── Lines (balance view) ─────────────────────────────────────────────────────
const lines = computed(() =>
  series.value.map((s) => ({
    ...s,
    path: linePath(s.values.map((v, i) => ({ x: xCenter(i), y: y(v) }))),
  })),
)

// Soft wash under the cash line, down to the zero line
const cashArea = computed(() => {
  const cash = lines.value[0]
  if (!cash || count.value < 2) return ''
  const first = xCenter(0).toFixed(2)
  const last = xCenter(count.value - 1).toFixed(2)
  return `${cash.path} L ${last} ${zeroY.value.toFixed(2)} L ${first} ${zeroY.value.toFixed(2)} Z`
})

// ── Columns (monthly view): income and expenses side by side ────────────────
const columns = computed(() => {
  const gap = 2
  const barW = Math.max(2, Math.min(24, (slotW.value - gap) / 2 - 2))
  return props.rows.map((row, i) => {
    const cx = xCenter(i)
    const bar = (value: number, x: number) => {
      const top = y(Math.max(0, value))
      return { x, y: top, width: barW, height: Math.max(0, zeroY.value - top) }
    }
    return {
      income: bar(row.income, cx - gap / 2 - barW),
      expenses: bar(row.expenses, cx + gap / 2),
    }
  })
})

// Column with a 4px rounded top and a square base on the baseline
const columnPath = (b: { x: number; y: number; width: number; height: number }): string => {
  if (b.height <= 0) return ''
  const r = Math.min(4, b.width / 2, b.height)
  const bottom = b.y + b.height
  return `M ${b.x} ${bottom} V ${b.y + r} Q ${b.x} ${b.y} ${b.x + r} ${b.y} H ${b.x + b.width - r} Q ${b.x + b.width} ${b.y} ${b.x + b.width} ${b.y + r} V ${bottom} Z`
}

// ── Axis labels ──────────────────────────────────────────────────────────────
const xLabels = computed(() => {
  const stride = labelStride(count.value, plotW.value)
  return props.rows
    .map((row, i) => {
      const [year, month] = row.monthKey.split('-').map(Number)
      const date = new Date(year, (month ?? 1) - 1, 1)
      const name = date.toLocaleDateString(props.locale, { month: 'short' })
      // Name the year where it changes, and on the first label
      const withYear = i === 0 || month === 1
      return { i, x: xCenter(i), text: withYear ? `${name} ’${String(year).slice(2)}` : name }
    })
    .filter((label) => label.i % stride === 0)
})

// ── Hover / keyboard readout ────────────────────────────────────────────────
const activeIndex = ref<number | null>(null)

const indexAt = (clientX: number): number | null => {
  if (!wrap.value || !count.value) return null
  const x = clientX - wrap.value.getBoundingClientRect().left - MARGIN.left
  return Math.min(count.value - 1, Math.max(0, Math.floor(x / slotW.value)))
}

const onPointerMove = (event: PointerEvent): void => { activeIndex.value = indexAt(event.clientX) }
const clearActive = (): void => { activeIndex.value = null }

const onKeydown = (event: KeyboardEvent): void => {
  if (!count.value) return
  const current = activeIndex.value ?? -1
  if (event.key === 'ArrowRight') activeIndex.value = Math.min(count.value - 1, current + 1)
  else if (event.key === 'ArrowLeft') activeIndex.value = Math.max(0, current - 1)
  else if (event.key === 'Home') activeIndex.value = 0
  else if (event.key === 'End') activeIndex.value = count.value - 1
  else if (event.key === 'Escape') activeIndex.value = null
  else return
  event.preventDefault()
}

const onFocus = (): void => { if (activeIndex.value === null && count.value) activeIndex.value = 0 }

const activeRow = computed(() => (activeIndex.value === null ? null : props.rows[activeIndex.value] ?? null))

// One readout, every figure for that month
const readout = computed(() => {
  const row = activeRow.value
  if (!row) return []
  return viewMode.value === 'balance'
    ? [
        { label: 'Cash', value: row.cumulativeBalance, color: 'var(--chart-1)' },
        ...(props.showNetWorth ? [{ label: 'Net worth', value: row.netWorth, color: 'var(--chart-2)' }] : []),
        { label: 'Net this month', value: row.net, color: null },
      ]
    : [
        { label: 'Income', value: row.income, color: 'var(--chart-1)' },
        { label: 'Expenses', value: row.expenses, color: 'var(--chart-2)' },
        { label: 'Net', value: row.net, color: null },
        ...(row.savingsContribution > 0 ? [{ label: 'To savings', value: row.savingsContribution, color: null }] : []),
      ]
})

const TOOLTIP_W = 176
// Sits beside the crosshair, flipping to the left near the right edge
const tooltipStyle = computed(() => {
  if (activeIndex.value === null) return {}
  const x = xCenter(activeIndex.value)
  const flip = x + 12 + TOOLTIP_W > width.value
  // Never slide over the y-axis labels on narrow screens
  const left = flip ? Math.max(MARGIN.left, x - 12 - TOOLTIP_W) : x + 12
  return { left: `${left}px`, width: `${TOOLTIP_W}px` }
})

const summaryLabel = computed(() => {
  const first = props.rows[0]
  const last = props.rows.at(-1)
  if (!first || !last) return 'No projection data'
  return viewMode.value === 'balance'
    ? `Cash balance from ${first.monthLabel} to ${last.monthLabel}, ending at ${props.formatCurrency(last.cumulativeBalance)}. Use the arrow keys to read each month.`
    : `Income and expenses for each month from ${first.monthLabel} to ${last.monthLabel}. Use the arrow keys to read each month.`
})
</script>

<template>
  <div class="chart-card card">

    <!-- Header -->
    <div class="chart-header">
      <p class="text-label">{{ viewMode === 'balance' ? 'Balance over time' : 'Income and expenses' }}</p>
      <div class="chart-toggle" role="group" aria-label="Chart view">
        <button
          class="chart-toggle-btn"
          :class="{ 'chart-toggle-active': viewMode === 'balance' }"
          :aria-pressed="viewMode === 'balance'"
          @click="viewMode = 'balance'"
        >
          Balance
        </button>
        <button
          class="chart-toggle-btn"
          :class="{ 'chart-toggle-active': viewMode === 'monthly' }"
          :aria-pressed="viewMode === 'monthly'"
          @click="viewMode = 'monthly'"
        >
          Monthly
        </button>
      </div>
    </div>

    <!-- Legend: only when there is more than one series to tell apart -->
    <div v-if="series.length > 1" class="chart-legend">
      <span v-for="s in series" :key="s.key" class="chart-legend-item">
        <span
          class="chart-legend-key"
          :class="{
            'chart-legend-key-line': viewMode === 'balance',
            'chart-legend-key-dashed': viewMode === 'balance' && s.key === 'netWorth',
          }"
          :style="{ '--key': s.color }"
        />
        {{ s.label }}
      </span>
    </div>

    <!-- Chart -->
    <div ref="wrap" class="chart-wrap">
      <svg
        :width="width"
        :height="HEIGHT"
        :viewBox="`0 0 ${width} ${HEIGHT}`"
        class="chart-svg"
        role="img"
        tabindex="0"
        :aria-label="summaryLabel"
        @pointermove="onPointerMove"
        @pointerleave="clearActive"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="clearActive"
      >
        <!-- Gridlines + y labels -->
        <g>
          <template v-for="tick in scale.ticks" :key="tick">
            <line
              :x1="MARGIN.left"
              :x2="width - MARGIN.right"
              :y1="y(tick)"
              :y2="y(tick)"
              class="chart-grid"
              :class="{ 'chart-grid-zero': tick === 0 }"
            />
            <text :x="MARGIN.left - 8" :y="y(tick)" class="chart-axis-text" text-anchor="end" dominant-baseline="middle">
              {{ formatCompactCurrency(tick) }}
            </text>
          </template>
        </g>

        <!-- X labels -->
        <text
          v-for="label in xLabels"
          :key="label.i"
          :x="label.x"
          :y="HEIGHT - 8"
          class="chart-axis-text"
          text-anchor="middle"
        >{{ label.text }}</text>

        <!-- Balance: lines -->
        <g v-if="viewMode === 'balance'">
          <path v-if="cashArea" :d="cashArea" fill="var(--chart-1)" opacity="0.1" />
          <path
            v-for="line in lines"
            :key="line.key"
            :d="line.path"
            fill="none"
            :stroke="line.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="line.key === 'netWorth' ? '6 4' : undefined"
          />
        </g>

        <!-- Monthly: paired columns -->
        <g v-else>
          <template v-for="(col, i) in columns" :key="i">
            <path :d="columnPath(col.income)" fill="var(--chart-1)" :opacity="activeIndex === null || activeIndex === i ? 1 : 0.55" />
            <path :d="columnPath(col.expenses)" fill="var(--chart-2)" :opacity="activeIndex === null || activeIndex === i ? 1 : 0.55" />
          </template>
        </g>

        <!-- Crosshair + markers for the month being read -->
        <g v-if="activeIndex !== null">
          <line
            :x1="xCenter(activeIndex)"
            :x2="xCenter(activeIndex)"
            :y1="MARGIN.top"
            :y2="MARGIN.top + plotH"
            class="chart-crosshair"
          />
          <template v-if="viewMode === 'balance'">
            <circle
              v-for="line in lines"
              :key="line.key"
              :cx="xCenter(activeIndex)"
              :cy="y(line.values[activeIndex] ?? 0)"
              r="4"
              :fill="line.color"
              class="chart-marker"
            />
          </template>
        </g>
      </svg>

      <!-- Readout -->
      <div v-if="activeRow" class="chart-tooltip" :style="tooltipStyle" role="status" aria-live="polite">
        <p class="chart-tooltip-title">{{ activeRow.monthLabel }}</p>
        <div v-for="item in readout" :key="item.label" class="chart-tooltip-row">
          <span class="chart-tooltip-label">
            <span v-if="item.color" class="chart-tooltip-key" :style="{ background: item.color }" />
            {{ item.label }}
          </span>
          <span class="chart-tooltip-value">{{ formatCurrency(item.value) }}</span>
        </div>
      </div>
    </div>

    <!-- Footer stats -->
    <div class="chart-stats">
      <div class="chart-stat">
        <span class="chart-stat-label">Start</span>
        <span class="chart-stat-value">{{ rows[0]?.monthLabel ?? 'N/A' }}</span>
      </div>
      <div class="chart-stat">
        <span class="chart-stat-label">Peak cash</span>
        <span class="chart-stat-value">{{ formatCurrency(peakBalance) }}</span>
      </div>
      <div class="chart-stat">
        <span class="chart-stat-label">Ending cash</span>
        <span
          class="chart-stat-value"
          :class="{ 'text-negative': endingBalance < 0 }"
        >{{ formatCurrency(endingBalance) }}</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
.chart-card {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ─── Header ──────────────────────────────────────────────────── */
.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

/* ─── Toggle ──────────────────────────────────────────────────── */
.chart-toggle {
  display: flex;
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 100px;
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.chart-toggle-btn {
  font-size: 0.6875rem;
  font-weight: 500;
  font-family: inherit;
  padding: 0.25rem 0.75rem;
  border-radius: 100px;
  border: none;
  background: none;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
  white-space: nowrap;
  line-height: 1.4;
}

.chart-toggle-active {
  background: var(--app-surface);
  color: var(--app-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

/* ─── Legend ──────────────────────────────────────────────────── */
.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin-bottom: 0.5rem;
}

.chart-legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

/* Key mirrors the mark: a square for columns, a stroke for lines */
.chart-legend-key {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--key);
  flex-shrink: 0;
}

.chart-legend-key-line {
  width: 16px;
  height: 2px;
  border-radius: 1px;
}

.chart-legend-key-dashed {
  background: repeating-linear-gradient(90deg, var(--key) 0 5px, transparent 5px 8px);
}

/* ─── Plot ────────────────────────────────────────────────────── */
.chart-wrap {
  position: relative;
  width: 100%;
}

.chart-svg {
  display: block;
  max-width: 100%;
  touch-action: pan-y;
  border-radius: 0.375rem;
}

.chart-svg:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 2px;
}

.chart-grid {
  stroke: var(--chart-grid);
  stroke-width: 1;
  shape-rendering: crispEdges;
}

/* The zero line is the baseline the reader measures from */
.chart-grid-zero {
  stroke: var(--app-border-strong);
}

.chart-axis-text {
  font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
  font-size: 11px;
  fill: var(--app-text-secondary);
  font-variant-numeric: tabular-nums;
}

.chart-crosshair {
  stroke: var(--app-border-strong);
  stroke-width: 1;
  shape-rendering: crispEdges;
  pointer-events: none;
}

/* Ring in the surface colour keeps the marker legible where lines cross */
.chart-marker {
  stroke: var(--app-surface);
  stroke-width: 2;
  pointer-events: none;
}

/* ─── Readout ─────────────────────────────────────────────────── */
.chart-tooltip {
  position: absolute;
  top: 8px;
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
  border: 1px solid var(--app-border);
  background: var(--app-surface);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  pointer-events: none;
  z-index: 2;
}

.chart-tooltip-title {
  margin: 0 0 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--app-text-secondary);
}

.chart-tooltip-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  line-height: 1.5;
}

.chart-tooltip-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.chart-tooltip-key {
  width: 10px;
  height: 2px;
  border-radius: 1px;
  flex-shrink: 0;
}

.chart-tooltip-value {
  font-family: 'DM Mono', monospace;
  font-size: 0.75rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--app-text);
  white-space: nowrap;
}

/* ─── Footer stats ────────────────────────────────────────────── */
.chart-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-top: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--app-border);
}

.chart-stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.chart-stat-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--app-text-secondary);
}

.chart-stat-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--app-text);
  font-family: 'DM Mono', monospace;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

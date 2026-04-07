<script setup lang="ts">
import { computed, ref } from 'vue'

import { buildProjectionTrendPath } from '@/services/projectionService'
import type { ProjectionRow } from '@/models'

const props = defineProps<{
  rows: ProjectionRow[]
  peakBalance: number
  endingBalance: number
  formatCurrency: (n: number) => string
}>()

type ViewMode = 'cumulative' | 'monthly'
const viewMode = ref<ViewMode>('cumulative')

// ── Cumulative view ────────────────────────────────────────────
const SVG_W = 400
const SVG_H = 140
const PAD = 10

const trendPath = computed(() => buildProjectionTrendPath(props.rows, SVG_W, SVG_H))
const trendFillPath = computed(() =>
  trendPath.value ? `${trendPath.value} L ${SVG_W - PAD} ${SVG_H} L ${PAD} ${SVG_H} Z` : '',
)

// ── Monthly bar view ───────────────────────────────────────────
const LABEL_H = 16  // px reserved at bottom for month labels
const BAR_TOP = PAD
const BAR_BOTTOM = SVG_H - LABEL_H - 4

const monthlyBars = computed(() => {
  if (!props.rows.length) return []
  const maxVal = Math.max(...props.rows.map((r) => Math.max(r.income, r.expenses)), 1)
  const availW = SVG_W - PAD * 2
  const availH = BAR_BOTTOM - BAR_TOP
  const n = props.rows.length
  const slotW = availW / n
  const gap = Math.max(1, slotW * 0.15)
  const groupW = Math.max(3, slotW - gap)
  const incW = groupW
  const expW = Math.max(2, groupW * 0.6)

  return props.rows.map((row, i) => {
    const slotX = PAD + i * slotW
    const cx = slotX + slotW / 2

    const incH = Math.max(1.5, (row.income / maxVal) * availH)
    const expH = Math.max(1.5, (row.expenses / maxVal) * availH)
    const surplus = row.net >= 0

    // Month abbreviation — 3 chars
    const label = row.monthLabel.slice(0, 3)

    return {
      // Income bar (background, full width)
      incX: cx - incW / 2,
      incY: BAR_BOTTOM - incH,
      incW,
      incH,
      // Expense bar (foreground, narrower, centered)
      expX: cx - expW / 2,
      expY: BAR_BOTTOM - expH,
      expW,
      expH,
      surplus,
      label,
      labelX: cx,
      labelY: SVG_H - 2,
    }
  })
})
</script>

<template>
  <div class="chart-card card">

    <!-- Header -->
    <div class="chart-header">
      <p class="text-label">Balance trend</p>
      <div class="chart-toggle">
        <button
          class="chart-toggle-btn"
          :class="{ 'chart-toggle-active': viewMode === 'cumulative' }"
          @click="viewMode = 'cumulative'"
        >
          Cumulative
        </button>
        <button
          class="chart-toggle-btn"
          :class="{ 'chart-toggle-active': viewMode === 'monthly' }"
          @click="viewMode = 'monthly'"
        >
          Monthly
        </button>
      </div>
    </div>

    <!-- SVG chart -->
    <div class="chart-svg-wrap">
      <svg
        :viewBox="`0 0 ${SVG_W} ${SVG_H}`"
        class="chart-svg"
        role="img"
        :aria-label="`Balance ${viewMode} chart`"
      >
        <defs>
          <linearGradient id="trend-g" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="var(--app-accent)" />
            <stop offset="100%" stop-color="var(--app-accent)" stop-opacity="0.5" />
          </linearGradient>
          <linearGradient id="trend-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--app-accent)" stop-opacity="0.12" />
            <stop offset="100%" stop-color="var(--app-accent)" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Cumulative line chart -->
        <g v-if="viewMode === 'cumulative'">
          <path v-if="trendFillPath" :d="trendFillPath" fill="url(#trend-fill)" />
          <path
            v-if="trendPath"
            :d="trendPath"
            fill="none"
            stroke="url(#trend-g)"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>

        <!-- Monthly bar chart: income (bg) vs expenses (fg) -->
        <g v-else>
          <!-- Baseline -->
          <line
            :x1="PAD"
            :y1="BAR_BOTTOM"
            :x2="SVG_W - PAD"
            :y2="BAR_BOTTOM"
            stroke="var(--app-border)"
            stroke-width="1"
          />
          <template v-for="(bar, i) in monthlyBars" :key="i">
            <!-- Income bar (background) -->
            <rect
              :x="bar.incX"
              :y="bar.incY"
              :width="bar.incW"
              :height="bar.incH"
              fill="var(--app-positive)"
              opacity="0.18"
              rx="2"
            />
            <!-- Expense bar (foreground) -->
            <rect
              :x="bar.expX"
              :y="bar.expY"
              :width="bar.expW"
              :height="bar.expH"
              fill="var(--app-negative)"
              opacity="0.72"
              rx="2"
            />
            <!-- Month label -->
            <text
              :x="bar.labelX"
              :y="bar.labelY"
              text-anchor="middle"
              font-size="7.5"
              fill="var(--app-text-secondary)"
              font-family="'DM Sans', sans-serif"
            >{{ bar.label }}</text>
          </template>
        </g>
      </svg>
    </div>

    <!-- Monthly legend -->
    <div v-if="viewMode === 'monthly'" class="chart-legend">
      <span class="chart-legend-item">
        <span class="chart-legend-dot chart-legend-dot-income" />
        Income
      </span>
      <span class="chart-legend-item">
        <span class="chart-legend-dot chart-legend-dot-expense" />
        Expenses
      </span>
    </div>

    <!-- Footer stats -->
    <div class="chart-stats">
      <div class="chart-stat">
        <span class="chart-stat-label">Start</span>
        <span class="chart-stat-value">{{ rows[0]?.monthLabel ?? 'N/A' }}</span>
      </div>
      <div class="chart-stat">
        <span class="chart-stat-label">Peak balance</span>
        <span class="chart-stat-value text-positive">{{ formatCurrency(peakBalance) }}</span>
      </div>
      <div class="chart-stat">
        <span class="chart-stat-label">Ending</span>
        <span
          class="chart-stat-value"
          :class="endingBalance >= 0 ? 'text-positive' : 'text-negative'"
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
  margin-bottom: 1rem;
}

/* ─── Toggle ──────────────────────────────────────────────────── */
.chart-toggle {
  display: flex;
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 100px;
  padding: 2px;
  gap: 2px;
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
  gap: 1rem;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}

.chart-legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: var(--app-text-secondary);
}

.chart-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.chart-legend-dot-income {
  background: var(--app-positive);
  opacity: 0.55;
}

.chart-legend-dot-expense {
  background: var(--app-negative);
  opacity: 0.72;
}

/* ─── SVG ─────────────────────────────────────────────────────── */
.chart-svg-wrap {
  width: 100%;
}

.chart-svg {
  width: 100%;
  display: block;
}

/* ─── Footer stats ────────────────────────────────────────────── */
.chart-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--app-border);
}

.chart-stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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
}
</style>

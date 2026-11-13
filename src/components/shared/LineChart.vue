<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'

import { labelStride, linePath, niceScale } from '@/services/chartService'

// The app's one line chart: any number of series over the months of the
// forecast, with a y-axis, a hover readout and a marker on the month the app is
// looking at. It fills whatever space its container gives it (width and height),
// so it can sit in a full-height page without a fixed size.
//
// Clicking a month, or using the arrow keys while the chart has focus, selects
// that month for the whole app (the `select` event).

export interface ChartSeries {
  key: string
  label: string
  color: string
  /** One value per month; may be shorter than the month list. */
  values: number[]
  dashed?: boolean
  /** A reference line (e.g. the saved plan): thinner, dotted, no marker. */
  ghost?: boolean
  /** Soft wash under the line, down to zero. */
  area?: boolean
}

const props = defineProps<{
  monthKeys: string[]
  monthLabels: string[]
  series: ChartSeries[]
  formatCurrency: (n: number) => string
  formatCompact: (n: number) => string
  locale: string
  /** Month the app is looking at; null hides the marker. */
  focusIndex?: number | null
  /** What the chart shows, for screen readers. */
  label: string
}>()

const emit = defineEmits<{ select: [index: number] }>()

const uid = useId()
const clipId = `chart-reveal-${uid}`
const fillId = `chart-fill-${uid}`

// ── Size: drawn at real pixel size so text stays crisp ───────────────────────
const wrap = ref<HTMLElement | null>(null)
const width = ref(600)
const height = ref(260)
const MARGIN = { top: 12, right: 14, bottom: 26, left: 54 }

let observer: ResizeObserver | undefined
onMounted(() => {
  if (!wrap.value) return
  width.value = wrap.value.clientWidth || width.value
  height.value = wrap.value.clientHeight || height.value
  if (typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect?.width) width.value = rect.width
    if (rect?.height) height.value = rect.height
  })
  observer.observe(wrap.value)
})
onBeforeUnmount(() => observer?.disconnect())

const count = computed(() => props.monthKeys.length)
const plotW = computed(() => Math.max(40, width.value - MARGIN.left - MARGIN.right))
const plotH = computed(() => Math.max(40, height.value - MARGIN.top - MARGIN.bottom))
const x = (i: number): number => MARGIN.left + plotW.value * (count.value > 1 ? i / (count.value - 1) : 0.5)

const scale = computed(() => niceScale(props.series.flatMap((s) => s.values)))
const y = (value: number): number => {
  const { min, max } = scale.value
  return MARGIN.top + plotH.value - ((value - min) / (max - min)) * plotH.value
}

const lines = computed(() =>
  props.series.map((s) => {
    const values = s.values.slice(0, count.value)
    return { ...s, values, path: linePath(values.map((v, i) => ({ x: x(i), y: y(v) }))) }
  }),
)

const area = computed(() => {
  const first = lines.value.find((l) => l.area)
  if (!first || first.values.length < 2) return null
  const end = x(first.values.length - 1).toFixed(2)
  const zero = y(0).toFixed(2)
  return { color: first.color, path: `${first.path} L ${end} ${zero} L ${x(0).toFixed(2)} ${zero} Z` }
})

const xLabels = computed(() => {
  const stride = labelStride(count.value, plotW.value, 56)
  return props.monthKeys
    .map((key, i) => {
      const [year, month] = key.split('-').map(Number)
      const name = new Date(year, (month ?? 1) - 1, 1).toLocaleDateString(props.locale, { month: 'short' })
      return { i, x: x(i), text: i === 0 || month === 1 ? `${name} ’${String(year).slice(2)}` : name }
    })
    .filter((l) => l.i % stride === 0)
})

// ── Hover readout ────────────────────────────────────────────────────────────
const hoverIndex = ref<number | null>(null)

const indexAt = (clientX: number): number | null => {
  if (!wrap.value || !count.value) return null
  const px = clientX - wrap.value.getBoundingClientRect().left - MARGIN.left
  const ratio = count.value > 1 ? px / plotW.value : 0
  return Math.min(count.value - 1, Math.max(0, Math.round(ratio * (count.value - 1))))
}

const onPointerMove = (event: PointerEvent): void => { hoverIndex.value = indexAt(event.clientX) }
const onClick = (event: MouseEvent): void => {
  const index = indexAt(event.clientX)
  if (index !== null) emit('select', index)
}

// The arrow keys walk through the months, which is the same as clicking each one
const onKeydown = (event: KeyboardEvent): void => {
  if (!count.value) return
  const current = props.focusIndex ?? count.value - 1
  let next: number
  if (event.key === 'ArrowRight') next = Math.min(count.value - 1, current + 1)
  else if (event.key === 'ArrowLeft') next = Math.max(0, current - 1)
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = count.value - 1
  else return
  event.preventDefault()
  emit('select', next)
}

const readout = computed(() => {
  const i = hoverIndex.value
  if (i === null) return null
  return {
    title: props.monthLabels[i] ?? '',
    rows: lines.value.filter((l) => i < l.values.length).map((l) => ({ label: l.label, color: l.color, value: l.values[i] })),
  }
})

const TOOLTIP_W = 190
const tooltipStyle = computed(() => {
  if (hoverIndex.value === null) return {}
  const px = x(hoverIndex.value)
  const flip = px + 12 + TOOLTIP_W > width.value
  return { left: `${flip ? Math.max(MARGIN.left, px - 12 - TOOLTIP_W) : px + 12}px`, width: `${TOOLTIP_W}px` }
})

const marker = computed(() => {
  const i = props.focusIndex
  if (i === null || i === undefined || i < 0 || i >= count.value) return null
  return { x: x(i), dots: lines.value.filter((l) => !l.ghost && i < l.values.length).map((l) => ({ key: l.key, y: y(l.values[i]), color: l.color })) }
})
</script>

<template>
  <div class="lc">
    <div v-if="series.length > 1 || $slots.aside" class="lc-top">
      <div class="lc-legend">
        <span v-for="s in series" :key="s.key" class="lc-legend-item">
          <span class="lc-key" :class="{ 'lc-key-dashed': s.dashed || s.ghost }" :style="{ '--key': s.color }" />
          {{ s.label }}
        </span>
      </div>
      <slot name="aside" />
    </div>

    <div ref="wrap" class="lc-wrap">
      <svg
        v-if="count"
        :width="width"
        :height="height"
        class="lc-svg"
        role="img"
        tabindex="0"
        :aria-label="`${label}. Use the arrow keys to move through the months.`"
        @pointermove="onPointerMove"
        @pointerleave="hoverIndex = null"
        @click="onClick"
        @keydown="onKeydown"
      >
        <defs>
          <!-- The lines are drawn in from the left once, when the data first arrives -->
          <clipPath :id="clipId">
            <rect class="lc-reveal" :x="MARGIN.left - 4" y="0" :width="plotW + 8" :height="height" />
          </clipPath>
          <linearGradient v-if="area" :id="fillId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" :style="{ stopColor: area.color, stopOpacity: 0.26 }" />
            <stop offset="1" :style="{ stopColor: area.color, stopOpacity: 0 }" />
          </linearGradient>
        </defs>

        <template v-for="tick in scale.ticks" :key="tick">
          <line :x1="MARGIN.left" :x2="width - MARGIN.right" :y1="y(tick)" :y2="y(tick)" class="lc-grid" :class="{ 'lc-grid-zero': tick === 0 }" />
          <text :x="MARGIN.left - 8" :y="y(tick)" class="lc-axis" text-anchor="end" dominant-baseline="middle">{{ formatCompact(tick) }}</text>
        </template>
        <text v-for="l in xLabels" :key="l.i" :x="l.x" :y="height - 8" class="lc-axis" text-anchor="middle">{{ l.text }}</text>

        <g :clip-path="`url(#${clipId})`">
          <path v-if="area" :d="area.path" :fill="`url(#${fillId})`" />
          <path
            v-for="line in lines"
            :key="line.key"
            :d="line.path"
            fill="none"
            :stroke="line.color"
            :stroke-width="line.ghost ? 1.5 : 2.25"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-dasharray="line.ghost ? '2 5' : line.dashed ? '7 5' : undefined"
            :opacity="line.ghost ? 0.85 : 1"
          />
        </g>

        <!-- The month the app is looking at -->
        <g v-if="marker" class="lc-marker">
          <line :x1="marker.x" :x2="marker.x" :y1="MARGIN.top" :y2="MARGIN.top + plotH" class="lc-playhead" />
          <circle v-for="dot in marker.dots" :key="dot.key" :cx="marker.x" :cy="dot.y" r="4.5" :fill="dot.color" class="lc-dot" />
        </g>
        <line
          v-if="hoverIndex !== null"
          :x1="x(hoverIndex)"
          :x2="x(hoverIndex)"
          :y1="MARGIN.top"
          :y2="MARGIN.top + plotH"
          class="lc-crosshair"
        />
      </svg>
      <p v-else class="lc-empty">Nothing to chart yet.</p>

      <div v-if="readout" class="lc-tooltip" :style="tooltipStyle" aria-hidden="true">
        <p class="lc-tooltip-title">{{ readout.title }}</p>
        <div v-for="row in readout.rows" :key="row.label" class="lc-tooltip-row">
          <span><span class="lc-tooltip-key" :style="{ background: row.color }" />{{ row.label }}</span>
          <b>{{ formatCurrency(row.value) }}</b>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lc {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.lc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.lc-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.lc-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.lc-key {
  width: 16px;
  height: 2px;
  border-radius: 1px;
  background: var(--key);
}

.lc-key-dashed {
  background: repeating-linear-gradient(90deg, var(--key) 0 5px, transparent 5px 8px);
}

.lc-wrap {
  position: relative;
  flex: 1;
  min-height: 6.5rem;
  min-width: 0;
}

.lc-svg {
  position: absolute;
  inset: 0;
  display: block;
  cursor: crosshair;
  touch-action: pan-y;
  border-radius: 0.5rem;
}

.lc-svg:focus-visible {
  outline: 2px solid var(--app-accent);
  outline-offset: 2px;
}

.lc-grid {
  stroke: var(--app-border);
  stroke-width: 1;
  shape-rendering: crispEdges;
}

.lc-grid-zero {
  stroke: var(--app-border-strong);
}

.lc-axis {
  font-family: var(--font-sans);
  font-size: 11px;
  fill: var(--app-text-secondary);
}

.lc-reveal {
  transform-box: fill-box;
  transform-origin: left center;
  animation: lcReveal 1s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes lcReveal {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.lc-playhead {
  stroke: var(--app-text);
  stroke-width: 1;
  opacity: 0.55;
  shape-rendering: crispEdges;
}

.lc-dot {
  stroke: var(--app-surface);
  stroke-width: 2;
}

.lc-marker {
  pointer-events: none;
}

.lc-crosshair {
  stroke: var(--app-border-strong);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  pointer-events: none;
}

.lc-empty {
  display: grid;
  place-items: center;
  height: 100%;
  margin: 0;
  font-size: 0.875rem;
  color: var(--app-text-secondary);
}

.lc-tooltip {
  position: absolute;
  top: 6px;
  z-index: 2;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--app-border);
  border-radius: 0.625rem;
  background: var(--app-surface);
  box-shadow: var(--shadow-pop);
  pointer-events: none;
}

.lc-tooltip-title {
  margin: 0 0 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--app-text-secondary);
}

.lc-tooltip-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.lc-tooltip-row b {
  font-weight: 600;
  color: var(--app-text);
}

.lc-tooltip-key {
  display: inline-block;
  width: 10px;
  height: 2px;
  margin-right: 0.375rem;
  vertical-align: middle;
  border-radius: 1px;
}
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { categoryStyle } from '@/data/categories'

// Where a typical month's income goes, as a flow diagram: income on the left,
// a ribbon to each spending category, to savings and to what is left in cash.
// When more goes out than comes in, the income bar is shorter than the outflow
// and every ribbon is thinned on the income side to match.
//
// Every figure is also in the text labels beside the diagram, so the picture is
// never the only place a number can be read.

const props = defineProps<{
  /** Monthly figures, all in the display currency. */
  income: number
  categories: Array<{ category: string; amount: number }>
  /** Spending that is not itemised by category (plain monthly expenses). */
  expenses: number
  toSavings: number
  formatCurrency: (n: number) => string
}>()

const MAX_CATEGORIES = 6

const wrap = ref<HTMLElement | null>(null)
const width = ref(420)
const height = ref(360)

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

const left = computed(() => props.income - props.expenses - props.toSavings)

// Destinations, largest spending first
const nodes = computed(() => {
  const list: Array<{ key: string; label: string; value: number; color: string }> = []
  if (props.categories.length) {
    props.categories.slice(0, MAX_CATEGORIES).forEach((c) =>
      list.push({ key: c.category, label: c.category, value: c.amount, color: `hsl(${categoryStyle(c.category).hue} 65% 58%)` }),
    )
    const rest = props.categories.slice(MAX_CATEGORIES).reduce((sum, c) => sum + c.amount, 0)
    if (rest > 0) list.push({ key: '__other', label: 'Other spending', value: rest, color: 'var(--app-text-tertiary)' })
  } else if (props.expenses > 0) {
    list.push({ key: '__spending', label: 'Spending', value: props.expenses, color: 'var(--app-text-tertiary)' })
  }
  if (props.toSavings > 0) list.push({ key: '__savings', label: 'To savings', value: props.toSavings, color: 'var(--chart-2)' })
  if (left.value > 0) list.push({ key: '__left', label: 'Left in cash', value: left.value, color: 'var(--chart-1)' })
  return list
})

const GAP = 6
const BAR = 12
const layout = computed(() => {
  const out = nodes.value.reduce((sum, n) => sum + n.value, 0)
  if (!out || width.value < 200) return null
  const labelW = Math.min(170, width.value * 0.44)
  const x0 = 2
  const x1 = width.value - labelW - BAR
  const usable = Math.max(40, height.value - GAP * (nodes.value.length - 1) - 4)
  const k = usable / out
  // Thinner on the income side when income does not cover everything
  const sourceRatio = Math.min(1, props.income / out)
  const mid = (x0 + BAR + x1) / 2
  let ys = 2
  let yt = 2
  const ribbons = nodes.value.map((node) => {
    const h = Math.max(2, node.value * k)
    const sh = h * sourceRatio
    const path = `M${x0 + BAR} ${ys} C${mid} ${ys} ${mid} ${yt} ${x1} ${yt} L${x1} ${yt + h} C${mid} ${yt + h} ${mid} ${ys + sh} ${x0 + BAR} ${ys + sh} Z`
    const item = { ...node, path, y: yt, h, labelY: yt + h / 2 }
    ys += sh
    yt += h + GAP
    return item
  })
  return { x0, x1, sourceH: Math.max(2, ys - 2), ribbons }
})

const summary = computed(() =>
  `Of ${props.formatCurrency(props.income)} a month: ${nodes.value.map((n) => `${n.label} ${props.formatCurrency(n.value)}`).join(', ')}${
    left.value < 0 ? `, ${props.formatCurrency(-left.value)} short` : ''
  }.`,
)
</script>

<template>
  <div class="sankey">
    <p class="sankey-sub">
      <template v-if="left < 0">
        <span class="text-negative">{{ formatCurrency(-left) }} more goes out than comes in.</span>
      </template>
      <template v-else>{{ formatCurrency(income) }} comes in each month.</template>
    </p>
    <div ref="wrap" class="sankey-wrap">
      <svg v-if="layout" :width="width" :height="height" role="img" :aria-label="summary">
        <rect :x="layout.x0" y="2" :width="BAR" :height="layout.sourceH" rx="3" class="sankey-source" />
        <g v-for="ribbon in layout.ribbons" :key="ribbon.key">
          <path :d="ribbon.path" :fill="ribbon.color" opacity="0.3" />
          <rect :x="layout.x1" :y="ribbon.y" :width="BAR" :height="ribbon.h" rx="3" :fill="ribbon.color" />
          <text :x="layout.x1 + BAR + 8" :y="ribbon.labelY" dominant-baseline="middle" class="sankey-label">
            {{ ribbon.label }}
            <tspan class="sankey-value" dx="4">{{ formatCurrency(ribbon.value) }}</tspan>
          </text>
        </g>
      </svg>
      <p v-else class="sankey-empty">Add income and expenses to see where a month goes.</p>
    </div>
  </div>
</template>

<style scoped>
.sankey {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
}

.sankey-sub {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.sankey-wrap {
  position: relative;
  flex: 1;
  min-height: 14rem;
}

.sankey-wrap svg {
  position: absolute;
  inset: 0;
  display: block;
}

.sankey-source {
  fill: var(--app-text);
}

.sankey-label {
  font-family: var(--font-sans);
  font-size: 12px;
  fill: var(--app-text);
}

.sankey-value {
  fill: var(--app-text-secondary);
}

.sankey-empty {
  display: grid;
  place-items: center;
  height: 100%;
  margin: 0;
  font-size: 0.875rem;
  color: var(--app-text-secondary);
  text-align: center;
}
</style>

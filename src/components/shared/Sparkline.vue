<script setup lang="ts">
import { computed } from 'vue'

// A tiny trend line with no axes, for headline tiles. Decorative: the figure
// next to it carries the value.

const props = withDefaults(defineProps<{ values: number[]; color?: string }>(), { color: 'var(--chart-1)' })

const path = computed(() => {
  const v = props.values
  if (v.length < 2) return ''
  const lo = Math.min(...v)
  const span = Math.max(...v) - lo || 1
  return v
    .map((value, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * 100).toFixed(1)} ${(25 - ((value - lo) / span) * 23).toFixed(1)}`)
    .join(' ')
})
</script>

<template>
  <svg v-if="path" class="spark" viewBox="0 0 100 27" preserveAspectRatio="none" aria-hidden="true">
    <path :d="path" fill="none" :stroke="color" stroke-width="1.75" stroke-linecap="round" vector-effect="non-scaling-stroke" />
  </svg>
</template>

<style scoped>
.spark {
  display: block;
  width: 100%;
  height: 1.75rem;
}
</style>

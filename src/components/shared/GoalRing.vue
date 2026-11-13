<script setup lang="ts">
import { computed } from 'vue'

// A savings goal's progress as a ring with the percentage in the middle.
// Savings is --chart-2 everywhere; a finished goal turns to the positive colour.

const props = withDefaults(
  defineProps<{
    percent: number
    size?: number
    complete?: boolean
    label?: string
  }>(),
  { size: 64, complete: false, label: 'Progress' },
)

const stroke = computed(() => (props.size < 50 ? 5 : 7))
const radius = computed(() => (props.size - stroke.value) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const clamped = computed(() => Math.max(0, Math.min(100, props.percent)))
</script>

<template>
  <span
    class="goal-ring"
    :class="{ 'goal-ring-sm': size < 50 }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="progressbar"
    :aria-valuenow="clamped"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label"
  >
    <svg :width="size" :height="size" aria-hidden="true">
      <circle :cx="size / 2" :cy="size / 2" :r="radius" fill="none" class="goal-ring-track" :stroke-width="stroke" />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        class="goal-ring-fill"
        :class="{ 'goal-ring-done': complete }"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - clamped / 100)"
      />
    </svg>
    <span class="goal-ring-text">{{ Math.round(clamped) }}%</span>
  </span>
</template>

<style scoped>
.goal-ring {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}

.goal-ring svg {
  display: block;
  transform: rotate(-90deg);
}

.goal-ring-track {
  stroke: var(--app-surface-hover);
}

.goal-ring-fill {
  stroke: var(--chart-2);
  transition: stroke-dashoffset 0.4s var(--ease-out);
}

.goal-ring-done {
  stroke: var(--app-positive);
}

.goal-ring-text {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.8125rem;
  font-weight: 650;
  color: var(--app-text);
}

.goal-ring-sm .goal-ring-text {
  font-size: 0.625rem;
}
</style>

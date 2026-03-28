<script setup lang="ts">
import type { ProjectionRow } from '@/models'

defineProps<{
  trendPath: string
  trendFillPath: string
  rows: ProjectionRow[]
  peakBalance: number
  endingBalance: number
  formatCurrency: (n: number) => string
}>()
</script>

<template>
  <div class="card">
    <p class="text-label mb-3">Balance trend</p>

    <div class="trend-chart-wrap">
      <svg viewBox="0 0 400 140" class="w-full" role="img" aria-label="Balance trend line">
        <defs>
          <linearGradient id="trend-g" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="var(--app-accent)" />
            <stop offset="100%" stop-color="var(--app-accent)" stop-opacity="0.5" />
          </linearGradient>
          <linearGradient id="trend-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="var(--app-accent)" stop-opacity="0.15" />
            <stop offset="100%" stop-color="var(--app-accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path v-if="trendFillPath" :d="trendFillPath" fill="url(#trend-fill)" />
        <path v-if="trendPath" :d="trendPath" fill="none" stroke="url(#trend-g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <div class="mt-4 grid grid-cols-3 gap-4">
      <div>
        <p class="text-label">Start</p>
        <p class="mt-1 text-sm font-semibold tabular-nums text-primary">{{ rows[0]?.monthLabel ?? 'N/A' }}</p>
      </div>
      <div>
        <p class="text-label">Peak balance</p>
        <p class="mt-1 text-sm font-semibold tabular-nums text-positive">{{ formatCurrency(peakBalance) }}</p>
      </div>
      <div>
        <p class="text-label">Ending</p>
        <p class="mt-1 text-sm font-semibold tabular-nums" :class="endingBalance >= 0 ? 'text-positive' : 'text-negative'">
          {{ formatCurrency(endingBalance) }}
        </p>
      </div>
    </div>
  </div>
</template>

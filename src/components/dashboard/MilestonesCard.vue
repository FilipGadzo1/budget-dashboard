<script setup lang="ts">
defineProps<{
  firstNegativeMonthLabel: string | null
  highestBalanceMonthLabel: string | null
  savedScenariosCount: number
}>()
</script>

<template>
  <div class="card">
    <p class="text-label mb-3">Milestones</p>
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-body">First negative month</span>
        <span class="text-sm font-semibold tabular-nums text-primary">
          {{ firstNegativeMonthLabel ?? 'Never' }}
        </span>
      </div>
      <div class="divider" />
      <div class="flex items-center justify-between">
        <span class="text-body">Peak balance month</span>
        <span class="text-sm font-semibold tabular-nums text-primary">
          {{ highestBalanceMonthLabel ?? 'N/A' }}
        </span>
      </div>
      <div class="divider" />
      <div class="flex items-center justify-between">
        <span class="text-body">Saved scenarios</span>
        <span class="text-sm font-semibold tabular-nums text-primary">
          {{ savedScenariosCount }}
        </span>
      </div>
    </div>
  </div>
</template>

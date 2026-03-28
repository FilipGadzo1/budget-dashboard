<script setup lang="ts">
import type { ProjectionScenario } from '@/models'

defineProps<{
  scenario: ProjectionScenario
  isActive: boolean
  formatCurrency: (n: number) => string
}>()

defineEmits<{
  load: []
  rename: []
  delete: []
}>()
</script>

<template>
  <article
    class="scenario-card"
    :class="{ 'scenario-card-active': isActive }"
  >
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h3 class="truncate text-sm font-semibold text-primary">{{ scenario.name }}</h3>
        <span v-if="isActive" class="status-pill status-pill-positive text-xs">Active</span>
      </div>
      <p class="mt-1 text-xs tabular-nums text-secondary">
        {{ formatCurrency(scenario.inputs.monthlyIncome) }} income ·
        {{ formatCurrency(scenario.inputs.monthlyExpenses) }} expenses ·
        {{ scenario.inputs.months }}mo
      </p>
    </div>
    <div class="flex flex-shrink-0 gap-1.5">
      <button class="btn btn-primary btn-sm" @click="$emit('load')">Load</button>
      <button class="btn btn-ghost btn-sm" @click="$emit('rename')">Rename</button>
      <button class="btn btn-danger btn-sm" @click="$emit('delete')">Delete</button>
    </div>
  </article>
</template>

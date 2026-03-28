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
      <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-secondary">
        <span>{{ formatCurrency(scenario.inputs.monthlyIncome) }} in</span>
        <span>{{ formatCurrency(scenario.inputs.monthlyExpenses) }} out</span>
        <span>{{ scenario.inputs.months }}mo</span>
      </div>
    </div>
    <div class="flex gap-1.5 sm:flex-shrink-0">
      <button class="btn btn-primary btn-sm flex-1 sm:flex-none" @click="$emit('load')">Load</button>
      <button class="btn btn-secondary btn-sm flex-1 sm:flex-none" @click="$emit('rename')">Rename</button>
      <button class="btn btn-danger btn-sm flex-1 sm:flex-none" @click="$emit('delete')">Delete</button>
    </div>
  </article>
</template>

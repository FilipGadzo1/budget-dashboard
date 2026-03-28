<script setup lang="ts">
withDefaults(
  defineProps<{
    currencyCode: string
    rates: Array<{ code: string; rate: number }>
    rateDate: string | null
    loading: boolean
    error: string | null
    currencyLabel: (code: string) => string
    layout?: 'grid' | 'list'
  }>(),
  { layout: 'list' },
)
</script>

<template>
  <div v-if="loading" class="flex items-center gap-2 py-2 text-sm text-secondary">
    <i class="pi pi-spin pi-spinner" /> Loading rates…
  </div>
  <div v-else-if="error" class="flex items-center gap-2 py-2 text-sm text-secondary">
    <i class="pi pi-exclamation-triangle" /> {{ error }}
  </div>
  <template v-else>
    <p class="mb-3 text-sm text-secondary">1 {{ currencyCode }} ≈</p>
    <div :class="layout === 'grid' ? 'grid gap-3 sm:grid-cols-3' : 'flex flex-col gap-3'">
      <div
        v-for="rate in rates"
        :key="rate.code"
        class="flex items-center justify-between rounded-lg border border-app px-4 py-3"
        :class="layout === 'grid' ? 'bg-surface' : ''"
      >
        <span class="text-sm text-secondary">
          {{ currencyLabel(rate.code) }}<template v-if="layout === 'list'"> ({{ rate.code }})</template>
        </span>
        <span class="text-sm font-semibold tabular-nums text-primary">
          {{ rate.rate }}<template v-if="layout === 'grid'"> {{ rate.code }}</template>
        </span>
      </div>
    </div>
    <p v-if="rateDate" class="mt-3 text-xs text-secondary">
      <template v-if="layout === 'grid'">Updated {{ rateDate }}</template>
      <template v-else>Rates as of {{ rateDate }}. Source: European Central Bank.</template>
    </p>
  </template>
</template>

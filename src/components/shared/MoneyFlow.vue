<script setup lang="ts">
import NumberFlow, { type Format } from '@number-flow/vue'
import { computed } from 'vue'

import { useCurrency } from '@/composables/useCurrency'

// An amount whose digits roll to the new value when it changes (scenario load,
// currency switch, an edit). Formats exactly like useCurrency's formatCurrency /
// formatCompactCurrency. Use it for figures that change in response to the user
// (totals, table cells that recalculate); static text stays plain. Honours
// prefers-reduced-motion (NumberFlow's default).

const props = defineProps<{
  value: number
  /** Compact form (€5.9K) instead of the exact amount. */
  compact?: boolean
  /** Currency of the amount; defaults to the display currency. */
  currency?: string | null
  /** Always show the sign, so a gain reads "+€500". */
  signed?: boolean
  /** Text after the amount, e.g. "/mo". */
  suffix?: string
}>()

const { currencyCode, locale } = useCurrency()

const format = computed(
  (): Format => ({
    style: 'currency',
    currency: props.currency || currencyCode.value,
    ...(props.compact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { maximumFractionDigits: 2 }),
    ...(props.signed ? { signDisplay: 'always' } : {}),
  }),
)
</script>

<template>
  <NumberFlow :value="value" :format="format" :locales="locale" :suffix="suffix" />
</template>

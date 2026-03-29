<script setup lang="ts">
import { computed } from 'vue'

import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputNumber from 'primevue/inputnumber'

const props = defineProps<{
  modelValue: number | null
  currency: string
  locale: string
  inputId?: string
  disabled?: boolean
  invalid?: boolean
  fluid?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const currencySymbol = computed(() => {
  return (
    new Intl.NumberFormat(props.locale, {
      style: 'currency',
      currency: props.currency,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? props.currency
  )
})
</script>

<template>
  <InputGroup :class="{ 'w-full': fluid !== false }">
    <InputGroupAddon>{{ currencySymbol }}</InputGroupAddon>
    <InputNumber
      :model-value="modelValue"
      :input-id="inputId"
      mode="decimal"
      :min="0"
      :max="1_000_000_000"
      :min-fraction-digits="0"
      :max-fraction-digits="2"
      :use-grouping="true"
      :disabled="disabled"
      :class="{ 'app-input-invalid': invalid }"
      fluid
      @update:model-value="emit('update:modelValue', $event)"
    />
  </InputGroup>
</template>

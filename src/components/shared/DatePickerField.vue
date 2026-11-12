<script setup lang="ts">
import { computed } from 'vue'

import DatePicker from 'primevue/datepicker'

// The app's one calendar control: PrimeVue's DatePicker with a plain string model,
// so callers keep working with the same values the database stores.
//   mode="month" → 'YYYY-MM'      (pick a month from a year grid)
//   mode="date"  → 'YYYY-MM-DD'   (pick a day)
// An empty selection is ''.

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    mode?: 'month' | 'date'
    /** Earliest / latest selectable value, in the same format as the model. */
    min?: string | null
    max?: string | null
    inputId?: string
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    /** Show a Clear button — for optional fields. */
    clearable?: boolean
  }>(),
  { mode: 'month', clearable: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// Parsed as local time: `new Date('2026-03-01')` would be UTC and can land on the
// previous day (and month) in timezones behind UTC.
const toDate = (value?: string | null): Date | null => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month) return null
  return new Date(year, month - 1, day || 1)
}

const pad = (n: number): string => String(n).padStart(2, '0')

const fromDate = (date: Date): string =>
  props.mode === 'month'
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const value = computed({
  get: () => toDate(props.modelValue),
  set: (next: Date | Date[] | (Date | null)[] | null | undefined) => {
    emit('update:modelValue', next instanceof Date ? fromDate(next) : '')
  },
})

const minDate = computed(() => toDate(props.min) ?? undefined)

// A month limit means "any day in that month", so the upper bound is its last day
const maxDate = computed(() => {
  const date = toDate(props.max)
  if (!date) return undefined
  return props.mode === 'month' ? new Date(date.getFullYear(), date.getMonth() + 1, 0) : date
})
</script>

<template>
  <DatePicker
    v-model="value"
    :view="mode === 'month' ? 'month' : 'date'"
    :date-format="mode === 'month' ? 'MM yy' : 'd M yy'"
    :min-date="minDate"
    :max-date="maxDate"
    :input-id="inputId"
    :placeholder="placeholder ?? (mode === 'month' ? 'Pick a month' : 'Pick a date')"
    :disabled="disabled"
    :invalid="invalid"
    :show-button-bar="clearable"
    :manual-input="false"
    show-icon
    icon-display="input"
    fluid
  />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'

import CurrencyInput from '@/components/shared/CurrencyInput.vue'
import DatePickerField from '@/components/shared/DatePickerField.vue'
import DialogHeader from '@/components/shared/DialogHeader.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useExchangeRates } from '@/composables/useExchangeRates'
import { currencyOptions } from '@/data/defaults'
import type { SavingsGoal, SavingsGoalStatus } from '@/models'
import { buildErrorMap, savingsGoalSchema } from '@/validation/forms'

const props = defineProps<{
  visible: boolean
  goal?: SavingsGoal | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [data: {
    name: string
    emoji: string
    currency: string
    targetAmount: number
    monthlyContribution: number
    targetDate: string | null
    status: SavingsGoalStatus
    note: string | null
    /** Editing only: the currency changed and existing amounts should be converted. */
    convertAmounts: boolean
  }]
}>()

const { currencyCode, locale } = useCurrency()
const { getRate, fetchRates } = useExchangeRates()

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Completed', value: 'completed' },
]

const defaultForm = () => ({
  name: '',
  emoji: '🎯',
  currency: currencyCode.value,
  targetAmount: 0 as number | null,
  monthlyContribution: 0 as number | null,
  targetDate: '',
  status: 'active' as SavingsGoalStatus,
  note: '',
})

const form = reactive(defaultForm())
const errors = reactive<Record<string, string>>({})

const isEditing = computed(() => !!props.goal)

// ─── Changing the currency of an existing goal ────────────────────────────────
// Two different intentions, so the user picks:
//   convert — "show this goal in SEK from now on": every amount is converted
//   relabel — "I entered these numbers in SEK all along": numbers stay as typed
const currencyChangeMode = ref<'convert' | 'relabel'>('convert')

const originalCurrency = computed(() => props.goal?.currency ?? currencyCode.value)
const currencyChanged = computed(() => isEditing.value && form.currency !== originalCurrency.value)
const conversionRate = computed(() => getRate(originalCurrency.value, form.currency))
const willConvert = computed(() => currencyChanged.value && currencyChangeMode.value === 'convert')
const ratesMissing = computed(() => willConvert.value && conversionRate.value === null)

// Keep the two amount fields in step with the chosen currency and mode, so what
// is on screen is exactly what will be saved.
watch([() => form.currency, currencyChangeMode, conversionRate], () => {
  if (!props.visible || !props.goal) return
  const rate = willConvert.value ? conversionRate.value : 1
  if (rate === null) return
  form.targetAmount = Math.round(props.goal.targetAmount * rate * 100) / 100
  form.monthlyContribution = Math.round(props.goal.monthlyContribution * rate * 100) / 100
})
const title = computed(() => (isEditing.value ? 'Edit goal' : 'New goal'))

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    if (props.goal) {
      form.name = props.goal.name
      form.emoji = props.goal.emoji
      form.currency = props.goal.currency ?? currencyCode.value
      form.targetAmount = props.goal.targetAmount
      form.monthlyContribution = props.goal.monthlyContribution
      form.targetDate = props.goal.targetDate ?? ''
      form.status = props.goal.status
      form.note = props.goal.note ?? ''
    } else {
      Object.assign(form, defaultForm())
    }
    Object.keys(errors).forEach((k) => delete errors[k])
    currencyChangeMode.value = 'convert'
    void fetchRates()
  },
)

const handleSave = async (): Promise<void> => {
  Object.keys(errors).forEach((k) => delete errors[k])
  if (ratesMissing.value) return

  try {
    await savingsGoalSchema.validate(
      {
        name: form.name,
        targetAmount: form.targetAmount ?? 0,
        monthlyContribution: form.monthlyContribution ?? 0,
      },
      { abortEarly: false },
    )
  } catch (err) {
    Object.assign(errors, buildErrorMap(err))
    return
  }

  emit('save', {
    name: form.name.trim(),
    emoji: form.emoji.trim() || '🎯',
    currency: form.currency,
    targetAmount: form.targetAmount ?? 0,
    monthlyContribution: form.monthlyContribution ?? 0,
    targetDate: form.targetDate || null,
    status: form.status,
    note: form.note.trim() || null,
    convertAmounts: willConvert.value,
  })
  emit('update:visible', false)
}

const handleClose = (): void => {
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    :modal="true"
    dismissable-mask
    :draggable="false"
    :style="{ width: 'min(92vw, 30rem)' }"
    @update:visible="handleClose"
  >
    <template #header>
      <DialogHeader label="Savings" :title="title" />
    </template>

    <div class="savings-dialog-body">
      <!-- Name + Emoji row -->
      <div class="form-row-inline">
        <div class="form-field" style="width: 4.5rem; flex-shrink: 0;">
          <label class="form-label">Icon</label>
          <InputText
            v-model="form.emoji"
            maxlength="4"
            class="w-full text-center"
            placeholder="🎯"
          />
        </div>
        <div class="form-field" style="flex: 1;">
          <label class="form-label" for="sg-name">Goal name <span class="text-negative">*</span></label>
          <InputText
            id="sg-name"
            v-model="form.name"
            class="w-full"
            placeholder="e.g. Wedding fund, New car…"
            :class="{ 'p-invalid': errors.name }"
            maxlength="80"
          />
          <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
        </div>
      </div>

      <!-- Currency -->
      <div class="form-field">
        <label class="form-label" for="sg-currency">Currency</label>
        <select id="sg-currency" v-model="form.currency" class="form-select">
          <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>

        <div v-if="currencyChanged" class="currency-change">
          <label class="currency-change-option">
            <input v-model="currencyChangeMode" type="radio" value="convert" />
            <span>
              <strong>Convert the amounts</strong> from {{ originalCurrency }} to {{ form.currency }}
              <span class="form-hint">Target, monthly contribution, saved amount and all deposits are converted at today's rate.</span>
            </span>
          </label>
          <label class="currency-change-option">
            <input v-model="currencyChangeMode" type="radio" value="relabel" />
            <span>
              <strong>Keep the numbers</strong>, they were in {{ form.currency }} all along
              <span class="form-hint">Nothing is converted; only the currency label changes.</span>
            </span>
          </label>
          <p v-if="ratesMissing" class="form-error">
            Exchange rates are unavailable right now, so the amounts can't be converted. Try again shortly.
          </p>
        </div>
      </div>

      <!-- Target amount -->
      <div class="form-field">
        <label class="form-label" for="sg-target">Target amount <span class="text-negative">*</span></label>
        <CurrencyInput
          input-id="sg-target"
          v-model="form.targetAmount"
          :currency="form.currency"
          :locale="locale"
          :invalid="!!errors.targetAmount"
          fluid
        />
        <span v-if="errors.targetAmount" class="form-error">{{ errors.targetAmount }}</span>
      </div>

      <!-- Monthly contribution -->
      <div class="form-field">
        <label class="form-label" for="sg-contrib">Monthly contribution</label>
        <CurrencyInput
          input-id="sg-contrib"
          v-model="form.monthlyContribution"
          :currency="form.currency"
          :locale="locale"
          :invalid="!!errors.monthlyContribution"
          fluid
        />
        <p class="form-hint">Moved from your cash balance into savings each month in projections, until the goal is reached.</p>
        <span v-if="errors.monthlyContribution" class="form-error">{{ errors.monthlyContribution }}</span>
      </div>

      <!-- Target date + Status row -->
      <div class="form-row-inline">
        <div class="form-field" style="flex: 1;">
          <label class="form-label" for="sg-date">Target date</label>
          <DatePickerField
            input-id="sg-date"
            v-model="form.targetDate"
            mode="date"
            placeholder="No target date"
            clearable
          />
        </div>
        <div v-if="isEditing" class="form-field" style="flex: 1;">
          <label class="form-label" for="sg-status">Status</label>
          <Select
            id="sg-status"
            v-model="form.status"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            class="w-full"
          />
        </div>
      </div>

      <!-- Note -->
      <div class="form-field">
        <label class="form-label" for="sg-note">Note (optional)</label>
        <Textarea
          id="sg-note"
          v-model="form.note"
          rows="2"
          class="w-full"
          placeholder="Any extra context…"
          :auto-resize="true"
          maxlength="300"
        />
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="handleClose">Cancel</button>
        <button class="btn btn-primary" @click="handleSave">
          {{ isEditing ? 'Save changes' : 'Create goal' }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.currency-change {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--app-border);
  border-radius: 0.5rem;
  background: var(--app-surface-hover);
}

.currency-change-option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--app-text);
  cursor: pointer;
}

.currency-change-option input {
  margin-top: 0.2rem;
  accent-color: var(--app-accent);
}

.currency-change-option .form-hint {
  display: block;
}

.savings-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
  padding: 0.25rem 0 0.5rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--app-text-secondary);
}

.form-row-inline {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.form-error {
  font-size: 0.75rem;
  color: var(--app-negative);
}

.form-hint {
  font-size: 0.75rem;
  color: var(--app-text-tertiary);
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>

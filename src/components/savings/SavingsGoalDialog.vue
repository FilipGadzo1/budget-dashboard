<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'

import CurrencyInput from '@/components/shared/CurrencyInput.vue'
import DialogHeader from '@/components/shared/DialogHeader.vue'
import { useCurrency } from '@/composables/useCurrency'
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
    targetAmount: number
    monthlyContribution: number
    targetDate: string | null
    status: SavingsGoalStatus
    note: string | null
  }]
}>()

const { currencyCode, locale } = useCurrency()

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Completed', value: 'completed' },
]

const defaultForm = () => ({
  name: '',
  emoji: '🎯',
  targetAmount: 0 as number | null,
  monthlyContribution: 0 as number | null,
  targetDate: '',
  status: 'active' as SavingsGoalStatus,
  note: '',
})

const form = reactive(defaultForm())
const errors = reactive<Record<string, string>>({})

const isEditing = computed(() => !!props.goal)
const title = computed(() => (isEditing.value ? 'Edit goal' : 'New goal'))

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    if (props.goal) {
      form.name = props.goal.name
      form.emoji = props.goal.emoji
      form.targetAmount = props.goal.targetAmount
      form.monthlyContribution = props.goal.monthlyContribution
      form.targetDate = props.goal.targetDate ?? ''
      form.status = props.goal.status
      form.note = props.goal.note ?? ''
    } else {
      Object.assign(form, defaultForm())
    }
    Object.keys(errors).forEach((k) => delete errors[k])
  },
)

const handleSave = async (): Promise<void> => {
  Object.keys(errors).forEach((k) => delete errors[k])

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
    targetAmount: form.targetAmount ?? 0,
    monthlyContribution: form.monthlyContribution ?? 0,
    targetDate: form.targetDate || null,
    status: form.status,
    note: form.note.trim() || null,
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

      <!-- Target amount -->
      <div class="form-field">
        <label class="form-label" for="sg-target">Target amount <span class="text-negative">*</span></label>
        <CurrencyInput
          input-id="sg-target"
          v-model="form.targetAmount"
          :currency="currencyCode"
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
          :currency="currencyCode"
          :locale="locale"
          :invalid="!!errors.monthlyContribution"
          fluid
        />
        <p class="form-hint">This amount counts as an expense in your projections.</p>
        <span v-if="errors.monthlyContribution" class="form-error">{{ errors.monthlyContribution }}</span>
      </div>

      <!-- Target date + Status row -->
      <div class="form-row-inline">
        <div class="form-field" style="flex: 1;">
          <label class="form-label" for="sg-date">Target date</label>
          <input
            id="sg-date"
            v-model="form.targetDate"
            type="date"
            class="form-date-input"
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

.form-date-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--app-border-strong);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
  color-scheme: inherit;
}

.form-date-input:focus {
  border-color: var(--app-accent);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>

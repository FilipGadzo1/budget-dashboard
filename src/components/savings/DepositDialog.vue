<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'

import DialogHeader from '@/components/shared/DialogHeader.vue'
import type { SavingsDeposit, SavingsGoal } from '@/models'
import { computeProgress } from '@/services/savingsService'
import { buildErrorMap, savingsDepositSchema } from '@/validation/forms'

const props = defineProps<{
  visible: boolean
  goal: SavingsGoal | null
  deposits: SavingsDeposit[]
  formatCurrency: (n: number) => string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [amount: number, note: string | null, depositDate: string]
  deleteDeposit: [depositId: string]
}>()

const form = reactive({
  amount: 0,
  note: '',
  depositDate: '',
})
const errors = reactive<Record<string, string>>({})
const saving = ref(false)

const today = () => new Date().toISOString().slice(0, 10)

const isWithdrawal = computed(() => form.amount < 0)
const amountLabel = computed(() => (isWithdrawal.value ? 'Withdrawal' : 'Deposit'))
const progress = computed(() => (props.goal ? computeProgress(props.goal) : 0))

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    form.amount = 0
    form.note = ''
    form.depositDate = today()
    Object.keys(errors).forEach((k) => delete errors[k])
  },
)

const handleSave = async (): Promise<void> => {
  Object.keys(errors).forEach((k) => delete errors[k])

  try {
    await savingsDepositSchema.validate({ amount: form.amount }, { abortEarly: false })
  } catch (err) {
    Object.assign(errors, buildErrorMap(err))
    return
  }

  saving.value = true
  try {
    emit('save', form.amount, form.note.trim() || null, form.depositDate || today())
    form.amount = 0
    form.note = ''
    emit('update:visible', false)
  } finally {
    saving.value = false
  }
}

const handleClose = (): void => {
  emit('update:visible', false)
}

const formatDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <Dialog
    :visible="visible"
    :modal="true"
    dismissable-mask
    :draggable="false"
    :style="{ width: 'min(92vw, 28rem)' }"
    @update:visible="handleClose"
  >
    <template #header>
      <DialogHeader
        label="Savings"
        :title="goal ? `${goal.emoji} ${goal.name}` : 'Deposit'"
      />
    </template>

    <div class="deposit-dialog-body">
      <!-- Goal progress summary -->
      <div v-if="goal" class="deposit-goal-summary">
        <div class="deposit-goal-amounts">
          <span class="text-primary text-sm font-semibold tabular-nums">
            {{ formatCurrency(goal.currentAmount) }}
          </span>
          <span class="text-secondary text-xs">of {{ formatCurrency(goal.targetAmount) }}</span>
          <span class="text-secondary text-xs ml-auto">{{ progress }}%</span>
        </div>
        <div class="savings-progress-track">
          <div
            class="savings-progress-fill"
            :style="{
              width: `${progress}%`,
              background: goal.status === 'completed' ? 'var(--app-positive)' : 'var(--app-accent)',
            }"
          />
        </div>
      </div>

      <!-- Deposit form (hidden when readonly) -->
      <template v-if="!readonly">
        <div class="divider" />

        <!-- Amount input -->
        <div class="form-field">
          <label class="form-label" for="dep-amount">
            {{ amountLabel }} amount
            <span class="text-negative">*</span>
          </label>
          <div class="deposit-amount-row">
            <InputNumber
              input-id="dep-amount"
              v-model="form.amount"
              :min="-1_000_000_000"
              :max="1_000_000_000"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              class="flex-1"
              :class="{ 'p-invalid': errors.amount }"
              input-class="w-full"
              placeholder="0"
            />
            <span class="deposit-sign-hint text-secondary text-xs">
              Negative = withdrawal
            </span>
          </div>
          <span v-if="errors.amount" class="form-error">{{ errors.amount }}</span>
        </div>

        <!-- Date -->
        <div class="form-field">
          <label class="form-label" for="dep-date">Date</label>
          <input
            id="dep-date"
            v-model="form.depositDate"
            type="date"
            class="form-date-input"
          />
        </div>

        <!-- Note -->
        <div class="form-field">
          <label class="form-label" for="dep-note">Note (optional)</label>
          <InputText
            id="dep-note"
            v-model="form.note"
            class="w-full"
            placeholder="e.g. Monthly transfer"
            maxlength="200"
          />
        </div>
      </template>

      <!-- Deposit history -->
      <div v-if="deposits.length > 0" class="deposit-history">
        <div class="divider" />
        <h4 class="deposit-history-title">History</h4>
        <ul class="deposit-history-list">
          <li
            v-for="d in deposits"
            :key="d.id"
            class="deposit-history-item"
          >
            <span
              class="deposit-history-amount tabular-nums"
              :class="d.amount >= 0 ? 'text-positive' : 'text-negative'"
            >
              {{ d.amount >= 0 ? '+' : '' }}{{ formatCurrency(d.amount) }}
            </span>
            <span class="deposit-history-date text-secondary text-xs">
              {{ formatDate(d.depositDate) }}
            </span>
            <span v-if="d.note" class="deposit-history-note text-secondary text-xs">
              {{ d.note }}
            </span>
            <button
              v-if="!readonly"
              class="btn btn-ghost btn-sm deposit-history-delete"
              title="Delete deposit"
              @click="$emit('deleteDeposit', d.id)"
            >
              <i class="pi pi-trash text-xs" />
            </button>
          </li>
        </ul>
      </div>

      <p v-else-if="readonly" class="text-secondary text-sm">No deposits recorded yet.</p>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="handleClose">Close</button>
        <button
          v-if="!readonly"
          class="btn btn-primary"
          :disabled="saving || form.amount === 0"
          @click="handleSave"
        >
          Log {{ isWithdrawal ? 'withdrawal' : 'deposit' }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.deposit-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.25rem 0 0.5rem;
  min-width: min(420px, 90vw);
}

.deposit-goal-summary {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.deposit-goal-amounts {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.savings-progress-track {
  height: 0.5rem;
  background: var(--app-border);
  border-radius: 100px;
  overflow: hidden;
}

.savings-progress-fill {
  height: 100%;
  border-radius: 100px;
  transition: width 0.4s ease;
  min-width: 2px;
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

.form-error {
  font-size: 0.75rem;
  color: var(--app-negative);
}

.deposit-amount-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.deposit-sign-hint {
  white-space: nowrap;
  flex-shrink: 0;
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

.deposit-history-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--app-text-secondary);
  margin: 0 0 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.deposit-history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 220px;
  overflow-y: auto;
}

.deposit-history-item {
  display: grid;
  grid-template-columns: auto 1fr 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--app-border);
  font-size: 0.8125rem;
}

.deposit-history-item:last-child {
  border-bottom: none;
}

.deposit-history-amount {
  font-weight: 600;
  min-width: 6rem;
}

.deposit-history-date {
  white-space: nowrap;
}

.deposit-history-note {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deposit-history-delete {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

.deposit-history-delete:hover {
  color: var(--app-negative);
  background: var(--app-negative-soft);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.25rem;
}
</style>

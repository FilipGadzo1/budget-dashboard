<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'

import CurrencyInput from '@/components/shared/CurrencyInput.vue'
import DialogHeader from '@/components/shared/DialogHeader.vue'
import ExchangeRatesPanel from '@/components/shared/ExchangeRatesPanel.vue'
import StatusMessage from '@/components/shared/StatusMessage.vue'
import ExpensesDialog from '@/components/projections/ExpensesDialog.vue'
import ProjectionTable from '@/components/projections/ProjectionTable.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useExchangeRates } from '@/composables/useExchangeRates'
import type { ExpenseItem, MonthAdjustment, ProjectionInputs } from '@/models'
import {
  buildProjectionRows,
  buildProjectionShareSummary,
  buildProjectionSummary,
  buildProjectionMilestones,
} from '@/services/projectionService'
import { mergeDepositsIntoAdjustments } from '@/services/savingsProjectionService'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'
import { useSavingsStore } from '@/stores/savings'
import { useUiStore } from '@/stores/ui'
import { buildErrorMap, projectionSchema } from '@/validation/forms'

const currencyOptions = [
  { value: 'SEK', label: 'Swedish Krona (SEK)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'AED', label: 'UAE Dirham (AED)' },
]

const localeOptions = [
  { value: 'sv-SE', label: 'Swedish (Sweden)' },
  { value: 'en-IE', label: 'English (Ireland)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'hr-HR', label: 'Croatian (Croatia)' },
]

const { convert, getRatesFor, fetchRates, loading: ratesLoading, error: ratesError, rateDate } = useExchangeRates()
const supportedCurrencyCodes = currencyOptions.map((o) => o.value)

const showExchangeDialog = ref(false)
const currentRates = computed(() => getRatesFor(currencyCode.value, supportedCurrencyCodes))
const currencyLabel = (code: string): string =>
  currencyOptions.find((o) => o.value === code)?.label.split(' (')[0] ?? code

const projectionStore = useProjectionStore()
const savingsStore = useSavingsStore()
const uiStore = useUiStore()
const collabStore = useCollaborationStore()
const { currencyCode, formatCurrency, formatCompactCurrency, locale, selectedMonth: sharedSelectedMonth } = useCurrency()

const effectiveInputs = computed((): ProjectionInputs => {
  const savings = savingsStore.totalMonthlyContributions
  const allDeposits = Object.values(savingsStore.deposits).flat()
  const base = projectionStore.inputs

  const mergedAdjustments = mergeDepositsIntoAdjustments(base.monthlyAdjustments, allDeposits)
  const adjustmentsChanged = mergedAdjustments !== base.monthlyAdjustments

  if (savings === 0) {
    return adjustmentsChanged ? { ...base, monthlyAdjustments: mergedAdjustments } : base
  }

  if (base.expenseItems.length > 0) {
    return {
      ...base,
      expenseItems: [
        ...base.expenseItems,
        { id: '__savings__', name: 'Savings contributions', amount: savings, sortOrder: 9999 },
      ],
      monthlyAdjustments: mergedAdjustments,
    }
  }

  return { ...base, monthlyExpenses: base.monthlyExpenses + savings, monthlyAdjustments: mergedAdjustments }
})

const form = reactive({
  monthlyIncome: projectionStore.inputs.monthlyIncome,
  monthlyExpenses: projectionStore.inputs.monthlyExpenses,
  months: projectionStore.inputs.months,
})
const formErrors = reactive<Record<string, string>>({})

const expenseItems = computed(() => projectionStore.inputs.expenseItems)
const hasExpenseItems = computed(() => expenseItems.value.length > 0)
const totalExpenses = computed(() => expenseItems.value.reduce((s, i) => s + i.amount, 0))

const displayedExpenses = computed({
  get: () => (hasExpenseItems.value ? totalExpenses.value : form.monthlyExpenses),
  set: (val: number) => { form.monthlyExpenses = val },
})

const showExpensesDialog = ref(false)
const expensesDialogMode = ref<'view' | 'edit'>('view')
const showExpensesHint = ref(false)

const openExpensesView = (): void => {
  expensesDialogMode.value = 'view'
  showExpensesDialog.value = true
}

const openExpensesEdit = (): void => {
  expensesDialogMode.value = 'edit'
  showExpensesDialog.value = true
}

const onExpenseItemsUpdate = (items: ExpenseItem[]): void => {
  projectionStore.setExpenseItems(items)
}

const monthlyAdjustments = computed(() => projectionStore.inputs.monthlyAdjustments)

const onAdjustmentsUpdate = (adjustments: MonthAdjustment[]): void => {
  projectionStore.setMonthlyAdjustments(adjustments)
}

const shareState = reactive({
  message: '',
  tone: 'neutral' as 'neutral' | 'success' | 'error',
})

const selectedCurrencyCode = computed({
  get: () => currencyCode.value,
  set: (nextCurrencyCode: string) => {
    if (collabStore.isViewingSharedBudget) return
    const prev = uiStore.currencyCode
    const convertedIncome = Math.round(convert(form.monthlyIncome, prev, nextCurrencyCode) * 100) / 100
    const convertedExpenses = Math.round(convert(form.monthlyExpenses, prev, nextCurrencyCode) * 100) / 100
    form.monthlyIncome = convertedIncome
    form.monthlyExpenses = convertedExpenses
    const convertedItems = projectionStore.inputs.expenseItems.map((item) => ({
      ...item,
      amount: Math.round(convert(item.amount, prev, nextCurrencyCode) * 100) / 100,
    }))
    projectionStore.setInputs({
      monthlyIncome: convertedIncome,
      monthlyExpenses: convertedExpenses,
      months: form.months,
      expenseItems: projectionStore.inputs.expenseItems,
      monthlyAdjustments: projectionStore.inputs.monthlyAdjustments,
    })
    projectionStore.setExpenseItems(convertedItems)
    uiStore.setPreferences({ currencyCode: nextCurrencyCode, locale: uiStore.locale })
    collabStore.broadcastProfileUpdate(nextCurrencyCode, uiStore.locale, uiStore.selectedMonth)
  },
})

const selectedLocale = computed({
  get: () => locale.value,
  set: (val: string) => {
    if (collabStore.isViewingSharedBudget) return
    uiStore.setPreferences({ currencyCode: uiStore.currencyCode, locale: val })
    collabStore.broadcastProfileUpdate(uiStore.currencyCode, val, uiStore.selectedMonth)
  },
})

const selectedMonth = computed({
  get: () => sharedSelectedMonth.value,
  set: (val: string) => {
    if (collabStore.isViewingSharedBudget) {
      collabStore.updateSharedSelectedMonth(val)
    } else {
      uiStore.setSelectedMonth(val)
      collabStore.broadcastProfileUpdate(uiStore.currencyCode, uiStore.locale, val)
    }
  },
})

const clearErrors = (): void => {
  Object.keys(formErrors).forEach((key) => delete formErrors[key])
}

const syncProjection = async (): Promise<void> => {
  clearErrors()
  try {
    const validated = await projectionSchema.validate(form, { abortEarly: false, stripUnknown: true })
    projectionStore.setInputs({
      ...validated,
      expenseItems: projectionStore.inputs.expenseItems,
      monthlyAdjustments: projectionStore.inputs.monthlyAdjustments,
    })
  } catch (error) {
    Object.assign(formErrors, buildErrorMap(error))
  }
}

const projectionRows = computed(() =>
  buildProjectionRows(effectiveInputs.value, selectedMonth.value, locale.value),
)
const projectionSummary = computed(() => buildProjectionSummary(projectionRows.value))
const projectionMilestones = computed(() => buildProjectionMilestones(projectionRows.value))

const shareSummary = computed(() =>
  buildProjectionShareSummary({
    startMonthLabel: projectionRows.value[0]?.monthLabel ?? 'N/A',
    endMonthLabel: projectionRows.value.at(-1)?.monthLabel ?? 'N/A',
    totalIncome: formatCurrency(projectionSummary.value.totalIncome),
    totalExpenses: formatCurrency(projectionSummary.value.totalExpenses),
    totalNet: formatCurrency(projectionSummary.value.totalNet),
    endingBalance: formatCurrency(projectionSummary.value.endingBalance),
    firstNegativeMonthLabel: projectionMilestones.value.firstNegativeMonthLabel,
    highestBalanceMonthLabel: projectionMilestones.value.highestBalanceMonthLabel,
    highestBalance: formatCurrency(projectionMilestones.value.highestBalance),
  }),
)

watch(() => projectionStore.inputs, (inputs) => {
  if (form.monthlyIncome !== inputs.monthlyIncome) form.monthlyIncome = inputs.monthlyIncome
  if (form.monthlyExpenses !== inputs.monthlyExpenses) form.monthlyExpenses = inputs.monthlyExpenses
  if (form.months !== inputs.months) form.months = inputs.months
}, { deep: true })

watch(() => [form.monthlyIncome, form.monthlyExpenses, form.months], () => {
  void syncProjection()
})

onMounted(() => { void fetchRates() })

const copyShareSummary = async (): Promise<void> => {
  if (!navigator.clipboard?.writeText) {
    shareState.message = 'Clipboard not available.'
    shareState.tone = 'error'
    return
  }
  try {
    await navigator.clipboard.writeText(shareSummary.value)
    shareState.message = 'Copied to clipboard.'
    shareState.tone = 'success'
  } catch {
    shareState.message = 'Could not copy.'
    shareState.tone = 'error'
  }
}

const downloadShareSummary = (): void => {
  const blob = new Blob([shareSummary.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `budget-projection-${uiStore.selectedMonth}.txt`
  link.click()
  URL.revokeObjectURL(url)
  shareState.message = 'Downloaded.'
  shareState.tone = 'success'
}
</script>

<template>
  <div class="proj-page">

    <!-- ── Page header ────────────────────────────────────────────── -->
    <div class="proj-header">
      <div>
        <h1 class="page-title">Projections</h1>
        <p class="proj-subtitle">
          {{ projectionRows[0]?.monthLabel ?? '—' }} → {{ projectionRows.at(-1)?.monthLabel ?? '—' }} · {{ form.months }} months
        </p>
      </div>
      <div class="proj-header-actions">
        <span v-if="collabStore.isReadOnly" class="status-pill status-pill-warning proj-readonly-pill">
          <i class="pi pi-eye text-xs" /> View only
        </span>
        <button class="btn btn-ghost btn-icon" title="Copy summary" @click="copyShareSummary">
          <i class="pi pi-copy" />
        </button>
        <button class="btn btn-ghost btn-icon" title="Download .txt" @click="downloadShareSummary">
          <i class="pi pi-download" />
        </button>
      </div>
    </div>

    <StatusMessage :message="shareState.message" :tone="shareState.tone" />

    <!-- ── Summary strip ─────────────────────────────────────────── -->
    <div class="card card-sm proj-summary">
      <div class="proj-summary-items">
        <div class="proj-summary-item">
          <span class="proj-summary-label">Total Income</span>
          <span class="proj-summary-value text-positive">{{ formatCompactCurrency(projectionSummary.totalIncome) }}</span>
        </div>
        <div class="proj-summary-sep" />
        <div class="proj-summary-item">
          <span class="proj-summary-label">Total Expenses</span>
          <span class="proj-summary-value">{{ formatCompactCurrency(projectionSummary.totalExpenses) }}</span>
        </div>
        <div class="proj-summary-sep" />
        <div class="proj-summary-item">
          <span class="proj-summary-label">Monthly Net</span>
          <span
            class="proj-summary-value"
            :class="projectionSummary.totalNet >= 0 ? 'text-positive' : 'text-negative'"
          >
            {{ formatCompactCurrency(projectionSummary.totalNet / Math.max(1, form.months)) }}/mo
          </span>
        </div>
        <div class="proj-summary-sep" />
        <div class="proj-summary-item">
          <span class="proj-summary-label">Ending Balance</span>
          <span
            class="proj-summary-value"
            :class="projectionSummary.endingBalance >= 0 ? 'text-positive' : 'text-negative'"
          >
            {{ formatCompactCurrency(projectionSummary.endingBalance) }}
          </span>
        </div>
      </div>
    </div>

    <!-- ── Main 2-col layout ────────────────────────────────────── -->
    <div class="proj-main">

      <!-- Left: config panel -->
      <div class="card proj-config">

        <!-- Money inputs -->
        <div class="proj-money-field">
          <label class="form-label" for="monthly-income">Monthly income</label>
          <CurrencyInput
            input-id="monthly-income"
            v-model="form.monthlyIncome"
            :currency="currencyCode"
            :locale="locale"
            :invalid="!!formErrors.monthlyIncome"
            :disabled="collabStore.isReadOnly"
          />
          <p v-if="formErrors.monthlyIncome" class="form-error">{{ formErrors.monthlyIncome }}</p>
        </div>

        <div class="proj-money-field">
          <div class="proj-exp-header">
            <label class="form-label" for="monthly-expenses">Monthly expenses</label>
            <div class="proj-exp-actions">
              <button
                v-if="hasExpenseItems"
                class="proj-items-chip"
                @click="openExpensesView"
              >
                <i class="pi pi-list text-xs" />
                {{ expenseItems.length }} items
              </button>
              <button
                v-if="hasExpenseItems && !collabStore.isReadOnly"
                class="proj-items-chip proj-items-chip-icon"
                title="Edit items"
                @click="openExpensesEdit"
              >
                <i class="pi pi-pencil text-xs" />
              </button>
              <button
                v-if="!hasExpenseItems && !collabStore.isReadOnly"
                class="proj-items-chip"
                @click="openExpensesEdit"
              >
                <i class="pi pi-plus text-xs" />
                Itemize
              </button>
            </div>
          </div>
          <CurrencyInput
            input-id="monthly-expenses"
            v-model="displayedExpenses"
            :currency="currencyCode"
            :locale="locale"
            :disabled="hasExpenseItems || collabStore.isReadOnly"
            :invalid="!!formErrors.monthlyExpenses"
          />
          <div class="proj-exp-meta">
            <p v-if="hasExpenseItems" class="proj-meta-note">
              Sum of {{ expenseItems.length }} item{{ expenseItems.length !== 1 ? 's' : '' }}
            </p>
            <p v-else-if="formErrors.monthlyExpenses" class="form-error">{{ formErrors.monthlyExpenses }}</p>
            <p v-if="savingsStore.totalMonthlyContributions > 0" class="proj-meta-savings">
              <i class="pi pi-wallet" style="font-size: 0.6rem;" />
              +{{ formatCurrency(savingsStore.totalMonthlyContributions) }}/mo savings included
            </p>
          </div>
        </div>

        <div class="proj-config-divider" />

        <!-- Settings -->
        <div class="proj-field">
          <label class="form-label" for="start-month">Start month</label>
          <input
            id="start-month"
            v-model="selectedMonth"
            type="month"
            class="form-select"
            :disabled="collabStore.isReadOnly"
          />
        </div>

        <div class="proj-field">
          <label class="form-label" for="months">Horizon (months)</label>
          <InputNumber
            id="months"
            v-model="form.months"
            :min="1"
            :max="60"
            :min-fraction-digits="0"
            :max-fraction-digits="0"
            :use-grouping="false"
            :class="{ 'app-input-invalid': formErrors.months }"
            :disabled="collabStore.isReadOnly"
            fluid
          />
          <p v-if="formErrors.months" class="form-error">{{ formErrors.months }}</p>
        </div>

        <div class="proj-field">
          <label class="form-label" for="currency-code">Currency</label>
          <div class="flex items-center gap-1.5">
            <select
              id="currency-code"
              v-model="selectedCurrencyCode"
              class="form-select flex-1"
              :disabled="collabStore.isViewingSharedBudget"
              :title="collabStore.isViewingSharedBudget ? 'Currency is set by the budget owner' : undefined"
            >
              <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <button class="btn btn-ghost btn-icon" title="Exchange rates" @click="showExchangeDialog = true">
              <i class="pi pi-arrows-h" />
            </button>
          </div>
        </div>

        <div class="proj-field">
          <label class="form-label" for="locale-code">Locale</label>
          <select
            id="locale-code"
            v-model="selectedLocale"
            class="form-select"
            :disabled="collabStore.isViewingSharedBudget"
            :title="collabStore.isViewingSharedBudget ? 'Locale is set by the budget owner' : undefined"
          >
            <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

      </div>

      <!-- Right: projection table -->
      <div class="proj-table-section">
        <ProjectionTable
          :rows="projectionRows"
          :format-currency="formatCurrency"
          :adjustments="monthlyAdjustments"
          :readonly="collabStore.isReadOnly"
          @update:adjustments="onAdjustmentsUpdate"
        />
      </div>

    </div>

    <!-- ── Dialogs ────────────────────────────────────────────────── -->
    <ExpensesDialog
      v-model:visible="showExpensesDialog"
      :initial-mode="expensesDialogMode"
      :model-value="expenseItems"
      :currency="currencyCode"
      :locale="locale"
      @update:model-value="onExpenseItemsUpdate"
    />

    <Dialog
      v-model:visible="showExchangeDialog"
      modal
      dismissable-mask
      close-on-escape
      :draggable="false"
      :style="{ width: 'min(92vw, 22rem)' }"
    >
      <template #header>
        <DialogHeader label="Live rates" title="Exchange rates" />
      </template>
      <ExchangeRatesPanel
        :currency-code="currencyCode"
        :rates="currentRates"
        :rate-date="rateDate"
        :loading="ratesLoading"
        :error="ratesError"
        :currency-label="currencyLabel"
        layout="list"
      />
    </Dialog>
  </div>
</template>

<style scoped>
/* ─── Page ────────────────────────────────────────────────────── */
.proj-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.proj-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.proj-subtitle {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
  margin: 0.2rem 0 0;
}

.proj-header-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  padding-top: 0.25rem;
}

.proj-readonly-pill {
  font-size: 0.6875rem;
}

/* ─── Summary strip ───────────────────────────────────────────── */
.proj-summary-items {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
}

.proj-summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem 1.5rem 0.25rem 0;
  flex: 1;
  min-width: 120px;
}

.proj-summary-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.proj-summary-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--app-text);
  font-family: 'DM Mono', monospace;
  font-weight: 400;
}

.proj-summary-sep {
  width: 1px;
  height: 2.5rem;
  background: var(--app-border);
  margin: 0 1.5rem 0 0;
  flex-shrink: 0;
}

/* ─── Main 2-col ──────────────────────────────────────────────── */
.proj-main {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1rem;
  align-items: start;
}

/* ─── Config card ─────────────────────────────────────────────── */
.proj-config {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1rem;
}

.proj-config-divider {
  height: 1px;
  background: var(--app-border);
  margin: 0 -1.25rem;
}

.proj-money-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.proj-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

/* Expense items header row */
.proj-exp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-height: 1.5rem;
}

.proj-exp-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.proj-items-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.725rem;
  font-weight: 500;
  color: var(--app-accent);
  background: var(--app-accent-soft);
  border: 1px solid transparent;
  border-radius: 100px;
  padding: 0.1875rem 0.625rem;
  cursor: pointer;
  transition: border-color 0.15s;
  white-space: nowrap;
  line-height: 1.4;
}

.proj-items-chip:hover {
  border-color: var(--app-accent);
}

.proj-items-chip-icon {
  padding: 0.1875rem 0.5rem;
}

.proj-exp-meta {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-height: 1rem;
}

.proj-meta-note {
  font-size: 0.75rem;
  color: var(--app-text-secondary);
  margin: 0;
}

.proj-meta-savings {
  font-size: 0.75rem;
  color: var(--app-accent);
  margin: 0;
}

/* ─── Table section ───────────────────────────────────────────── */
.proj-table-section {
  border-radius: 0.75rem;
  border: 1px solid var(--app-border);
  overflow: hidden;
}

/* ─── Mobile (≤ 1023px) ───────────────────────────────────────── */
@media (max-width: 1023px) {
  :deep(.p-inputnumber-input),
  :deep(.p-inputtext) {
    font-family: 'DM Mono', monospace !important;
  }

  .proj-main {
    grid-template-columns: 1fr;
  }

  .proj-config {
    position: static;
  }

  .proj-config-divider {
    margin: 0 -1rem;
  }

  .proj-summary-items {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .proj-summary-sep {
    display: none;
  }

  .proj-summary-item {
    padding: 0;
    min-width: 0;
  }

  .proj-summary-value {
    font-size: 1rem;
  }

  .proj-table-section {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>

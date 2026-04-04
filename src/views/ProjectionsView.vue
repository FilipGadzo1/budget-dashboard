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
const { currencyCode, formatCurrency, locale, selectedMonth: sharedSelectedMonth } = useCurrency()

// Effective inputs include monthly savings contributions as an additional expense.
// When expense items are active, buildProjectionRows ignores monthlyExpenses and uses
// expenseItems sum instead — so we inject savings as a synthetic item in that case.
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
const showTable = ref(false)

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
    // Update the store with converted income/expenses BEFORE setExpenseItems, so the
    // deep watcher on projectionStore.inputs doesn't reset the form back to old values
    // when expense items change triggers it.
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
      // Editor changing start month: update shared context and broadcast to all viewers
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

// Sync form when the store changes from an external source (scenario load, realtime)
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
  <div>
    <div class="page-header">
      <h1 class="page-title">Projections</h1>
      <p class="page-description">Configure your monthly income and expenses to see the projected balance over time.</p>
    </div>

    <!-- Settings row -->
    <div class="card mb-6">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <label class="form-label" for="start-month">Start month</label>
          <input id="start-month" v-model="selectedMonth" class="form-select" type="month" :disabled="collabStore.isReadOnly" />
        </div>
        <div>
          <label class="form-label" for="currency-code">Currency</label>
          <div class="flex items-center gap-2">
            <select id="currency-code" v-model="selectedCurrencyCode" class="form-select flex-1" :disabled="collabStore.isViewingSharedBudget" :title="collabStore.isViewingSharedBudget ? 'Currency is set by the budget owner' : undefined">
              <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <button class="btn btn-ghost btn-icon" title="Exchange rates" @click="showExchangeDialog = true">
              <i class="pi pi-arrows-h" />
            </button>
          </div>
        </div>
        <div>
          <label class="form-label" for="locale-code">Locale</label>
          <select id="locale-code" v-model="selectedLocale" class="form-select" :disabled="collabStore.isViewingSharedBudget" :title="collabStore.isViewingSharedBudget ? 'Locale is set by the budget owner' : undefined">
            <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Inputs -->
    <div class="card mb-6">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <p class="text-label">Monthly inputs</p>
          <span v-if="collabStore.isReadOnly" class="status-pill status-pill-warning text-xs">
            <i class="pi pi-eye text-xs" /> View only
          </span>
        </div>
        <div class="flex gap-2">
          <button v-if="hasExpenseItems" class="btn btn-secondary btn-sm" @click="openExpensesView">
            <i class="pi pi-list text-xs" /> View items
          </button>
          <button v-if="hasExpenseItems && !collabStore.isReadOnly" class="btn btn-secondary btn-sm" @click="openExpensesEdit">
            <i class="pi pi-pencil text-xs" /> Edit items
          </button>
          <button v-if="!hasExpenseItems && !collabStore.isReadOnly" class="btn btn-secondary btn-sm" @click="openExpensesEdit">
            <i class="pi pi-plus text-xs" /> Add expense items
          </button>
        </div>
      </div>
      <form class="grid gap-4 sm:grid-cols-3" @submit.prevent>
        <div>
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
        <div>
          <div class="form-label flex items-center gap-1">
            <label for="monthly-expenses">Monthly expenses</label>
            <span
              class="relative inline-flex ml-1 p-1"
              @touchstart.prevent="showExpensesHint = true"
              @touchend="showExpensesHint = false"
              @touchcancel="showExpensesHint = false"
            >
              <i
                class="pi pi-info-circle cursor-default"
                style="font-size: 0.625rem; color: var(--app-accent);"
                v-tooltip.top="{ value: 'Enter a fixed monthly amount, or click &quot;Add expense items&quot; above to break it down into named line items. When items are active their sum overrides this field.', showDelay: 300 }"
              />
              <div v-if="showExpensesHint">
                Enter a fixed monthly amount, or click "Add expense items" above to break it down into named line items. When items are active their sum overrides this field.
              </div>
            </span>
          </div>
          <CurrencyInput
            input-id="monthly-expenses"
            v-model="displayedExpenses"
            :currency="currencyCode"
            :locale="locale"
            :disabled="hasExpenseItems || collabStore.isReadOnly"
            :invalid="!!formErrors.monthlyExpenses"
          />
          <p v-if="hasExpenseItems" class="mt-1 text-xs text-secondary">
            Calculated from {{ expenseItems.length }} item{{ expenseItems.length !== 1 ? 's' : '' }}
          </p>
          <p v-else-if="formErrors.monthlyExpenses" class="form-error">{{ formErrors.monthlyExpenses }}</p>
          <p v-if="savingsStore.totalMonthlyContributions > 0" class="mt-1 text-xs" style="color: var(--app-accent);">
            <i class="pi pi-wallet" style="font-size: 0.6rem;" />
            +{{ formatCurrency(savingsStore.totalMonthlyContributions) }}/mo in savings contributions
          </p>
        </div>
        <div>
          <label class="form-label" for="months">Months to project</label>
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
      </form>
    </div>

    <!-- Share & Table -->
    <div class="card">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-label mb-1">Portable summary</p>
          <p class="text-body">Copy or download a plain-text snapshot of the current projection.</p>
        </div>
        <div class="flex flex-shrink-0 gap-2">
          <button class="btn btn-primary btn-sm" @click="copyShareSummary">
            <i class="pi pi-copy text-xs" /> Copy
          </button>
          <button class="btn btn-secondary btn-sm" @click="downloadShareSummary">
            <i class="pi pi-download text-xs" /> Download
          </button>
          <button class="btn btn-secondary btn-sm" @click="showTable = !showTable">
            {{ showTable ? 'Hide table' : 'Show table' }}
          </button>
        </div>
      </div>

      <StatusMessage :message="shareState.message" :tone="shareState.tone" class="mt-3" />
      <pre class="share-preview mt-4">{{ shareSummary }}</pre>
      <div v-if="showTable" class="projection-table-wrap">
        <ProjectionTable
          :rows="projectionRows"
          :format-currency="formatCurrency"
          :adjustments="monthlyAdjustments"
          :readonly="collabStore.isReadOnly"
          @update:adjustments="onAdjustmentsUpdate"
        />
      </div>
    </div>

    <!-- Expenses dialog -->
    <ExpensesDialog
      v-model:visible="showExpensesDialog"
      :initial-mode="expensesDialogMode"
      :model-value="expenseItems"
      :currency="currencyCode"
      :locale="locale"
      @update:model-value="onExpenseItemsUpdate"
    />

    <!-- Exchange rates dialog -->
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
@media (max-width: 1023px) {
  /* DM Mono for all number inputs */
  :deep(.p-inputnumber-input),
  :deep(.p-inputtext) {
    font-family: 'DM Mono', monospace !important;
  }

  /* Ensure projection table scrolls horizontally */
  .projection-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>

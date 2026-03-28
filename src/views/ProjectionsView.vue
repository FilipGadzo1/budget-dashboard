<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'

import { useCurrency } from '@/composables/useCurrency'
import { useExchangeRates } from '@/composables/useExchangeRates'
import type { ProjectionInputs } from '@/models'
import {
  buildProjectionRows,
  buildProjectionShareSummary,
  buildProjectionSummary,
  buildProjectionMilestones,
} from '@/services/projectionService'
import { useProjectionStore } from '@/stores/projection'
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

const { convert, getRatesFor, fetchRates, loading: ratesLoading, error: ratesError, rateDate } =
  useExchangeRates()

const supportedCurrencyCodes = currencyOptions.map((o) => o.value)

const showExchangeDialog = ref(false)
const currentRates = computed(() => getRatesFor(currencyCode.value, supportedCurrencyCodes))
const currencyLabel = (code: string): string =>
  currencyOptions.find((o) => o.value === code)?.label.split(' (')[0] ?? code

const projectionStore = useProjectionStore()
const uiStore = useUiStore()
const { currencyCode, formatCurrency, locale } = useCurrency()

const form = reactive<ProjectionInputs>({ ...projectionStore.inputs })
const formErrors = reactive<Record<string, string>>({})
const showTable = ref(false)

const shareState = reactive({
  message: '',
  tone: 'neutral' as 'neutral' | 'success' | 'error',
})

const selectedCurrencyCode = computed({
  get: () => uiStore.currencyCode,
  set: (nextCurrencyCode: string) => {
    const prev = uiStore.currencyCode
    form.monthlyIncome = convert(form.monthlyIncome, prev, nextCurrencyCode)
    form.monthlyExpenses = convert(form.monthlyExpenses, prev, nextCurrencyCode)
    uiStore.setPreferences({ currencyCode: nextCurrencyCode, locale: uiStore.locale })
  },
})

const selectedLocale = computed({
  get: () => uiStore.locale,
  set: (nextLocale: string) => {
    uiStore.setPreferences({ currencyCode: uiStore.currencyCode, locale: nextLocale })
  },
})

const selectedMonth = computed({
  get: () => uiStore.selectedMonth,
  set: (nextMonth: string) => uiStore.setSelectedMonth(nextMonth),
})

const clearErrors = (): void => {
  Object.keys(formErrors).forEach((key) => delete formErrors[key])
}

const syncProjection = async (): Promise<void> => {
  clearErrors()
  try {
    const validated = await projectionSchema.validate(form, { abortEarly: false, stripUnknown: true })
    projectionStore.setInputs(validated)
  } catch (error) {
    Object.assign(formErrors, buildErrorMap(error))
  }
}

const projectionRows = computed(() =>
  buildProjectionRows(projectionStore.inputs, uiStore.selectedMonth, locale.value),
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
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="form-label" for="start-month">Start month</label>
          <input id="start-month" v-model="selectedMonth" class="form-select" type="month" />
        </div>
        <div>
          <label class="form-label" for="currency-code">Currency</label>
          <div class="flex items-center gap-2">
            <select id="currency-code" v-model="selectedCurrencyCode" class="form-select flex-1">
              <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <button class="btn btn-ghost btn-icon" title="Exchange rates" @click="showExchangeDialog = true">
              <i class="pi pi-arrows-h" />
            </button>
          </div>
        </div>
        <div>
          <label class="form-label" for="locale-code">Locale</label>
          <select id="locale-code" v-model="selectedLocale" class="form-select">
            <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Inputs -->
    <div class="card mb-6">
      <p class="text-label mb-4">Monthly inputs</p>
      <form class="grid gap-4 sm:grid-cols-3" @submit.prevent>
        <div>
          <label class="form-label" for="monthly-income">Monthly income</label>
          <InputNumber
            id="monthly-income"
            v-model="form.monthlyIncome"
            mode="currency"
            :currency="currencyCode"
            :locale="locale"
            :min="0"
            :use-grouping="true"
            :class="{ 'app-input-invalid': formErrors.monthlyIncome }"
            fluid
          />
          <p v-if="formErrors.monthlyIncome" class="form-error">{{ formErrors.monthlyIncome }}</p>
        </div>
        <div>
          <label class="form-label" for="monthly-expenses">Monthly expenses</label>
          <InputNumber
            id="monthly-expenses"
            v-model="form.monthlyExpenses"
            mode="currency"
            :currency="currencyCode"
            :locale="locale"
            :min="0"
            :use-grouping="true"
            :class="{ 'app-input-invalid': formErrors.monthlyExpenses }"
            fluid
          />
          <p v-if="formErrors.monthlyExpenses" class="form-error">{{ formErrors.monthlyExpenses }}</p>
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
        <div class="flex gap-2 flex-shrink-0">
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

      <p
        v-if="shareState.message"
        class="mt-3 text-sm"
        :class="shareState.tone === 'success' ? 'text-positive' : shareState.tone === 'error' ? 'text-negative' : 'text-secondary'"
      >
        {{ shareState.message }}
      </p>

      <pre class="share-preview mt-4">{{ shareSummary }}</pre>

      <!-- Monthly table -->
      <div v-if="showTable" class="mt-6 overflow-x-auto rounded-lg border" style="border-color: var(--app-border);">
        <table class="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Income</th>
              <th>Expenses</th>
              <th>Net</th>
              <th>Cumulative Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in projectionRows" :key="row.monthKey">
              <td class="font-medium">{{ row.monthLabel }}</td>
              <td class="tabular-nums">{{ formatCurrency(row.income) }}</td>
              <td class="tabular-nums">{{ formatCurrency(row.expenses) }}</td>
              <td class="tabular-nums" :class="row.net >= 0 ? 'text-positive' : 'text-negative'">{{ formatCurrency(row.net) }}</td>
              <td class="tabular-nums" :class="row.cumulativeBalance >= 0 ? '' : 'text-negative'">{{ formatCurrency(row.cumulativeBalance) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Exchange rates dialog -->
    <Dialog
      v-model:visible="showExchangeDialog"
      modal
      dismissable-mask
      :draggable="false"
      :style="{ width: 'min(92vw, 22rem)' }"
    >
      <template #header>
        <div>
          <p class="text-label">Live rates</p>
          <h3 class="mt-1 text-lg font-semibold" style="color: var(--app-text)">Exchange rates</h3>
        </div>
      </template>
      <div v-if="ratesLoading" class="flex items-center gap-2 text-sm text-secondary py-2">
        <i class="pi pi-spin pi-spinner" /> Loading rates…
      </div>
      <div v-else-if="ratesError" class="flex items-center gap-2 text-sm text-secondary py-2">
        <i class="pi pi-exclamation-triangle" /> {{ ratesError }}
      </div>
      <template v-else>
        <p class="mb-4 text-sm text-secondary">1 {{ currencyCode }} ≈</p>
        <div class="flex flex-col gap-3">
          <div v-for="rate in currentRates" :key="rate.code" class="flex items-center justify-between">
            <span class="text-sm text-secondary">{{ currencyLabel(rate.code) }} ({{ rate.code }})</span>
            <span class="text-sm font-semibold tabular-nums" style="color: var(--app-text)">{{ rate.rate }}</span>
          </div>
        </div>
        <p v-if="rateDate" class="mt-4 text-xs text-secondary">
          Rates as of {{ rateDate }}. Source: European Central Bank.
        </p>
      </template>
    </Dialog>
  </div>
</template>

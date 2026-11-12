<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import Dialog from 'primevue/dialog'

import CurrencyInput from '@/components/shared/CurrencyInput.vue'
import ConfirmDeleteDialog from '@/components/shared/ConfirmDeleteDialog.vue'
import DatePickerField from '@/components/shared/DatePickerField.vue'
import DialogHeader from '@/components/shared/DialogHeader.vue'
import ExchangeRatesPanel from '@/components/shared/ExchangeRatesPanel.vue'
import StatusMessage from '@/components/shared/StatusMessage.vue'
import ItemsDialog from '@/components/projections/ItemsDialog.vue'
import ProjectionTable from '@/components/projections/ProjectionTable.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useEffectiveProjection } from '@/composables/useEffectiveProjection'
import { useExchangeRates } from '@/composables/useExchangeRates'
import { currencyOptions } from '@/data/defaults'
import type { BudgetItem, MonthAdjustment } from '@/models'
import { buildProjectionShareSummary } from '@/services/projectionService'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'
import { addMonthsToKey, formatCompactMonthYear, monthsBetween } from '@/utils/date'
import { buildErrorMap, projectionSchema } from '@/validation/forms'

const { getRatesFor, fetchRates, loading: ratesLoading, error: ratesError, rateDate } = useExchangeRates()
const supportedCurrencyCodes = currencyOptions.map((o) => o.value)

const showExchangeDialog = ref(false)
const currentRates = computed(() => getRatesFor(currencyCode.value, supportedCurrencyCodes))
const currencyLabel = (code: string): string =>
  currencyOptions.find((o) => o.value === code)?.label.split(' (')[0] ?? code

const projectionStore = useProjectionStore()
const uiStore = useUiStore()
const collabStore = useCollaborationStore()
const { currencyCode, formatCurrency, formatCompactCurrency, locale, selectedMonth: sharedSelectedMonth, toDisplay } = useCurrency()

const {
  rows: projectionRows,
  summary: projectionSummary,
  milestones: projectionMilestones,
  displayInputs,
  baseTotals,
  hasSavings,
  unconvertibleCurrencies,
} = useEffectiveProjection()

// Currency the plain income/expenses fields are stored in. Normally the display
// currency; it can differ briefly (e.g. right after loading a scenario saved in
// another currency), in which case the field shows the currency it really holds.
const baseCurrency = computed(() => projectionStore.inputs.currency ?? currencyCode.value)

const form = reactive({
  monthlyIncome: projectionStore.inputs.monthlyIncome,
  monthlyExpenses: projectionStore.inputs.monthlyExpenses,
  months: projectionStore.inputs.months,
})
const formErrors = reactive<Record<string, string>>({})

const MAX_MONTHS = 60

const incomeItems = computed(() => projectionStore.inputs.incomeItems)
const hasIncomeItems = computed(() => incomeItems.value.length > 0)

const displayedIncome = computed({
  get: () => (hasIncomeItems.value ? baseTotals.value.income : form.monthlyIncome),
  set: (val: number) => { form.monthlyIncome = val },
})

// Cash on hand when the projection begins. Shown and edited in the currency it
// was entered in; converted to the display currency for the projection itself.
const startingBalanceCurrency = computed(
  () => projectionStore.inputs.startingBalanceCurrency ?? baseCurrency.value,
)
const startingBalance = computed({
  get: () => projectionStore.inputs.startingBalance ?? 0,
  set: (value: number | null) => {
    projectionStore.setInputs({
      startingBalance: value ?? 0,
      startingBalanceCurrency: startingBalanceCurrency.value,
    })
  },
})

// What moves into savings in the first month — the typical monthly transfer.
const monthlyToSavings = computed(() => projectionRows.value[0]?.savingsContribution ?? 0)

const showIncomeDialog = ref(false)
const incomeDialogMode = ref<'view' | 'edit'>('view')

const openIncomeView = (): void => {
  incomeDialogMode.value = 'view'
  showIncomeDialog.value = true
}

const openIncomeEdit = (): void => {
  incomeDialogMode.value = 'edit'
  showIncomeDialog.value = true
}

const onIncomeItemsUpdate = (items: BudgetItem[]): void => {
  projectionStore.setIncomeItems(items)
}

const expenseItems = computed(() => projectionStore.inputs.expenseItems)
const hasExpenseItems = computed(() => expenseItems.value.length > 0)

const displayedExpenses = computed({
  get: () => (hasExpenseItems.value ? baseTotals.value.expenses : form.monthlyExpenses),
  set: (val: number) => { form.monthlyExpenses = val },
})

const showExpensesDialog = ref(false)
const expensesDialogMode = ref<'view' | 'edit'>('view')

const openExpensesView = (): void => {
  expensesDialogMode.value = 'view'
  showExpensesDialog.value = true
}

const openExpensesEdit = (): void => {
  expensesDialogMode.value = 'edit'
  showExpensesDialog.value = true
}

const onExpenseItemsUpdate = (items: BudgetItem[]): void => {
  projectionStore.setExpenseItems(items.map((item, index) => ({ ...item, sortOrder: index })))
}

// The table edits adjustments in the display currency.
const monthlyAdjustments = computed(() => displayInputs.value.monthlyAdjustments)

const onAdjustmentsUpdate = (adjustments: MonthAdjustment[]): void => {
  const stored = projectionStore.inputs.monthlyAdjustments
  const shown = monthlyAdjustments.value
  projectionStore.setMonthlyAdjustments(
    adjustments.map((next) => {
      const original = stored.find((a) => a.id === next.id)
      const before = shown.find((a) => a.id === next.id)
      const untouched = !!original && !!before
        && before.monthKey === next.monthKey
        && before.incomeAdjustment === next.incomeAdjustment
        && before.expenseAdjustment === next.expenseAdjustment
        && before.note === next.note
      // Untouched adjustments keep the currency they were entered in; an edited
      // one was typed in the display currency.
      return untouched ? original : { ...next, currency: currencyCode.value }
    }),
  )
}

const shareState = reactive({
  message: '',
  tone: 'neutral' as 'neutral' | 'success' | 'error',
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

// ── Projection window: a start month and an end month ──────────────────────
// The store keeps a start month and a length in months; the end month is derived
// from those, and editing either end adjusts the length.
const clampMonths = (count: number): number => Math.min(MAX_MONTHS, Math.max(1, count))

const endMonth = computed({
  get: () => addMonthsToKey(selectedMonth.value, Math.max(1, form.months) - 1),
  set: (val: string) => {
    if (val) form.months = clampMonths(monthsBetween(selectedMonth.value, val) + 1)
  },
})

// Moving the start keeps the end where it is (the window gets shorter or longer)
const startMonth = computed({
  get: () => selectedMonth.value,
  set: (val: string) => {
    if (!val) return
    const end = endMonth.value
    selectedMonth.value = val
    form.months = clampMonths(monthsBetween(val, end) + 1)
  },
})

const latestEndMonth = computed(() => addMonthsToKey(selectedMonth.value, MAX_MONTHS - 1))

const settingsOpen = ref(false)
const settingsSummary = computed(
  () => `${formatCompactMonthYear(selectedMonth.value, locale.value)} → ${formatCompactMonthYear(endMonth.value, locale.value)} · ${currencyCode.value}`,
)

// ── Reset ────────────────────────────────────────────────────────────────────
const showResetDialog = ref(false)
const resetting = ref(false)

const resetProjections = async (): Promise<void> => {
  resetting.value = true
  try {
    await projectionStore.resetInputs()
    // Start again from this month (the setter also handles a shared budget)
    const now = new Date()
    selectedMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    settingsOpen.value = false
    shareState.message = 'Projections reset.'
    shareState.tone = 'neutral'
  } finally {
    resetting.value = false
  }
}

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
    endingNetWorth: hasSavings.value ? formatCurrency(projectionSummary.value.endingNetWorth) : undefined,
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
        <button class="btn btn-ghost btn-icon" title="Copy summary" aria-label="Copy summary" @click="copyShareSummary">
          <i class="pi pi-copy" />
        </button>
        <button class="btn btn-ghost btn-icon" title="Download .txt" aria-label="Download .txt" @click="downloadShareSummary">
          <i class="pi pi-download" />
        </button>
      </div>
    </div>

    <StatusMessage :message="shareState.message" :tone="shareState.tone" />

    <p v-if="unconvertibleCurrencies.length" class="proj-rates-warning">
      <i class="pi pi-exclamation-triangle text-xs" />
      Exchange rates are unavailable, so amounts in {{ unconvertibleCurrencies.join(', ') }} are shown unconverted and totals are wrong.
    </p>

    <!-- ── Main 2-col layout ────────────────────────────────────── -->
    <div class="proj-main">

      <!-- Left: config panel -->
      <div class="card proj-config">

        <!-- Starting point -->
        <div class="proj-money-field">
          <label class="form-label" for="starting-balance">Starting balance</label>
          <CurrencyInput
            input-id="starting-balance"
            v-model="startingBalance"
            :currency="startingBalanceCurrency"
            :locale="locale"
            :disabled="collabStore.isReadOnly"
            allow-negative
          />
          <p class="proj-meta-note">Cash you have at the start of the first month.</p>
        </div>

        <!-- Money inputs -->
        <div class="proj-money-field">
          <div class="proj-exp-header">
            <label class="form-label" for="monthly-income">Monthly income</label>
            <div class="proj-exp-actions">
              <button
                v-if="hasIncomeItems"
                class="proj-items-chip"
                @click="openIncomeView"
              >
                <i class="pi pi-list text-xs" />
                {{ incomeItems.length }} sources
              </button>
              <button
                v-if="hasIncomeItems && !collabStore.isReadOnly"
                class="proj-items-chip proj-items-chip-icon"
                title="Edit sources"
                @click="openIncomeEdit"
              >
                <i class="pi pi-pencil text-xs" />
              </button>
              <button
                v-if="!hasIncomeItems && !collabStore.isReadOnly"
                class="proj-items-chip"
                @click="openIncomeEdit"
              >
                <i class="pi pi-plus text-xs" />
                Itemize
              </button>
            </div>
          </div>
          <CurrencyInput
            input-id="monthly-income"
            v-model="displayedIncome"
            :currency="hasIncomeItems ? currencyCode : baseCurrency"
            :locale="locale"
            :invalid="!!formErrors.monthlyIncome"
            :disabled="hasIncomeItems || collabStore.isReadOnly"
          />
          <div class="proj-exp-meta">
            <p v-if="hasIncomeItems" class="proj-meta-note">
              Average per month across {{ incomeItems.length }} source{{ incomeItems.length !== 1 ? 's' : '' }}
            </p>
            <p v-else-if="formErrors.monthlyIncome" class="form-error">{{ formErrors.monthlyIncome }}</p>
          </div>
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
            :currency="hasExpenseItems ? currencyCode : baseCurrency"
            :locale="locale"
            :disabled="hasExpenseItems || collabStore.isReadOnly"
            :invalid="!!formErrors.monthlyExpenses"
          />
          <div class="proj-exp-meta">
            <p v-if="hasExpenseItems" class="proj-meta-note">
              Average per month across {{ expenseItems.length }} item{{ expenseItems.length !== 1 ? 's' : '' }}
            </p>
            <p v-else-if="formErrors.monthlyExpenses" class="form-error">{{ formErrors.monthlyExpenses }}</p>
            <p v-if="monthlyToSavings > 0" class="proj-meta-savings">
              <i class="pi pi-wallet" style="font-size: 0.6rem;" />
              {{ formatCurrency(monthlyToSavings) }}/mo moves to savings (not an expense)
            </p>
          </div>
        </div>

        <div class="proj-config-divider" />

        <!-- Settings: folded by default, current values on one line -->
        <button
          class="proj-settings-toggle"
          :aria-expanded="settingsOpen"
          aria-controls="proj-settings"
          @click="settingsOpen = !settingsOpen"
        >
          <span class="proj-settings-title">Settings</span>
          <span v-if="!settingsOpen" class="proj-settings-summary">{{ settingsSummary }}</span>
          <i class="pi text-xs" :class="settingsOpen ? 'pi-chevron-up' : 'pi-chevron-down'" aria-hidden="true" />
        </button>

        <div v-show="settingsOpen" id="proj-settings" class="proj-settings">
        <div class="proj-field">
          <label class="form-label" for="start-month">Start month</label>
          <DatePickerField input-id="start-month" v-model="startMonth" :disabled="collabStore.isReadOnly" />
        </div>

        <div class="proj-field">
          <label class="form-label" for="end-month">End month</label>
          <DatePickerField
            input-id="end-month"
            v-model="endMonth"
            :min="selectedMonth"
            :max="latestEndMonth"
            :invalid="!!formErrors.months"
            :disabled="collabStore.isReadOnly"
          />
          <p v-if="formErrors.months" class="form-error">{{ formErrors.months }}</p>
          <p v-else class="proj-meta-note">{{ form.months }} month{{ form.months === 1 ? '' : 's' }} · up to {{ MAX_MONTHS }}</p>
        </div>

        <div class="proj-field">
          <span class="form-label">Currency</span>
          <div class="proj-currency-row">
            <span id="currency-code" class="proj-currency-code">{{ currencyCode }}</span>
            <RouterLink
              v-if="!collabStore.isViewingSharedBudget"
              to="/settings"
              class="proj-currency-link"
            >
              Change in Settings
            </RouterLink>
            <span v-else class="proj-meta-note">Set by the budget owner</span>
            <button class="btn btn-ghost btn-icon proj-currency-rates" title="Exchange rates" aria-label="Exchange rates" @click="showExchangeDialog = true">
              <i class="pi pi-arrows-h" />
            </button>
          </div>
        </div>
        </div>

        <button
          v-if="!collabStore.isReadOnly"
          class="proj-reset"
          :disabled="resetting"
          @click="showResetDialog = true"
        >
          <i class="pi pi-refresh text-xs" aria-hidden="true" />
          Reset projections
        </button>

      </div>

      <!-- Right: projection table -->
      <div class="proj-table-section">
        <ProjectionTable
          :rows="projectionRows"
          :format-currency="formatCurrency"
          :format-compact="formatCompactCurrency"
          :locale="locale"
          :adjustments="monthlyAdjustments"
          :readonly="collabStore.isReadOnly"
          :show-net-worth="hasSavings"
          @update:adjustments="onAdjustmentsUpdate"
        />
      </div>

    </div>

    <!-- ── Dialogs ────────────────────────────────────────────────── -->
    <ItemsDialog
      v-model:visible="showIncomeDialog"
      kind="income"
      :initial-mode="incomeDialogMode"
      :model-value="incomeItems"
      :currency="currencyCode"
      :locale="locale"
      :fallback-currency="baseCurrency"
      :to-display="toDisplay"
      :start-month="selectedMonth"
      @update:model-value="onIncomeItemsUpdate"
    />

    <ItemsDialog
      v-model:visible="showExpensesDialog"
      kind="expense"
      :initial-mode="expensesDialogMode"
      :model-value="expenseItems"
      :currency="currencyCode"
      :locale="locale"
      :fallback-currency="baseCurrency"
      :to-display="toDisplay"
      :start-month="selectedMonth"
      @update:model-value="onExpenseItemsUpdate"
    />

    <ConfirmDeleteDialog
      v-model:visible="showResetDialog"
      title="Reset projections"
      message="This clears your starting balance, income, expenses, every income source and expense item, and all one-time adjustments, and starts a new 12-month projection from this month. Saved scenarios and savings goals are kept. This cannot be undone."
      confirm-label="Reset projections"
      @confirm="resetProjections"
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

.proj-settings-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: var(--app-text-secondary);
  font: inherit;
  cursor: pointer;
  text-align: left;
}

.proj-settings-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--app-text);
}

.proj-settings-summary {
  flex: 1;
  min-width: 0;
  font-size: 0.75rem;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.proj-settings-toggle .pi {
  margin-left: auto;
  flex-shrink: 0;
}

.proj-settings-summary + .pi {
  margin-left: 0;
}

.proj-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.proj-reset {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
  cursor: pointer;
}

.proj-reset:hover:not(:disabled) {
  color: var(--app-negative);
}

.proj-reset:disabled {
  opacity: 0.5;
  cursor: default;
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

.proj-rates-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.625rem 0.875rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  color: var(--app-negative);
  background: var(--app-negative-soft);
  border: 1px solid var(--app-negative-border);
}

.proj-currency-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.proj-currency-code {
  font-family: 'DM Mono', monospace;
  font-size: 0.875rem;
  color: var(--app-text);
}

.proj-currency-link {
  font-size: 0.75rem;
  color: var(--app-accent);
}

.proj-currency-link:hover {
  text-decoration: underline;
}

.proj-currency-rates {
  margin-left: auto;
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

  .proj-table-section {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>

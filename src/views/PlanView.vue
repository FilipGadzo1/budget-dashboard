<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Dialog from 'primevue/dialog'

import NextSteps, { type NextStep } from '@/components/dashboard/NextSteps.vue'
import PlanItemsCard from '@/components/plan/PlanItemsCard.vue'
import SankeyFlow from '@/components/plan/SankeyFlow.vue'
import ItemsDialog from '@/components/projections/ItemsDialog.vue'
import ConfirmDeleteDialog from '@/components/shared/ConfirmDeleteDialog.vue'
import CurrencyInput from '@/components/shared/CurrencyInput.vue'
import DialogHeader from '@/components/shared/DialogHeader.vue'
import ExchangeRatesPanel from '@/components/shared/ExchangeRatesPanel.vue'
import MoneyFlow from '@/components/shared/MoneyFlow.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useEffectiveProjection } from '@/composables/useEffectiveProjection'
import { useExchangeRates } from '@/composables/useExchangeRates'
import { currencyOptions } from '@/data/defaults'
import type { BudgetItem } from '@/models'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'
import { buildErrorMap, projectionSchema } from '@/validation/forms'

// The plan: what you start with, what comes in and what goes out. The month-by-
// month result of it lives on the Forecast page.

const route = useRoute()
const router = useRouter()
const projectionStore = useProjectionStore()
const uiStore = useUiStore()
const collabStore = useCollaborationStore()
const { currencyCode, formatCurrency, formatMoney, locale, selectedMonth, toDisplay } = useCurrency()
const { rows, summary, baseTotals, categoryBreakdown, unconvertibleCurrencies } = useEffectiveProjection()

const readonly = computed(() => collabStore.isReadOnly)

// Currency the plain income/expenses fields are stored in. Normally the display
// currency; it can differ briefly (e.g. right after loading a scenario saved in
// another currency), in which case the field shows the currency it really holds.
const baseCurrency = computed(() => projectionStore.inputs.currency ?? currencyCode.value)

// ── Plain amounts (budgets that are not itemised) ───────────────────────────
// A local form validated by the Yup schema before it reaches the store, kept in
// sync when the store changes from outside (scenario load, realtime update).
const form = reactive({
  monthlyIncome: projectionStore.inputs.monthlyIncome,
  monthlyExpenses: projectionStore.inputs.monthlyExpenses,
})
const formErrors = reactive<Record<string, string>>({})

watch(() => projectionStore.inputs, (inputs) => {
  if (form.monthlyIncome !== inputs.monthlyIncome) form.monthlyIncome = inputs.monthlyIncome
  if (form.monthlyExpenses !== inputs.monthlyExpenses) form.monthlyExpenses = inputs.monthlyExpenses
}, { deep: true })

const syncPlan = async (): Promise<void> => {
  Object.keys(formErrors).forEach((key) => delete formErrors[key])
  try {
    const validated = await projectionSchema.validate(
      { ...form, months: projectionStore.inputs.months },
      { abortEarly: false, stripUnknown: true },
    )
    projectionStore.setInputs({
      monthlyIncome: validated.monthlyIncome,
      monthlyExpenses: validated.monthlyExpenses,
    })
  } catch (error) {
    Object.assign(formErrors, buildErrorMap(error))
  }
}

watch(() => [form.monthlyIncome, form.monthlyExpenses], () => { void syncPlan() })

// ── Starting balance ────────────────────────────────────────────────────────
// Shown and edited in the currency it was entered in; converted to the display
// currency for the forecast itself.
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

// ── Income and expenses ─────────────────────────────────────────────────────
const incomeItems = computed(() => projectionStore.inputs.incomeItems)
const expenseItems = computed(() => projectionStore.inputs.expenseItems)

const dialog = reactive({ income: false, expense: false, addRow: false })

const openEditor = (kind: 'income' | 'expense', addRow: boolean): void => {
  dialog.addRow = addRow
  dialog[kind] = true
}

const onIncomeItemsUpdate = (items: BudgetItem[]): void => {
  projectionStore.setIncomeItems(items)
}

const onExpenseItemsUpdate = (items: BudgetItem[]): void => {
  projectionStore.setExpenseItems(items.map((item, index) => ({ ...item, sortOrder: index })))
}

// The command palette links here with ?edit=income / ?edit=expense
watch(
  () => route.query.edit,
  (kind) => {
    if (kind !== 'income' && kind !== 'expense') return
    if (!readonly.value) openEditor(kind, true)
    void router.replace({ query: {} })
  },
  { immediate: true },
)

// ── Where a month goes, and where the plan ends up ──────────────────────────
// What moves into savings in the first month — the typical monthly transfer.
const monthlyToSavings = computed(() => rows.value[0]?.savingsContribution ?? 0)
const endMonthLabel = computed(() => rows.value.at(-1)?.monthLabel ?? '')

// ── What moves the result most ───────────────────────────────────────────────
// What a small change is worth by the end of the plan, in plain numbers.
const levers = computed((): NextStep[] => {
  const { income, expenses } = baseTotals.value
  const months = rows.value.length
  if (!months || (income === 0 && expenses === 0)) return []
  const left = income - expenses - monthlyToSavings.value
  const top = categoryBreakdown.value[0]
  const list: NextStep[] = [
    {
      key: 'cut',
      tone: 'neutral',
      icon: 'pi pi-minus-circle',
      title: `${formatCurrency(100)} less spending a month`,
      body: `is worth ${formatCurrency(100 * months)} more by ${endMonthLabel.value}.`,
    },
  ]
  if (top && expenses > 0) {
    list.push({
      key: 'top',
      tone: 'neutral',
      icon: 'pi pi-chart-pie',
      title: `${top.category} is your biggest cost`,
      body: `${Math.round((top.amount / expenses) * 100)}% of spending. A tenth less of it adds ${formatCurrency(top.amount * 0.1 * months)} over the plan.`,
    })
  }
  if (income > 0) {
    list.push({
      key: 'rate',
      tone: monthlyToSavings.value > 0 ? 'positive' : 'neutral',
      icon: 'pi pi-wallet',
      title: `You save ${Math.round((monthlyToSavings.value / income) * 100)}% of your income`,
      body: monthlyToSavings.value > 0 ? `${formatCurrency(monthlyToSavings.value)} a month moves to your goals.` : 'Nothing is moving to savings goals yet.',
      to: '/savings',
      action: 'Open savings',
    })
  }
  list.push(left < 0
    ? { key: 'gap', tone: 'warning', icon: 'pi pi-exclamation-triangle', title: `Breaking even needs ${formatCurrency(-left)} more`, body: 'a month, from more income or less spending.' }
    : { key: 'spare', tone: 'positive', icon: 'pi pi-check', title: `${formatCurrency(left)} a month is unassigned`, body: `It builds up as cash: ${formatCurrency(left * months)} over the plan.` })
  return list
})

// ── Exchange rates ──────────────────────────────────────────────────────────
const { getRatesFor, fetchRates, loading: ratesLoading, error: ratesError, rateDate } = useExchangeRates()
const supportedCurrencyCodes = currencyOptions.map((o) => o.value)
const showExchangeDialog = ref(false)
const currentRates = computed(() => getRatesFor(currencyCode.value, supportedCurrencyCodes))
const currencyLabel = (code: string): string =>
  currencyOptions.find((o) => o.value === code)?.label.split(' (')[0] ?? code

onMounted(() => { void fetchRates() })

// ── Reset ───────────────────────────────────────────────────────────────────
const showResetDialog = ref(false)
const resetting = ref(false)

const resetPlan = async (): Promise<void> => {
  resetting.value = true
  try {
    await projectionStore.resetInputs()
    // Start again from this month
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    if (collabStore.isViewingSharedBudget) {
      collabStore.updateSharedSelectedMonth(month)
    } else {
      uiStore.setSelectedMonth(month)
      collabStore.broadcastProfileUpdate(uiStore.currencyCode, uiStore.locale, month)
    }
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div class="page">

    <!-- ── Header ─────────────────────────────────────────────────── -->
    <header class="page-head">
      <div>
        <h1 class="page-title">Plan</h1>
        <p class="page-description">
          What you start with, what comes in and what goes out.
        </p>
      </div>
      <div class="page-actions">
        <span v-if="readonly" class="status-pill status-pill-warning">
          <i class="pi pi-eye text-xs" aria-hidden="true" /> View only
        </span>
        <button class="btn btn-secondary btn-sm" title="Exchange rates" @click="showExchangeDialog = true">
          <span id="currency-code">{{ currencyCode }}</span>
          <i class="pi pi-arrow-right-arrow-left text-xs" aria-hidden="true" />
          <span class="sr-only">Exchange rates</span>
        </button>
        <button v-if="!readonly" class="btn btn-ghost btn-sm" :disabled="resetting" @click="showResetDialog = true">
          <i class="pi pi-refresh text-xs" aria-hidden="true" /> Reset plan
        </button>
      </div>
    </header>

    <p v-if="unconvertibleCurrencies.length" class="plan-rates-warning">
      <i class="pi pi-exclamation-triangle text-xs" aria-hidden="true" />
      Exchange rates are unavailable, so amounts in {{ unconvertibleCurrencies.join(', ') }} are shown unconverted and totals are wrong.
    </p>

    <div class="page-body cols-3">

      <!-- ── Where a typical month goes ───────────────────────────── -->
      <section class="card card-col chart-box" aria-labelledby="plan-flow-title">
        <h2 id="plan-flow-title" class="card-title">Where a typical month goes</h2>
        <SankeyFlow
          :income="baseTotals.income"
          :expenses="baseTotals.expenses"
          :categories="categoryBreakdown"
          :to-savings="monthlyToSavings"
          :format-currency="formatCurrency"
        />
      </section>

      <!-- ── Income, the starting point, and what moves the result ── -->
      <div class="stack">
        <PlanItemsCard
          kind="income"
          :items="incomeItems"
          :total="baseTotals.income"
          :currency="currencyCode"
          :fallback-currency="baseCurrency"
          :locale="locale"
          :start-month="selectedMonth"
          :readonly="readonly"
          :format-money="formatMoney"
          :to-display="toDisplay"
          @edit="openEditor('income', false)"
          @add="openEditor('income', true)"
        >
          <label class="sr-only" for="monthly-income">Monthly income</label>
          <CurrencyInput
            input-id="monthly-income"
            v-model="form.monthlyIncome"
            :currency="baseCurrency"
            :locale="locale"
            :invalid="!!formErrors.monthlyIncome"
            :disabled="readonly"
          />
          <p v-if="formErrors.monthlyIncome" class="form-error">{{ formErrors.monthlyIncome }}</p>
        </PlanItemsCard>

        <section class="card plan-start">
          <div class="plan-field">
            <label class="form-label" for="starting-balance">Starting balance</label>
            <CurrencyInput
              input-id="starting-balance"
              v-model="startingBalance"
              :currency="startingBalanceCurrency"
              :locale="locale"
              :disabled="readonly"
              allow-negative
            />
          </div>
          <div class="plan-result">
            <span>Ends at, {{ endMonthLabel || 'the end' }}</span>
            <b :class="{ 'text-negative': summary.endingBalance < 0 }" :title="formatCurrency(summary.endingBalance)">
              <MoneyFlow :value="summary.endingBalance" />
            </b>
          </div>
        </section>

        <NextSteps v-if="levers.length" class="grow" title="What moves the result most" :steps="levers" />
      </div>

      <!-- ── Expenses ─────────────────────────────────────────────── -->
      <PlanItemsCard
        kind="expense"
        :items="expenseItems"
        :total="baseTotals.expenses"
        :currency="currencyCode"
        :fallback-currency="baseCurrency"
        :locale="locale"
        :start-month="selectedMonth"
        :readonly="readonly"
        :format-money="formatMoney"
        :to-display="toDisplay"
        @edit="openEditor('expense', false)"
        @add="openEditor('expense', true)"
      >
        <label class="sr-only" for="monthly-expenses">Monthly expenses</label>
        <CurrencyInput
          input-id="monthly-expenses"
          v-model="form.monthlyExpenses"
          :currency="baseCurrency"
          :locale="locale"
          :invalid="!!formErrors.monthlyExpenses"
          :disabled="readonly"
        />
        <p v-if="formErrors.monthlyExpenses" class="form-error">{{ formErrors.monthlyExpenses }}</p>
      </PlanItemsCard>
    </div>

    <!-- ── Dialogs ────────────────────────────────────────────────── -->
    <ItemsDialog
      v-model:visible="dialog.income"
      kind="income"
      initial-mode="edit"
      :add-on-open="dialog.addRow"
      :model-value="incomeItems"
      :currency="currencyCode"
      :locale="locale"
      :fallback-currency="baseCurrency"
      :to-display="toDisplay"
      :start-month="selectedMonth"
      @update:model-value="onIncomeItemsUpdate"
    />

    <ItemsDialog
      v-model:visible="dialog.expense"
      kind="expense"
      initial-mode="edit"
      :add-on-open="dialog.addRow"
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
      title="Reset plan"
      message="This clears your starting balance, income, expenses, every income source and expense item, and all one-time adjustments, and starts a new 12-month forecast from this month. Saved scenarios and savings goals are kept. This cannot be undone."
      confirm-label="Reset plan"
      @confirm="resetPlan"
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
      <p v-if="!collabStore.isViewingSharedBudget" class="plan-note plan-rates-note">
        Amounts are shown in {{ currencyCode }}.
        <RouterLink to="/settings" class="plan-result-link">Change in Settings</RouterLink>
      </p>
    </Dialog>
  </div>
</template>

<style scoped>
.plan-rates-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.625rem 0.875rem;
  border-radius: var(--radius-control);
  font-size: 0.8125rem;
  color: var(--app-negative);
  background: var(--app-negative-soft);
  border: 1px solid var(--app-negative-border);
  flex: none;
}

.plan-start {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  flex: none;
}

.plan-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.plan-result {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.plan-result b {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--app-text);
}

.plan-note {
  margin: 0;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.plan-rates-note {
  margin-top: 0.875rem;
}

.plan-result-link {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--app-accent);
}

.plan-result-link:hover {
  text-decoration: underline;
}
</style>

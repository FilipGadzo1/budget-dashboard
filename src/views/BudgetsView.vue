<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'

import { useCurrency } from '@/composables/useCurrency'
import { useExchangeRates } from '@/composables/useExchangeRates'
import type { ProjectionInputs } from '@/models'
import {
  buildProjectionMilestones,
  buildProjectionRows,
  buildProjectionShareSummary,
  buildProjectionSummary,
  buildProjectionTrendPath,
  calculateBreakEvenGap,
} from '@/services/projectionService'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'
import { buildErrorMap, projectionSchema } from '@/validation/forms'

type DashboardSection = 'overview' | 'scenarios' | 'details'

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
const { currencyCode, formatCompactCurrency, formatCurrency, locale } = useCurrency()

const form = reactive<ProjectionInputs>({ ...projectionStore.inputs })
const formErrors = reactive<Record<string, string>>({})
const scenarioDraftName = reactive({
  value: '',
})
const importState = reactive({
  message: '',
  tone: 'neutral' as 'neutral' | 'success' | 'error',
})
const shareState = reactive({
  message: '',
  tone: 'neutral' as 'neutral' | 'success' | 'error',
})
const viewState = reactive({
  activeSection: 'overview' as DashboardSection,
  showTable: false,
})

const dashboardSections: Array<{ id: DashboardSection; label: string; description: string }> = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'See the current plan, the key numbers, and the clearest next move.',
  },
  {
    id: 'scenarios',
    label: 'Saved plans',
    description: 'Manage alternate versions without crowding the main planning flow.',
  },
  {
    id: 'details',
    label: 'Details',
    description: 'Open the deeper guidance, share summary, and monthly table only when needed.',
  },
]

const selectedCurrencyCode = computed({
  get: () => uiStore.currencyCode,
  set: (nextCurrencyCode: string) => {
    const prev = uiStore.currencyCode
    form.monthlyIncome = convert(form.monthlyIncome, prev, nextCurrencyCode)
    form.monthlyExpenses = convert(form.monthlyExpenses, prev, nextCurrencyCode)
    uiStore.setPreferences({
      currencyCode: nextCurrencyCode,
      locale: uiStore.locale,
    })
  },
})

const selectedLocale = computed({
  get: () => uiStore.locale,
  set: (nextLocale: string) => {
    uiStore.setPreferences({
      currencyCode: uiStore.currencyCode,
      locale: nextLocale,
    })
  },
})

const selectedMonth = computed({
  get: () => uiStore.selectedMonth,
  set: (nextMonth: string) => {
    uiStore.setSelectedMonth(nextMonth)
  },
})

const themeToggleLabel = computed(() =>
  uiStore.themeMode === 'dark' ? 'Switch to light canvas' : 'Switch to dark canvas',
)

const activeScenarioId = computed(() => projectionStore.activeScenarioId)
const savedScenarios = computed(() => projectionStore.savedScenarios)

const clearErrors = (): void => {
  Object.keys(formErrors).forEach((key) => delete formErrors[key])
}

const syncProjection = async (): Promise<void> => {
  clearErrors()

  try {
    const validated = await projectionSchema.validate(form, {
      abortEarly: false,
      stripUnknown: true,
    })

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
const monthlyNet = computed(() => projectionStore.inputs.monthlyIncome - projectionStore.inputs.monthlyExpenses)
const trendPath = computed(() => buildProjectionTrendPath(projectionRows.value, 320, 120))
const trendFillPath = computed(() =>
  trendPath.value ? `${trendPath.value} L 310 120 L 10 120 Z` : '',
)
const breakEvenGap = computed(() => calculateBreakEvenGap(projectionStore.inputs))

const summaryCards = computed(() => [
  {
    label: 'Total income',
    value: formatCompactCurrency(projectionSummary.value.totalIncome),
    tone: 'projection-positive',
  },
  {
    label: 'Total expenses',
    value: formatCompactCurrency(projectionSummary.value.totalExpenses),
    tone: '',
  },
  {
    label: 'Net result',
    value: formatCompactCurrency(projectionSummary.value.totalNet),
    tone: projectionSummary.value.totalNet >= 0 ? 'projection-positive' : 'projection-negative',
  },
  {
    label: 'Ending balance',
    value: formatCompactCurrency(projectionSummary.value.endingBalance),
    tone: projectionSummary.value.endingBalance >= 0 ? 'projection-positive' : 'projection-negative',
  },
])

const projectionInsights = computed(() => {
  const insights: Array<{ title: string; body: string; tone: 'positive' | 'warning' }> = []

  if (monthlyNet.value < 0) {
    insights.push({
      title: 'Monthly deficit detected',
      body: `Expenses are currently higher than income, so each projected month reduces your balance. Closing the gap needs ${formatCurrency(breakEvenGap.value)} more income or the same amount in monthly savings cuts.`,
      tone: 'warning',
    })
  } else {
    insights.push({
      title: 'Monthly plan is cash-flow positive',
      body: 'Income is currently covering expenses, so the projection builds a cushion each month.',
      tone: 'positive',
    })
  }

  if (projectionStore.inputs.months >= 24) {
    insights.push({
      title: 'Long-range projection',
      body: 'Long horizons are great for trend spotting, but assumptions usually need a quick review every few months.',
      tone: 'warning',
    })
  }

  if (projectionSummary.value.endingBalance >= 10000) {
    insights.push({
      title: 'Strong ending balance',
      body: 'This plan builds a healthy reserve by the end of the selected horizon.',
      tone: 'positive',
    })
  }

  return insights
})
const primaryInsight = computed(() => projectionInsights.value[0] ?? null)
const supportingInsights = computed(() => projectionInsights.value.slice(1))

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

const planningPrompts = computed(() => {
  const prompts: Array<{ id: string; title: string; body: string; actionLabel: string }> = []

  if (!savedScenarios.value.length) {
    prompts.push({
      id: 'save-baseline',
      title: 'Capture a baseline',
      body: 'You have a workable plan on screen. Save it now so future tweaks can be compared against a stable starting point.',
      actionLabel: 'Save baseline',
    })
  }

  if (breakEvenGap.value > 0) {
    prompts.push({
      id: 'balance-expenses',
      title: 'Try a break-even version',
      body: 'Create a quick what-if by reducing monthly expenses to match income and see how the projection changes immediately.',
      actionLabel: 'Balance expenses',
    })
  }

  if (form.months > 24) {
    prompts.push({
      id: 'trim-horizon',
      title: 'Review a shorter horizon',
      body: 'Long timelines are useful, but a 12-month view is often easier to act on for near-term budgeting choices.',
      actionLabel: 'Use 12 months',
    })
  }

  return prompts
})

const activeSectionMeta = computed(
  () => dashboardSections.find((section) => section.id === viewState.activeSection) ?? dashboardSections[0],
)

const heroState = computed(() => {
  if (monthlyNet.value < 0) {
    return {
      tone: 'warning',
      label: 'Needs attention',
      headline: 'Your current assumptions create a monthly shortfall.',
      body: `The plan is slipping by ${formatCurrency(breakEvenGap.value)} each month. Fix the core numbers first, then compare alternatives.`,
    }
  }

  if (projectionSummary.value.endingBalance >= 10000) {
    return {
      tone: 'positive',
      label: 'Strong runway',
      headline: 'This version builds a healthy reserve over time.',
      body: 'The current inputs are compounding into a comfortable ending balance, so the overview can stay calm and focused.',
    }
  }

  return {
    tone: 'neutral',
    label: 'Plan in progress',
    headline: 'The projection is viable, but still worth refining.',
    body: 'Use the overview for the main read, then open saved plans or details only when you want to go deeper.',
  }
})

const heroMetrics = computed(() => [
  {
    label: 'Monthly net',
    value: formatCurrency(monthlyNet.value),
  },
  {
    label: 'Start month',
    value: projectionRows.value[0]?.monthLabel ?? 'N/A',
  },
  {
    label: 'Horizon',
    value: `${form.months} month${form.months === 1 ? '' : 's'}`,
  },
  {
    label: 'Saved plans',
    value: `${savedScenarios.value.length}`,
  },
])

watch(() => [form.monthlyIncome, form.monthlyExpenses, form.months], () => {
  void syncProjection()
})

onMounted(() => {
  void fetchRates()
})

const saveCurrentScenario = async (): Promise<void> => {
  await syncProjection()

  if (Object.keys(formErrors).length > 0) {
    return
  }

  projectionStore.saveScenario(scenarioDraftName.value)
  scenarioDraftName.value = ''
}

const overwriteActiveScenario = async (): Promise<void> => {
  await syncProjection()

  if (Object.keys(formErrors).length > 0) {
    return
  }

  if (projectionStore.overwriteActiveScenario(scenarioDraftName.value)) {
    scenarioDraftName.value = ''
  }
}

const loadScenario = (scenarioId: string): void => {
  projectionStore.loadScenario(scenarioId)
  Object.assign(form, projectionStore.inputs)
  clearErrors()
}

const deleteScenario = (scenarioId: string): void => {
  projectionStore.deleteScenario(scenarioId)
}

const renameScenario = (scenarioId: string, currentName: string): void => {
  const nextName = window.prompt('Rename scenario', currentName)

  if (!nextName) {
    return
  }

  projectionStore.renameScenario(scenarioId, nextName)
}

const exportScenarioFile = (): void => {
  const payload = projectionStore.exportScenarios()
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)

  link.href = url
  link.download = `budget-scenarios-${date}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const copyShareSummary = async (): Promise<void> => {
  if (!navigator.clipboard?.writeText) {
    shareState.message = 'Clipboard access is not available in this browser.'
    shareState.tone = 'error'
    return
  }

  try {
    await navigator.clipboard.writeText(shareSummary.value)
    shareState.message = 'Copied the portable summary to the clipboard.'
    shareState.tone = 'success'
  } catch {
    shareState.message = 'Could not copy the portable summary.'
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

  shareState.message = 'Downloaded a portable summary snapshot.'
  shareState.tone = 'success'
}

const importScenarioFile = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  try {
    const payload = await file.text()
    const imported = projectionStore.importScenarios(payload)
    importState.message = imported
      ? `Imported ${imported} scenario${imported === 1 ? '' : 's'}.`
      : 'No new scenarios were found in that file.'
    importState.tone = imported ? 'success' : 'neutral'
  } catch {
    importState.message = 'Could not import that scenario file.'
    importState.tone = 'error'
  } finally {
    input.value = ''
  }
}

const runPromptAction = async (promptId: string): Promise<void> => {
  if (promptId === 'save-baseline') {
    await syncProjection()

    if (!Object.keys(formErrors).length) {
      projectionStore.saveScenario('Baseline plan')
    }
    return
  }

  if (promptId === 'balance-expenses') {
    form.monthlyExpenses = form.monthlyIncome
    await syncProjection()
    return
  }

  if (promptId === 'trim-horizon') {
    form.months = 12
    await syncProjection()
  }
}

const openSection = (sectionId: DashboardSection): void => {
  viewState.activeSection = sectionId
}
</script>

<template>
  <section class="projection-page">
    <section class="projection-hero card-surface">
      <div class="projection-hero-copy">
        <div class="projection-hero-pill" :class="`projection-hero-pill-${heroState.tone}`">
          <span class="projection-hero-pill-dot" />
          {{ heroState.label }}
        </div>
        <div>
          <p class="section-kicker">Plan studio</p>
          <h2 class="projection-hero-title">{{ heroState.headline }}</h2>
          <p class="projection-hero-subtitle">{{ heroState.body }}</p>
        </div>
        <div class="projection-hero-actions">
          <button type="button" class="projection-action" @click="openSection('overview')">
            Review plan
          </button>
          <button type="button" class="projection-action projection-action-secondary" @click="openSection('scenarios')">
            Scenario shelf
          </button>
        </div>
      </div>

      <div class="projection-hero-metrics">
        <article
          v-for="metric in heroMetrics"
          :key="metric.label"
          class="projection-hero-metric"
        >
          <p class="app-stat-label">{{ metric.label }}</p>
          <h3 class="projection-hero-metric-value">{{ metric.value }}</h3>
        </article>
      </div>
    </section>

    <section class="projection-nav card-surface">
      <div class="projection-nav-copy">
        <p class="section-kicker">Simplified flow</p>
        <h2 class="app-section-title">{{ activeSectionMeta.label }}</h2>
        <p class="projection-nav-body">{{ activeSectionMeta.description }}</p>
      </div>
      <div class="projection-nav-actions">
        <button
          v-for="section in dashboardSections"
          :key="section.id"
          type="button"
          class="projection-nav-button"
          :class="{ 'projection-nav-button-active': section.id === viewState.activeSection }"
          @click="openSection(section.id)"
        >
          {{ section.label }}
        </button>
      </div>
    </section>

    <section class="projection-panel card-surface">
      <div class="projection-panel-heading">
        <div>
          <p class="section-kicker">Current plan</p>
          <h2 class="app-section-title">Inputs and display settings</h2>
        </div>
        <p class="projection-panel-body">
          Keep the main inputs visible, then switch sections when you want saved plans or deeper analysis.
        </p>
      </div>

      <div class="projection-settings">
        <div>
          <label class="projection-label" for="start-month">Start month</label>
          <input id="start-month" v-model="selectedMonth" class="projection-select" type="month">
        </div>

        <div>
          <label class="projection-label" for="currency-code">Currency</label>
          <div class="flex items-center gap-2">
            <select id="currency-code" v-model="selectedCurrencyCode" class="projection-select flex-1">
              <option v-for="option in currencyOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <button
              type="button"
              class="projection-action-secondary"
              title="View exchange rates"
              @click="showExchangeDialog = true"
            >
              <i class="pi pi-arrows-h" />
            </button>
          </div>
        </div>

        <div>
          <label class="projection-label" for="locale-code">Locale</label>
          <select id="locale-code" v-model="selectedLocale" class="projection-select">
            <option v-for="option in localeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="projection-settings-action">
          <span class="projection-label">Theme</span>
          <button type="button" class="projection-toggle" @click="uiStore.toggleTheme()">
            {{ themeToggleLabel }}
          </button>
        </div>
      </div>

      <form class="projection-form">
        <div>
          <label class="projection-label" for="monthly-income">Monthly income</label>
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
          <p v-if="formErrors.monthlyIncome" class="app-input-error">{{ formErrors.monthlyIncome }}</p>
        </div>

        <div>
          <label class="projection-label" for="monthly-expenses">Monthly expenses</label>
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
          <p v-if="formErrors.monthlyExpenses" class="app-input-error">{{ formErrors.monthlyExpenses }}</p>
        </div>

        <div>
          <label class="projection-label" for="months">Months to project</label>
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
          <p v-if="formErrors.months" class="app-input-error">{{ formErrors.months }}</p>
        </div>
      </form>
    </section>

    <template v-if="viewState.activeSection === 'overview'">
      <section class="projection-summary-grid">
        <article
          v-for="card in summaryCards"
          :key="card.label"
          class="projection-summary-card card-surface"
          :class="card.tone === 'projection-positive' ? 'projection-summary-card-positive' : card.tone === 'projection-negative' ? 'projection-summary-card-negative' : 'projection-summary-card-neutral'"
        >
          <p class="app-stat-label">{{ card.label }}</p>
          <h2 class="projection-summary-value" :class="card.tone">{{ card.value }}</h2>
          <p class="projection-summary-note">
            Based on {{ form.months }} projected month{{ form.months === 1 ? '' : 's' }} from {{ projectionRows[0]?.monthLabel ?? 'the selected start month' }}.
          </p>
        </article>
      </section>

      <section class="projection-overview-grid">
        <article v-if="primaryInsight" class="projection-focus-card card-surface">
          <div>
            <p class="section-kicker">Main signal</p>
            <h2 class="app-section-title">{{ primaryInsight.title }}</h2>
            <p class="projection-focus-body">{{ primaryInsight.body }}</p>
          </div>
          <div v-if="supportingInsights.length" class="projection-supporting-list">
            <p class="app-stat-label">Also worth noting</p>
            <ul class="projection-supporting-items">
              <li v-for="insight in supportingInsights" :key="insight.title">
                {{ insight.title }}
              </li>
            </ul>
          </div>
          <div class="projection-focus-actions">
            <button type="button" class="projection-action" @click="openSection('details')">
              Open details
            </button>
            <button type="button" class="projection-action projection-action-secondary" @click="openSection('scenarios')">
              Manage saved plans
            </button>
          </div>
        </article>

        <section class="projection-trend card-surface">
          <div class="projection-trend-copy">
            <div>
              <p class="section-kicker">Balance direction</p>
              <h2 class="app-section-title">Trend preview</h2>
            </div>
            <p class="projection-trend-caption">
              A quick sparkline of cumulative balance across the selected projection horizon.
            </p>
          </div>
          <div class="projection-trend-shell">
            <svg viewBox="0 0 320 120" class="projection-trend-chart" role="img" aria-label="Projection balance trend">
              <defs>
                <linearGradient id="trend-stroke-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#155eef" />
                  <stop offset="100%" stop-color="#14b8a6" />
                </linearGradient>
                <linearGradient id="trend-area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#155eef" stop-opacity="0.22" />
                  <stop offset="100%" stop-color="#14b8a6" stop-opacity="0" />
                </linearGradient>
              </defs>
              <!-- grid lines -->
              <line x1="10" y1="37" x2="310" y2="37" stroke="currentColor" stroke-width="1" opacity="0.08" />
              <line x1="10" y1="62" x2="310" y2="62" stroke="currentColor" stroke-width="1" opacity="0.08" />
              <line x1="10" y1="87" x2="310" y2="87" stroke="currentColor" stroke-width="1" opacity="0.08" />
              <!-- area fill -->
              <path
                v-if="trendFillPath"
                :d="trendFillPath"
                fill="url(#trend-area-grad)"
                stroke="none"
              />
              <!-- stroke line -->
              <path
                v-if="trendPath"
                :d="trendPath"
                fill="none"
                stroke="url(#trend-stroke-grad)"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
              />
            </svg>
            <div class="projection-trend-stats">
              <div>
                <p class="app-stat-label">Opening month</p>
                <p class="projection-trend-stat">{{ projectionRows[0]?.monthLabel ?? 'N/A' }}</p>
              </div>
              <div>
                <p class="app-stat-label">Ending balance</p>
                <p class="projection-trend-stat" :class="projectionSummary.endingBalance >= 0 ? 'projection-positive' : 'projection-negative'">
                  {{ formatCurrency(projectionSummary.endingBalance) }}
                </p>
              </div>
            </div>
          </div>
        </section>
      </section>

      <section class="projection-milestones">
        <article class="projection-milestone-card card-surface">
          <p class="app-stat-label">First negative month</p>
          <h3 class="projection-milestone-value">
            {{ projectionMilestones.firstNegativeMonthLabel ?? 'Never dips below zero' }}
          </h3>
        </article>
        <article class="projection-milestone-card card-surface">
          <p class="app-stat-label">Peak balance month</p>
          <h3 class="projection-milestone-value">
            {{ projectionMilestones.highestBalanceMonthLabel ?? 'N/A' }}
          </h3>
        </article>
        <article class="projection-milestone-card card-surface">
          <p class="app-stat-label">Peak balance</p>
          <h3 class="projection-milestone-value" :class="projectionMilestones.highestBalance >= 0 ? 'projection-positive' : 'projection-negative'">
            {{ formatCurrency(projectionMilestones.highestBalance) }}
          </h3>
        </article>
      </section>

      <section v-if="planningPrompts.length" class="projection-prompts">
        <article
          v-for="prompt in planningPrompts"
          :key="prompt.id"
          class="projection-prompt-card card-surface"
        >
          <div>
            <p class="section-kicker">Next move</p>
            <h3 class="projection-prompt-title">{{ prompt.title }}</h3>
            <p class="projection-prompt-body">{{ prompt.body }}</p>
          </div>
          <button type="button" class="projection-action" @click="runPromptAction(prompt.id)">
            {{ prompt.actionLabel }}
          </button>
        </article>
      </section>
    </template>

    <section v-else-if="viewState.activeSection === 'scenarios'" class="projection-scenarios card-surface">
      <div class="projection-scenarios-header">
        <div>
          <p class="section-kicker">Saved plans</p>
          <h2 class="app-section-title">Scenario shelf</h2>
        </div>
        <div class="projection-scenarios-toolbar">
          <InputText
            v-model="scenarioDraftName.value"
            placeholder="Scenario name"
          />
          <button type="button" class="projection-action" @click="saveCurrentScenario()">
            Save current plan
          </button>
          <button
            v-if="activeScenarioId"
            type="button"
            class="projection-action projection-action-secondary"
            @click="overwriteActiveScenario()"
          >
            Overwrite active
          </button>
          <button type="button" class="projection-action projection-action-secondary" @click="exportScenarioFile()">
            Export
          </button>
          <label class="projection-action projection-action-secondary projection-import-label">
            Import
            <input class="projection-import-input" type="file" accept="application/json" @change="importScenarioFile">
          </label>
        </div>
      </div>
      <p
        v-if="importState.message"
        class="projection-import-message"
        :class="{
          'projection-import-message-success': importState.tone === 'success',
          'projection-import-message-error': importState.tone === 'error',
        }"
      >
        {{ importState.message }}
      </p>

      <div v-if="savedScenarios.length" class="projection-scenario-list">
        <article
          v-for="scenario in savedScenarios"
          :key="scenario.id"
          class="projection-scenario-card"
          :class="{ 'projection-scenario-card-active': scenario.id === activeScenarioId }"
        >
          <div>
            <h3 class="projection-scenario-title">{{ scenario.name }}</h3>
            <p class="projection-scenario-meta">
              {{ formatCurrency(scenario.inputs.monthlyIncome) }} income, {{ formatCurrency(scenario.inputs.monthlyExpenses) }} expenses, {{ scenario.inputs.months }} months
            </p>
          </div>
          <div class="projection-scenario-actions">
            <button type="button" class="projection-action" @click="loadScenario(scenario.id)">
              Load
            </button>
            <button type="button" class="projection-action projection-action-secondary" @click="renameScenario(scenario.id, scenario.name)">
              Rename
            </button>
            <button type="button" class="projection-action projection-action-secondary" @click="deleteScenario(scenario.id)">
              Delete
            </button>
          </div>
        </article>
      </div>
      <p v-else class="projection-empty-copy">
        Save the current plan to start comparing multiple budgeting scenarios.
      </p>
      <div v-if="!savedScenarios.length" class="projection-empty-actions">
        <button type="button" class="projection-action" @click="runPromptAction('save-baseline')">
          Save a baseline first
        </button>
        <p class="projection-empty-hint">
          A saved baseline makes later experiments easier to compare, restore, and export.
        </p>
      </div>
    </section>

    <template v-else>
      <section v-if="projectionInsights.length" class="projection-insights">
        <article
          v-for="insight in projectionInsights"
          :key="insight.title"
          class="projection-insight-card"
          :class="insight.tone === 'warning' ? 'projection-insight-warning' : 'projection-insight-positive'"
        >
          <h3 class="projection-insight-title">{{ insight.title }}</h3>
          <p class="projection-insight-body">{{ insight.body }}</p>
        </article>
      </section>

      <section class="projection-share card-surface">
        <div class="projection-share-copy">
          <div>
            <p class="section-kicker">Share-ready snapshot</p>
            <h2 class="app-section-title">Portable summary</h2>
          </div>
          <p class="projection-share-body">
            Copy or download a plain-text snapshot of this plan when you want to send the essentials to someone else or save an offline note.
          </p>
        </div>
        <div class="projection-share-actions">
          <button type="button" class="projection-action" @click="copyShareSummary()">
            Copy summary
          </button>
          <button type="button" class="projection-action projection-action-secondary" @click="downloadShareSummary()">
            Download summary
          </button>
          <button type="button" class="projection-action projection-action-secondary" @click="viewState.showTable = !viewState.showTable">
            {{ viewState.showTable ? 'Hide monthly table' : 'Show monthly table' }}
          </button>
        </div>
        <p
          v-if="shareState.message"
          class="projection-import-message"
          :class="{
            'projection-import-message-success': shareState.tone === 'success',
            'projection-import-message-error': shareState.tone === 'error',
          }"
        >
          {{ shareState.message }}
        </p>
        <pre class="projection-share-preview">{{ shareSummary }}</pre>
      </section>

      <div v-if="viewState.showTable" class="projection-table-wrap">
        <table class="projection-table">
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
              <td>{{ row.monthLabel }}</td>
              <td>{{ formatCurrency(row.income) }}</td>
              <td>{{ formatCurrency(row.expenses) }}</td>
              <td :class="row.net >= 0 ? 'projection-positive' : 'projection-negative'">{{ formatCurrency(row.net) }}</td>
              <td :class="row.cumulativeBalance >= 0 ? '' : 'projection-negative'">
                {{ formatCurrency(row.cumulativeBalance) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>

  <Dialog
    v-model:visible="showExchangeDialog"
    modal
    dismissable-mask
    :draggable="false"
    :style="{ width: 'min(92vw, 22rem)' }"
  >
    <template #header>
      <div>
        <p class="section-kicker">Live rates</p>
        <h3 class="mt-2 text-xl font-semibold app-text">Exchange rates</h3>
      </div>
    </template>

    <div v-if="ratesLoading" class="flex items-center gap-2 text-sm app-subtle py-2">
      <i class="pi pi-spin pi-spinner" />
      Loading rates…
    </div>
    <div v-else-if="ratesError" class="flex items-center gap-2 text-sm app-subtle py-2">
      <i class="pi pi-exclamation-triangle" />
      {{ ratesError }}
    </div>
    <template v-else>
      <p class="mb-4 text-sm app-subtle">1 {{ currencyCode }} ≈</p>
      <div class="flex flex-col gap-3">
        <div
          v-for="rate in currentRates"
          :key="rate.code"
          class="flex items-center justify-between"
        >
          <span class="text-sm app-subtle">{{ currencyLabel(rate.code) }} ({{ rate.code }})</span>
          <span class="text-sm font-semibold app-text tabular-nums">{{ rate.rate }}</span>
        </div>
      </div>
      <p v-if="rateDate" class="mt-4 text-xs app-subtle">
        Rates as of {{ rateDate }}. Source: European Central Bank.
      </p>
    </template>
  </Dialog>
</template>

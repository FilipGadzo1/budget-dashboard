import { computed } from 'vue'

import { useCurrency } from '@/composables/useCurrency'
import type { ProjectionInputs } from '@/models'
import { monthlyTotals, toDisplayGoal, toDisplayInputs } from '@/services/currencyService'
import {
  buildProjectionMilestones,
  buildProjectionRows,
  buildProjectionSummary,
} from '@/services/projectionService'
import { buildSavingsContributionAdjustments, savingsStartingBalance } from '@/services/savingsProjectionService'
import { useProjectionStore } from '@/stores/projection'
import { useSavingsStore } from '@/stores/savings'

/**
 * The projection every page should show: stored inputs converted to the display
 * currency, plus the savings picture — what is already saved and the planned
 * monthly transfers into savings.
 * Dashboard and Projections both read from here so their numbers always agree.
 */
export const useEffectiveProjection = () => {
  const projectionStore = useProjectionStore()
  const savingsStore = useSavingsStore()
  const { currencyCode, locale, selectedMonth, convert, canShow } = useCurrency()

  // Stored inputs with every amount converted to the display currency.
  const displayInputs = computed(() => toDisplayInputs(projectionStore.inputs, currencyCode.value, convert))

  // Monthly income / expenses before one-time adjustments.
  const baseTotals = computed(() => monthlyTotals(displayInputs.value))

  const displayGoals = computed(() =>
    savingsStore.goals.map((g) => toDisplayGoal(g, currencyCode.value, convert)),
  )

  const effectiveInputs = computed((): ProjectionInputs => ({
    ...displayInputs.value,
    savingsStartingBalance: savingsStartingBalance(displayGoals.value),
    savingsAdjustments: buildSavingsContributionAdjustments(
      displayGoals.value,
      selectedMonth.value,
      displayInputs.value.months,
    ),
  }))

  const rows = computed(() =>
    buildProjectionRows(effectiveInputs.value, selectedMonth.value, locale.value),
  )
  const summary = computed(() => buildProjectionSummary(rows.value))
  const milestones = computed(() => buildProjectionMilestones(rows.value))

  // True when savings play any part in this projection (drives the extra
  // savings / net-worth figures, which would be noise for a budget without goals).
  const hasSavings = computed(() => rows.value.some((r) => r.savingsBalance !== 0))

  // Currencies used somewhere in this budget that cannot be converted right now
  // (exchange rates not loaded). Their amounts are being shown unconverted.
  const unconvertibleCurrencies = computed(() => {
    const inputs = projectionStore.inputs
    const used = new Set<string>()
    const add = (c?: string | null): void => { if (c) used.add(c) }
    add(inputs.currency)
    add(inputs.startingBalanceCurrency)
    inputs.incomeItems.forEach((i) => add(i.currency))
    inputs.expenseItems.forEach((i) => add(i.currency))
    inputs.monthlyAdjustments.forEach((a) => add(a.currency))
    savingsStore.goals.forEach((g) => add(g.currency))
    return [...used].filter((c) => !canShow(c))
  })

  return {
    displayInputs,
    baseTotals,
    displayGoals,
    effectiveInputs,
    rows,
    summary,
    milestones,
    hasSavings,
    unconvertibleCurrencies,
  }
}

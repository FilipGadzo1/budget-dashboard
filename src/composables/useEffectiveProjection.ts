import { computed } from 'vue'

import { useCurrency } from '@/composables/useCurrency'
import { useTimeTravel } from '@/composables/useTimeTravel'
import type { ProjectionInputs, SavingsGoal } from '@/models'
import { monthlyTotals, toDisplayGoal, toDisplayInputs } from '@/services/currencyService'
import { expensesByCategory } from '@/services/itemsService'
import {
  buildProjectionMilestones,
  buildProjectionRows,
  buildProjectionSummary,
} from '@/services/projectionService'
import {
  buildGoalBalances,
  buildSavingsContributionAdjustments,
  savingsStartingBalance,
} from '@/services/savingsProjectionService'
import { useProjectionStore } from '@/stores/projection'
import { useSavingsStore } from '@/stores/savings'

/**
 * The projection every page should show: stored inputs converted to the display
 * currency, plus the savings picture — what is already saved and the planned
 * monthly transfers into savings — and the month being looked at.
 * Every page reads from here so their numbers always agree.
 */
export const useEffectiveProjection = () => {
  const projectionStore = useProjectionStore()
  const savingsStore = useSavingsStore()
  const { currencyCode, locale, selectedMonth, convert, canShow } = useCurrency()
  const { focusIndex } = useTimeTravel()

  // Stored inputs with every amount converted to the display currency.
  const displayInputs = computed(() => toDisplayInputs(projectionStore.inputs, currencyCode.value, convert))

  // Typical monthly income / expenses (before one-time adjustments): items live in
  // the first projection month, with yearly and quarterly ones spread evenly.
  const baseTotals = computed(() => monthlyTotals(displayInputs.value, selectedMonth.value))

  // Monthly spending per category, for itemised budgets.
  const categoryBreakdown = computed(() =>
    expensesByCategory(displayInputs.value.expenseItems, selectedMonth.value),
  )

  const displayGoals = computed(() =>
    savingsStore.goals.map((g) => toDisplayGoal(g, currencyCode.value, convert)),
  )

  // Adds the savings picture to inputs that are already in the display currency.
  const withSavings = (inputs: ProjectionInputs): ProjectionInputs => ({
    ...inputs,
    savingsStartingBalance: savingsStartingBalance(displayGoals.value),
    savingsAdjustments: buildSavingsContributionAdjustments(
      displayGoals.value,
      selectedMonth.value,
      inputs.months,
    ),
  })

  const effectiveInputs = computed((): ProjectionInputs => withSavings(displayInputs.value))

  /**
   * Projects any set of inputs (e.g. a saved scenario) the same way as the live
   * plan: converted to the display currency, from the current starting balance,
   * with the current savings goals. Used to compare plans side by side.
   */
  const projectPlan = (inputs: ProjectionInputs) => {
    const display = toDisplayInputs(inputs, currencyCode.value, convert)
    const planRows = buildProjectionRows(
      withSavings({
        ...display,
        startingBalance: displayInputs.value.startingBalance,
        startingBalanceCurrency: currencyCode.value,
      }),
      selectedMonth.value,
      locale.value,
    )
    return {
      totals: monthlyTotals(display, selectedMonth.value),
      months: display.months,
      rows: planRows,
      summary: buildProjectionSummary(planRows),
      milestones: buildProjectionMilestones(planRows),
    }
  }

  const rows = computed(() =>
    buildProjectionRows(effectiveInputs.value, selectedMonth.value, locale.value),
  )
  const summary = computed(() => buildProjectionSummary(rows.value))
  const milestones = computed(() => buildProjectionMilestones(rows.value))

  // True when savings play any part in this projection (drives the extra
  // savings / net-worth figures, which would be noise for a budget without goals).
  const hasSavings = computed(() => rows.value.some((r) => r.savingsBalance !== 0))

  // ── The month being looked at ─────────────────────────────────────────────
  // No month picked means the end of the plan.
  const hasFocus = computed(() => focusIndex.value !== null && rows.value.length > 0)
  const focusIdx = computed(() =>
    rows.value.length ? Math.min(focusIndex.value ?? rows.value.length - 1, rows.value.length - 1) : -1,
  )
  const focusRow = computed(() => rows.value[focusIdx.value] ?? null)

  // Every goal's balance at the end of each month, in the goal's own currency.
  const goalBalances = computed(() =>
    buildGoalBalances(savingsStore.goals, selectedMonth.value, projectionStore.inputs.months),
  )
  /** What a goal holds in the month being looked at (today's amount when none is picked). */
  const goalAmountAt = (goal: SavingsGoal): number =>
    hasFocus.value ? goalBalances.value[goal.id]?.[focusIdx.value] ?? goal.currentAmount : goal.currentAmount

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
    categoryBreakdown,
    projectPlan,
    displayGoals,
    effectiveInputs,
    rows,
    summary,
    milestones,
    hasSavings,
    hasFocus,
    focusIdx,
    focusRow,
    goalBalances,
    goalAmountAt,
    unconvertibleCurrencies,
  }
}

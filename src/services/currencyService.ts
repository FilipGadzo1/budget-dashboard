import type { ProjectionInputs, SavingsGoal } from '@/models'

/** Converts `amount` from one currency code to another. */
export type ConvertFn = (amount: number, from: string, to: string) => number

// ─── Multi-currency model ─────────────────────────────────────────────────────
// Every stored amount keeps the currency it was entered in:
//   * income/expense items and monthly adjustments carry their own `currency`
//   * `inputs.currency` is the currency of the plain monthlyIncome/monthlyExpenses
//     fields, and the fallback for any item or adjustment without its own
//   * a savings goal has a `currency`; its deposits are in that currency
// The display currency (Settings) is only a view: amounts are converted on the
// way to the screen and never rewritten, so nothing drifts when rates move.

/**
 * Returns a copy of `inputs` with every amount converted to `displayCurrency`.
 * The result is what the projection maths and totals should run on.
 */
export function toDisplayInputs(
  inputs: ProjectionInputs,
  displayCurrency: string,
  convert: ConvertFn,
): ProjectionInputs {
  const base = inputs.currency ?? displayCurrency
  const to = (amount: number, from?: string): number => convert(amount, from ?? base, displayCurrency)

  return {
    ...inputs,
    currency: displayCurrency,
    monthlyIncome: to(inputs.monthlyIncome),
    monthlyExpenses: to(inputs.monthlyExpenses),
    startingBalance: to(inputs.startingBalance ?? 0, inputs.startingBalanceCurrency),
    startingBalanceCurrency: displayCurrency,
    incomeItems: (inputs.incomeItems ?? []).map((i) => ({
      ...i,
      amount: to(i.amount, i.currency),
      currency: displayCurrency,
    })),
    expenseItems: (inputs.expenseItems ?? []).map((i) => ({
      ...i,
      amount: to(i.amount, i.currency),
      currency: displayCurrency,
    })),
    monthlyAdjustments: (inputs.monthlyAdjustments ?? []).map((a) => ({
      ...a,
      incomeAdjustment: to(a.incomeAdjustment, a.currency),
      expenseAdjustment: to(a.expenseAdjustment, a.currency),
      currency: displayCurrency,
    })),
  }
}

/**
 * Monthly income and expenses of inputs that are already in a single currency
 * (see `toDisplayInputs`): the sum of the items when itemised, else the plain field.
 */
export function monthlyTotals(inputs: ProjectionInputs): { income: number; expenses: number } {
  const sum = (items: Array<{ amount: number }>): number => items.reduce((s, i) => s + i.amount, 0)
  return {
    income: inputs.incomeItems?.length ? sum(inputs.incomeItems) : inputs.monthlyIncome,
    expenses: inputs.expenseItems?.length ? sum(inputs.expenseItems) : inputs.monthlyExpenses,
  }
}

/**
 * Moves the budget's base currency to `toCurrency` when the display currency changes.
 * Only the plain fields (and a starting balance held in the base currency) are converted (they have no currency of their own to keep).
 * Items and adjustments are left exactly as entered — any that relied on the old base
 * currency are stamped with it so they are not silently relabelled.
 */
export function rebaseInputs(
  inputs: ProjectionInputs,
  fromCurrency: string,
  toCurrency: string,
  convert: ConvertFn,
): ProjectionInputs {
  const from = inputs.currency ?? fromCurrency
  if (from === toCurrency) return { ...inputs, currency: toCurrency }

  // The starting balance follows the base currency only if that is what it was in;
  // one entered in some other currency is left alone, like an item.
  const balanceCurrency = inputs.startingBalanceCurrency ?? from
  const balanceFollows = balanceCurrency === from

  return {
    ...inputs,
    currency: toCurrency,
    monthlyIncome: convert(inputs.monthlyIncome, from, toCurrency),
    monthlyExpenses: convert(inputs.monthlyExpenses, from, toCurrency),
    startingBalance: balanceFollows
      ? convert(inputs.startingBalance ?? 0, from, toCurrency)
      : inputs.startingBalance,
    startingBalanceCurrency: balanceFollows ? toCurrency : balanceCurrency,
    incomeItems: (inputs.incomeItems ?? []).map((i) => ({ ...i, currency: i.currency ?? from })),
    expenseItems: (inputs.expenseItems ?? []).map((i) => ({ ...i, currency: i.currency ?? from })),
    monthlyAdjustments: (inputs.monthlyAdjustments ?? []).map((a) => ({ ...a, currency: a.currency ?? from })),
  }
}

/** A goal with its amounts converted to `displayCurrency`. */
export function toDisplayGoal(goal: SavingsGoal, displayCurrency: string, convert: ConvertFn): SavingsGoal {
  const from = goal.currency ?? displayCurrency
  return {
    ...goal,
    currency: displayCurrency,
    targetAmount: convert(goal.targetAmount, from, displayCurrency),
    currentAmount: convert(goal.currentAmount, from, displayCurrency),
    monthlyContribution: convert(goal.monthlyContribution, from, displayCurrency),
  }
}

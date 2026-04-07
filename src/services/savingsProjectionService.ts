import type { MonthAdjustment, SavingsDeposit, SavingsGoal } from '@/models'

/**
 * Merges deposit amounts into monthly adjustments as additional expense deductions
 * for the month matching each deposit's depositDate. Returns a new array; does not mutate inputs.
 * Deposits outside any existing adjustment month get a new synthetic adjustment entry.
 * Returns the same array reference when deposits is empty (no allocation needed).
 */
export function mergeDepositsIntoAdjustments(
  existing: MonthAdjustment[],
  deposits: SavingsDeposit[],
): MonthAdjustment[] {
  if (deposits.length === 0) return existing

  // Group deposit amounts by month key (first 7 chars of YYYY-MM-DD)
  const depositByMonth: Record<string, number> = {}
  deposits.forEach((d) => {
    const mk = d.depositDate.slice(0, 7)
    depositByMonth[mk] = (depositByMonth[mk] ?? 0) + d.amount
  })

  // Update existing adjustments that overlap with deposit months
  const updatedKeys = new Set<string>()
  const updated: MonthAdjustment[] = existing.map((adj) => {
    const extra = depositByMonth[adj.monthKey] ?? 0
    if (extra === 0) return adj
    updatedKeys.add(adj.monthKey)
    return { ...adj, expenseAdjustment: adj.expenseAdjustment + extra }
  })

  // Add new synthetic adjustments for deposit months with no existing entry
  Object.entries(depositByMonth).forEach(([mk, amount]) => {
    if (updatedKeys.has(mk)) return
    updated.push({
      id: `__deposit__${mk}`,
      monthKey: mk,
      incomeAdjustment: 0,
      expenseAdjustment: amount,
    })
  })

  return updated
}

/**
 * Builds a list of per-month savings contribution adjustments for active goals.
 * Only generates entries for months where at least one goal is still active
 * (status === 'active' AND targetDate is null or >= that month).
 * Returns an empty array if no goals are active.
 */
export function buildSavingsContributionAdjustments(
  goals: SavingsGoal[],
  startMonth: string,
  months: number,
): MonthAdjustment[] {
  const activeGoals = goals.filter((g) => g.status === 'active' && g.monthlyContribution > 0)
  if (activeGoals.length === 0) return []

  const result: MonthAdjustment[] = []
  for (let i = 0; i < months; i++) {
    const d = new Date(`${startMonth}-01`)
    d.setMonth(d.getMonth() + i, 1)
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const total = activeGoals
      .filter((g) => !g.targetDate || g.targetDate.slice(0, 7) >= mk)
      .reduce((sum, g) => sum + g.monthlyContribution, 0)
    if (total > 0) {
      result.push({
        id: `__savings_contribution__${mk}`,
        monthKey: mk,
        incomeAdjustment: 0,
        expenseAdjustment: total,
      })
    }
  }
  return result
}

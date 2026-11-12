import type { MonthAdjustment, SavingsGoal } from '@/models'
import { monthKeyToDate } from '@/utils/date'

// Savings are a TRANSFER, not an expense: a contribution moves money from the cash
// balance into savings, and net worth (cash + savings) is unchanged by it.
//
// Recorded deposits are history. They are already included in each goal's
// `currentAmount`, which is where the projection's savings balance starts, so they
// are deliberately not replayed as cash movements — the starting cash balance the
// user enters already reflects money they have moved.

/** What is already saved across all goals — the projection's opening savings balance. */
export function savingsStartingBalance(goals: SavingsGoal[]): number {
  return goals.reduce((sum, g) => sum + g.currentAmount, 0)
}

/**
 * Planned monthly transfers into savings, one entry per month that has any.
 * A goal contributes while it is `active`, its target date (if set) has not passed,
 * and it has not yet reached its target — the final contribution is trimmed so the
 * goal lands exactly on target, after which that money stays in the cash balance.
 *
 * The amount is carried in `expenseAdjustment` of a synthetic MonthAdjustment.
 * Goals must already be in a single currency (see `toDisplayGoal`).
 */
export function buildSavingsContributionAdjustments(
  goals: SavingsGoal[],
  startMonth: string,
  months: number,
): MonthAdjustment[] {
  const activeGoals = goals.filter((g) => g.status === 'active' && g.monthlyContribution > 0)
  if (activeGoals.length === 0) return []

  const saved = new Map(activeGoals.map((g) => [g.id, g.currentAmount]))
  const result: MonthAdjustment[] = []

  for (let i = 0; i < months; i++) {
    // monthKeyToDate builds a local-time date; `new Date('YYYY-MM-01')` would parse
    // as UTC and land in the previous month for timezones behind UTC.
    const d = monthKeyToDate(startMonth)
    d.setMonth(d.getMonth() + i, 1)
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    let total = 0
    activeGoals.forEach((g) => {
      if (g.targetDate && g.targetDate.slice(0, 7) < mk) return
      const soFar = saved.get(g.id) ?? 0
      const contribution = Math.min(g.monthlyContribution, Math.max(0, g.targetAmount - soFar))
      if (contribution <= 0) return
      saved.set(g.id, soFar + contribution)
      total += contribution
    })

    if (total > 0) {
      result.push({
        id: `__savings_contribution__${mk}`,
        monthKey: mk,
        incomeAdjustment: 0,
        expenseAdjustment: Math.round(total * 100) / 100,
      })
    }
  }
  return result
}

import type { MonthAdjustment, SavingsDeposit } from '@/models'

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

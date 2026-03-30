import type { SavingsGoal } from '@/models'

const STATUS_ORDER: Record<string, number> = { active: 0, paused: 1, completed: 2 }

/**
 * Returns progress toward the goal as a percentage, clamped 0–100.
 */
export function computeProgress(goal: SavingsGoal): number {
  if (goal.targetAmount <= 0) return 100
  return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
}

/**
 * Returns how much is still needed to reach the goal (never negative).
 */
export function computeRemaining(goal: SavingsGoal): number {
  return Math.max(0, goal.targetAmount - goal.currentAmount)
}

/**
 * Returns the number of whole months from today (or `now`) until the target date.
 * Returns null when no targetDate is set.
 * Returns 0 when the deadline has already passed.
 */
export function computeMonthsRemaining(goal: SavingsGoal, now: Date = new Date()): number | null {
  if (!goal.targetDate) return null

  const target = new Date(goal.targetDate)
  // Work in whole months: year/month difference
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth())

  return Math.max(0, months)
}

/**
 * Returns the monthly saving required to reach the goal by its target date.
 * Returns null when the goal is already reached or has no target date.
 */
export function computeRequiredMonthly(goal: SavingsGoal, now: Date = new Date()): number | null {
  const remaining = computeRemaining(goal)
  if (remaining <= 0) return null

  const months = computeMonthsRemaining(goal, now)
  if (months === null || months === 0) return null

  return Math.ceil(remaining / months)
}

/**
 * Returns true when the goal's current amount has reached or exceeded the target.
 */
export function isGoalReached(goal: SavingsGoal): boolean {
  return goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0
}

/**
 * Sorts goals: active first, then paused, then completed.
 * Within the same status, preserves sort_order ascending.
 */
export function sortGoals(goals: SavingsGoal[]): SavingsGoal[] {
  return [...goals].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    if (statusDiff !== 0) return statusDiff
    return a.sortOrder - b.sortOrder
  })
}

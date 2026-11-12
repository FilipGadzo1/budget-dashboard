import type { BudgetItem } from '@/models'

// ─── Recurring items ──────────────────────────────────────────────────────────
// An income or expense item repeats every `everyMonths` months (1 = monthly,
// 12 = yearly) and is only live between `startMonth` and `endMonth` (inclusive,
// YYYY-MM, both optional). For anything other than monthly, `startMonth` is also
// the anchor: the item lands on that month and every `everyMonths` after it.

export const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Monthly' },
  { value: 3, label: 'Every 3 months' },
  { value: 6, label: 'Every 6 months' },
  { value: 12, label: 'Yearly' },
]

export const UNCATEGORISED = 'Uncategorised'

const monthIndex = (monthKey: string): number => {
  const [year, month] = monthKey.split('-').map(Number)
  return year * 12 + (month ?? 1) - 1
}

const interval = (item: BudgetItem): number => (item.everyMonths && item.everyMonths > 1 ? item.everyMonths : 1)

/** True when `monthKey` is inside the item's start/end window. */
export function isActiveIn(item: BudgetItem, monthKey: string): boolean {
  if (item.startMonth && monthKey < item.startMonth) return false
  if (item.endMonth && monthKey > item.endMonth) return false
  return true
}

/**
 * True when the item actually lands in `monthKey`.
 * `projectionStart` anchors non-monthly items that have no start month of their own.
 */
export function occursIn(item: BudgetItem, monthKey: string, projectionStart: string): boolean {
  if (!isActiveIn(item, monthKey)) return false
  const every = interval(item)
  if (every === 1) return true
  const offset = monthIndex(monthKey) - monthIndex(item.startMonth ?? projectionStart)
  return offset >= 0 && offset % every === 0
}

/** Total of the items that land in `monthKey`. */
export function amountIn(items: BudgetItem[], monthKey: string, projectionStart: string): number {
  return items.reduce((sum, item) => (occursIn(item, monthKey, projectionStart) ? sum + item.amount : sum), 0)
}

/** The item's cost spread evenly per month (a 1,200 yearly bill is 100 a month). */
export function monthlyEquivalent(item: BudgetItem): number {
  return item.amount / interval(item)
}

/** True when the item has a schedule other than "monthly, forever". */
export function hasSchedule(item: BudgetItem): boolean {
  return interval(item) > 1 || !!item.startMonth || !!item.endMonth
}

/** Short description of an item's schedule, or '' for plain monthly items. */
export function describeSchedule(item: BudgetItem, locale: string): string {
  const month = (key: string): string => {
    const [year, m] = key.split('-').map(Number)
    return new Date(year, (m ?? 1) - 1, 1).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  }
  const every = interval(item)
  const parts: string[] = []
  if (every > 1) parts.push(FREQUENCY_OPTIONS.find((o) => o.value === every)?.label ?? `Every ${every} months`)
  if (item.startMonth) parts.push(`from ${month(item.startMonth)}`)
  if (item.endMonth) parts.push(`until ${month(item.endMonth)}`)
  return parts.join(' · ')
}

/**
 * Monthly spending per category for the items live in `monthKey`, largest first.
 * Uses the monthly equivalent, so a yearly bill counts for a twelfth each month.
 */
export function expensesByCategory(
  items: BudgetItem[],
  monthKey: string,
): Array<{ category: string; amount: number }> {
  const totals = new Map<string, number>()
  items.forEach((item) => {
    if (!isActiveIn(item, monthKey)) return
    const category = item.category?.trim() || UNCATEGORISED
    totals.set(category, (totals.get(category) ?? 0) + monthlyEquivalent(item))
  })
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

import type { ProjectionInputs, ProjectionRow } from '@/models'
import { amountIn } from '@/services/itemsService'
import { formatDisplayMonth, monthKeyToDate } from '@/utils/date'

const addMonths = (date: Date, value: number): Date => {
  const next = new Date(date)
  next.setMonth(next.getMonth() + value, 1)
  return next
}

const toMonthKey = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`

export const buildProjectionRows = (
  inputs: ProjectionInputs,
  startMonth: string,
  locale: string,
): ProjectionRow[] => {
  const startDate = monthKeyToDate(startMonth)
  // Itemised budgets are summed month by month, because items can be yearly or
  // quarterly and can start or stop part-way through the projection.
  const incomeFor = (monthKey: string): number =>
    inputs.incomeItems?.length ? amountIn(inputs.incomeItems, monthKey, startMonth) : inputs.monthlyIncome
  const expensesFor = (monthKey: string): number =>
    inputs.expenseItems?.length ? amountIn(inputs.expenseItems, monthKey, startMonth) : inputs.monthlyExpenses
  const adjustments = inputs.monthlyAdjustments ?? []
  const savingsAdjs = inputs.savingsAdjustments ?? []
  // Cash and savings are tracked separately: a savings contribution moves money
  // from one to the other and leaves net worth unchanged.
  let cash = inputs.startingBalance ?? 0
  let savings = inputs.savingsStartingBalance ?? 0

  return Array.from({ length: inputs.months }, (_, index) => {
    const currentDate = addMonths(startDate, index)
    const monthKey = toMonthKey(currentDate)
    const adj = adjustments.find((a) => a.monthKey === monthKey)
    const savAdj = savingsAdjs.find((a) => a.monthKey === monthKey)
    const savingsContribution = savAdj?.expenseAdjustment ?? 0
    const rowIncome = incomeFor(monthKey) + (adj?.incomeAdjustment ?? 0)
    const rowExpenses = expensesFor(monthKey) + (adj?.expenseAdjustment ?? 0)
    const rowNet = rowIncome - rowExpenses
    const cashChange = rowNet - savingsContribution
    cash += cashChange
    savings += savingsContribution

    return {
      monthKey,
      monthLabel: formatDisplayMonth(monthKey, locale),
      income: rowIncome,
      expenses: rowExpenses,
      net: rowNet,
      savingsContribution,
      cashChange,
      cumulativeBalance: cash,
      savingsBalance: savings,
      netWorth: cash + savings,
      incomeAdjustment: adj?.incomeAdjustment ?? 0,
      expenseAdjustment: adj?.expenseAdjustment ?? 0,
      adjustmentNote: adj?.note,
    }
  })
}

export const buildProjectionSummary = (
  rows: ProjectionRow[],
) => {
  const totalIncome = rows.reduce((total, row) => total + row.income, 0)
  const totalExpenses = rows.reduce((total, row) => total + row.expenses, 0)
  const totalNet = rows.reduce((total, row) => total + row.net, 0)
  const totalSaved = rows.reduce((total, row) => total + row.savingsContribution, 0)
  const last = rows.at(-1)

  return {
    totalIncome,
    totalExpenses,
    totalNet,
    totalSaved,                                  // moved into savings over the horizon
    endingBalance: last?.cumulativeBalance ?? 0, // cash
    endingSavings: last?.savingsBalance ?? 0,
    endingNetWorth: last?.netWorth ?? 0,
  }
}

export const buildProjectionTrendPath = (
  rows: ProjectionRow[],
  width: number,
  height: number,
  padding = 10,
): string => {
  if (!rows.length) {
    return ''
  }

  if (rows.length === 1) {
    const centerY = height / 2
    return `M ${padding} ${centerY} L ${width - padding} ${centerY}`
  }

  const balances = rows.map((row) => row.cumulativeBalance)
  const minBalance = Math.min(...balances)
  const maxBalance = Math.max(...balances)
  const range = maxBalance - minBalance || 1
  const availableWidth = width - padding * 2
  const availableHeight = height - padding * 2

  return balances
    .map((balance, index) => {
      const x = padding + (availableWidth * index) / (balances.length - 1)
      const y = height - padding - ((balance - minBalance) / range) * availableHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

export const buildProjectionMilestones = (rows: ProjectionRow[]) => {
  const firstNegativeRow = rows.find((row) => row.cumulativeBalance < 0) ?? null
  const highestBalanceRow = rows.reduce<ProjectionRow | null>((best, row) => {
    if (!best || row.cumulativeBalance > best.cumulativeBalance) {
      return row
    }

    return best
  }, null)

  return {
    firstNegativeMonthLabel: firstNegativeRow?.monthLabel ?? null,
    highestBalanceMonthLabel: highestBalanceRow?.monthLabel ?? null,
    highestBalance: highestBalanceRow?.cumulativeBalance ?? 0,
  }
}

interface ProjectionShareSummaryOptions {
  startMonthLabel: string
  endMonthLabel: string
  totalIncome: string
  totalExpenses: string
  totalNet: string
  endingBalance: string
  firstNegativeMonthLabel: string | null
  highestBalanceMonthLabel: string | null
  highestBalance: string
  endingNetWorth?: string
}

export const buildProjectionShareSummary = ({
  startMonthLabel,
  endMonthLabel,
  totalIncome,
  totalExpenses,
  totalNet,
  endingBalance,
  firstNegativeMonthLabel,
  highestBalanceMonthLabel,
  highestBalance,
  endingNetWorth,
}: ProjectionShareSummaryOptions): string =>
  [
    'Budget Projection Snapshot',
    `Window: ${startMonthLabel} -> ${endMonthLabel}`,
    `Total income: ${totalIncome}`,
    `Total expenses: ${totalExpenses}`,
    `Total net: ${totalNet}`,
    `Ending cash balance: ${endingBalance}`,
    ...(endingNetWorth ? [`Ending net worth (cash + savings): ${endingNetWorth}`] : []),
    `First negative month: ${firstNegativeMonthLabel ?? 'Never dips below zero'}`,
    `Peak balance month: ${highestBalanceMonthLabel ?? 'N/A'}`,
    `Peak balance: ${highestBalance}`,
  ].join('\n')

import type { ProjectionInputs, ProjectionRow } from '@/models'
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
  const expenses = inputs.expenseItems?.length
    ? inputs.expenseItems.reduce((s, i) => s + i.amount, 0)
    : inputs.monthlyExpenses
  const net = inputs.monthlyIncome - expenses
  let runningBalance = 0

  return Array.from({ length: inputs.months }, (_, index) => {
    const currentDate = addMonths(startDate, index)
    runningBalance += net

    return {
      monthKey: toMonthKey(currentDate),
      monthLabel: formatDisplayMonth(toMonthKey(currentDate), locale),
      income: inputs.monthlyIncome,
      expenses,
      net,
      cumulativeBalance: runningBalance,
    }
  })
}

export const buildProjectionSummary = (
  rows: ProjectionRow[],
) => {
  const totalIncome = rows.reduce((total, row) => total + row.income, 0)
  const totalExpenses = rows.reduce((total, row) => total + row.expenses, 0)
  const totalNet = rows.reduce((total, row) => total + row.net, 0)
  const endingBalance = rows.at(-1)?.cumulativeBalance ?? 0

  return {
    totalIncome,
    totalExpenses,
    totalNet,
    endingBalance,
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

export const calculateBreakEvenGap = (inputs: ProjectionInputs): number => {
  const expenses = inputs.expenseItems?.length
    ? inputs.expenseItems.reduce((s, i) => s + i.amount, 0)
    : inputs.monthlyExpenses
  return Math.max(expenses - inputs.monthlyIncome, 0)
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
}: ProjectionShareSummaryOptions): string =>
  [
    'Budget Projection Snapshot',
    `Window: ${startMonthLabel} -> ${endMonthLabel}`,
    `Total income: ${totalIncome}`,
    `Total expenses: ${totalExpenses}`,
    `Total net: ${totalNet}`,
    `Ending balance: ${endingBalance}`,
    `First negative month: ${firstNegativeMonthLabel ?? 'Never dips below zero'}`,
    `Peak balance month: ${highestBalanceMonthLabel ?? 'N/A'}`,
    `Peak balance: ${highestBalance}`,
  ].join('\n')

import { describe, expect, it } from 'vitest'

import {
  buildProjectionRows,
  buildProjectionSummary,
  buildProjectionTrendPath,
  buildProjectionMilestones,
  buildProjectionShareSummary,
} from './projectionService'

describe('projectionService', () => {
  it('builds projection rows with cumulative balances across months', () => {
    const rows = buildProjectionRows(
      {
        monthlyIncome: 4200,
        monthlyExpenses: 3000,
        months: 3,
        incomeItems: [],
        expenseItems: [],
        monthlyAdjustments: [],
      },
      '2026-01',
      'en-US',
    )

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.monthKey)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(rows.map((row) => row.net)).toEqual([1200, 1200, 1200])
    expect(rows.map((row) => row.cumulativeBalance)).toEqual([1200, 2400, 3600])
  })

  it('summarizes totals from projection rows', () => {
    const rows = buildProjectionRows(
      {
        monthlyIncome: 2000,
        monthlyExpenses: 1500,
        months: 2,
        incomeItems: [],
        expenseItems: [],
        monthlyAdjustments: [],
      },
      '2026-04',
      'en-US',
    )

    expect(buildProjectionSummary(rows)).toEqual({
      totalIncome: 4000,
      totalExpenses: 3000,
      totalNet: 1000,
      totalSaved: 0,
      endingBalance: 1000,
      endingSavings: 0,
      endingNetWorth: 1000,
    })
  })

  it('starts the cash balance from the starting balance', () => {
    const rows = buildProjectionRows(
      {
        monthlyIncome: 3000,
        monthlyExpenses: 2500,
        months: 2,
        startingBalance: 10000,
        incomeItems: [],
        expenseItems: [],
        monthlyAdjustments: [],
      },
      '2026-01',
      'en-US',
    )

    expect(rows.map((row) => row.cumulativeBalance)).toEqual([10500, 11000])
  })

  it('treats savings contributions as a transfer, not an expense', () => {
    const rows = buildProjectionRows(
      {
        monthlyIncome: 3000,
        monthlyExpenses: 2000,
        months: 2,
        startingBalance: 1000,
        incomeItems: [],
        expenseItems: [],
        monthlyAdjustments: [],
        savingsStartingBalance: 5000,
        savingsAdjustments: [
          { id: 's1', monthKey: '2026-01', incomeAdjustment: 0, expenseAdjustment: 400 },
          { id: 's2', monthKey: '2026-02', incomeAdjustment: 0, expenseAdjustment: 400 },
        ],
      },
      '2026-01',
      'en-US',
    )

    // Expenses and net are untouched by saving
    expect(rows.map((row) => row.expenses)).toEqual([2000, 2000])
    expect(rows.map((row) => row.net)).toEqual([1000, 1000])
    // Cash grows by net minus what moved to savings; savings grows by the same amount
    expect(rows.map((row) => row.cumulativeBalance)).toEqual([1600, 2200])
    expect(rows.map((row) => row.savingsBalance)).toEqual([5400, 5800])
    // Net worth = cash + savings, and rises by exactly the net each month
    expect(rows.map((row) => row.netWorth)).toEqual([7000, 8000])

    expect(buildProjectionSummary(rows)).toMatchObject({
      totalExpenses: 4000,
      totalSaved: 800,
      endingBalance: 2200,
      endingSavings: 5800,
      endingNetWorth: 8000,
    })
  })

  it('builds a trend path for chart rendering', () => {
    const rows = buildProjectionRows(
      {
        monthlyIncome: 3000,
        monthlyExpenses: 2500,
        months: 3,
        incomeItems: [],
        expenseItems: [],
        monthlyAdjustments: [],
      },
      '2026-01',
      'en-US',
    )

    expect(buildProjectionTrendPath(rows, 320, 120)).toMatch(/^M /)
    expect(buildProjectionTrendPath(rows, 320, 120)).toContain('L')
  })

  it('extracts milestone labels from projection rows', () => {
    const rows = buildProjectionRows(
      {
        monthlyIncome: 1800,
        monthlyExpenses: 2200,
        months: 4,
        incomeItems: [],
        expenseItems: [],
        monthlyAdjustments: [],
      },
      '2026-01',
      'en-US',
    )

    expect(buildProjectionMilestones(rows)).toEqual({
      firstNegativeMonthLabel: 'January 2026',
      highestBalanceMonthLabel: 'January 2026',
      highestBalance: -400,
    })
  })

  it('builds a portable text summary', () => {
    expect(
      buildProjectionShareSummary({
        startMonthLabel: 'January 2026',
        endMonthLabel: 'December 2026',
        totalIncome: 'EUR 48,000',
        totalExpenses: 'EUR 36,000',
        totalNet: 'EUR 12,000',
        endingBalance: 'EUR 12,000',
        firstNegativeMonthLabel: null,
        highestBalanceMonthLabel: 'December 2026',
        highestBalance: 'EUR 12,000',
      }),
    ).toContain('Budget Projection Snapshot')
  })
})

import { describe, expect, it } from 'vitest'

import {
  buildProjectionRows,
  buildProjectionSummary,
  buildProjectionTrendPath,
  buildProjectionMilestones,
  buildProjectionShareSummary,
  calculateBreakEvenGap,
} from './projectionService'

describe('projectionService', () => {
  it('builds projection rows with cumulative balances across months', () => {
    const rows = buildProjectionRows(
      {
        monthlyIncome: 4200,
        monthlyExpenses: 3000,
        months: 3,
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
      endingBalance: 1000,
    })
  })

  it('builds a trend path for chart rendering', () => {
    const rows = buildProjectionRows(
      {
        monthlyIncome: 3000,
        monthlyExpenses: 2500,
        months: 3,
        expenseItems: [],
        monthlyAdjustments: [],
      },
      '2026-01',
      'en-US',
    )

    expect(buildProjectionTrendPath(rows, 320, 120)).toMatch(/^M /)
    expect(buildProjectionTrendPath(rows, 320, 120)).toContain('L')
  })

  it('calculates the monthly break-even gap for deficit plans', () => {
    expect(
      calculateBreakEvenGap({
        monthlyIncome: 2400,
        monthlyExpenses: 3000,
        months: 12,
        expenseItems: [],
        monthlyAdjustments: [],
      }),
    ).toBe(600)

    expect(
      calculateBreakEvenGap({
        monthlyIncome: 3200,
        monthlyExpenses: 3000,
        months: 12,
        expenseItems: [],
        monthlyAdjustments: [],
      }),
    ).toBe(0)
  })

  it('extracts milestone labels from projection rows', () => {
    const rows = buildProjectionRows(
      {
        monthlyIncome: 1800,
        monthlyExpenses: 2200,
        months: 4,
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

import type { BudgetItem } from '@/models'

import {
  amountIn,
  describeSchedule,
  expensesByCategory,
  hasSchedule,
  isActiveIn,
  monthlyEquivalent,
  occursIn,
} from './itemsService'

const item = (overrides: Partial<BudgetItem> = {}): BudgetItem => ({
  id: 'i1',
  name: 'Item',
  amount: 1200,
  ...overrides,
})

const START = '2026-01'

describe('occursIn', () => {
  it('lands every month for a plain monthly item', () => {
    expect(occursIn(item(), '2026-01', START)).toBe(true)
    expect(occursIn(item(), '2027-08', START)).toBe(true)
  })

  it('respects the start and end months, inclusive', () => {
    const loan = item({ startMonth: '2026-03', endMonth: '2026-05' })
    expect(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].map((m) => occursIn(loan, m, START)))
      .toEqual([false, true, true, true, false])
  })

  it('lands a yearly item on its anchor month each year', () => {
    const insurance = item({ everyMonths: 12, startMonth: '2026-03' })
    expect(occursIn(insurance, '2026-03', START)).toBe(true)
    expect(occursIn(insurance, '2026-04', START)).toBe(false)
    expect(occursIn(insurance, '2027-03', START)).toBe(true)
    expect(occursIn(insurance, '2025-03', START)).toBe(false)
  })

  it('lands a quarterly item every third month', () => {
    const quarterly = item({ everyMonths: 3, startMonth: '2026-02' })
    const months = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-08']
    expect(months.map((m) => occursIn(quarterly, m, START))).toEqual([true, false, false, true, true])
  })

  it('anchors a non-monthly item without a start month to the projection start', () => {
    const yearly = item({ everyMonths: 12 })
    expect(occursIn(yearly, '2026-01', START)).toBe(true)
    expect(occursIn(yearly, '2026-06', START)).toBe(false)
    expect(occursIn(yearly, '2027-01', START)).toBe(true)
  })

  it('stops a recurring item after its end month', () => {
    const yearly = item({ everyMonths: 12, startMonth: '2026-01', endMonth: '2026-12' })
    expect(occursIn(yearly, '2027-01', START)).toBe(false)
  })
})

describe('amountIn', () => {
  it('sums only the items that land in the month', () => {
    const items = [
      item({ id: 'rent', amount: 900 }),
      item({ id: 'insurance', amount: 600, everyMonths: 12, startMonth: '2026-03' }),
      item({ id: 'raise', amount: 200, startMonth: '2026-06' }),
    ]
    expect(amountIn(items, '2026-01', START)).toBe(900)
    expect(amountIn(items, '2026-03', START)).toBe(1500)
    expect(amountIn(items, '2026-06', START)).toBe(1100)
  })
})

describe('monthlyEquivalent / hasSchedule / isActiveIn', () => {
  it('spreads a yearly amount over twelve months', () => {
    expect(monthlyEquivalent(item({ amount: 1200, everyMonths: 12 }))).toBe(100)
    expect(monthlyEquivalent(item({ amount: 1200 }))).toBe(1200)
  })

  it('reports whether an item has a non-default schedule', () => {
    expect(hasSchedule(item())).toBe(false)
    expect(hasSchedule(item({ everyMonths: 1 }))).toBe(false)
    expect(hasSchedule(item({ everyMonths: 3 }))).toBe(true)
    expect(hasSchedule(item({ endMonth: '2026-12' }))).toBe(true)
  })

  it('treats an item with no dates as always active', () => {
    expect(isActiveIn(item(), '1999-01')).toBe(true)
  })
})

describe('describeSchedule', () => {
  it('is empty for a plain monthly item', () => {
    expect(describeSchedule(item(), 'en-US')).toBe('')
  })

  it('describes frequency and dates', () => {
    expect(describeSchedule(item({ everyMonths: 12, startMonth: '2026-03', endMonth: '2028-03' }), 'en-US'))
      .toBe('Yearly · from Mar 2026 · until Mar 2028')
  })
})

describe('expensesByCategory', () => {
  it('groups live items by category using their monthly equivalent, largest first', () => {
    const result = expensesByCategory(
      [
        item({ id: 'rent', amount: 900, category: 'Housing' }),
        item({ id: 'power', amount: 100, category: 'Housing' }),
        item({ id: 'insurance', amount: 1200, everyMonths: 12, category: 'Insurance' }),
        item({ id: 'misc', amount: 50 }),
        item({ id: 'ended', amount: 999, category: 'Debt', endMonth: '2025-12' }),
      ],
      '2026-01',
    )

    expect(result).toEqual([
      { category: 'Housing', amount: 1000 },
      { category: 'Insurance', amount: 100 },
      { category: 'Uncategorised', amount: 50 },
    ])
  })
})

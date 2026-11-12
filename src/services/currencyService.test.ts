import type { ProjectionInputs, SavingsGoal } from '@/models'

import {
  monthlyTotals,
  rebaseInputs,
  toDisplayGoal,
  toDisplayInputs,
} from './currencyService'

// 1 EUR = 10 SEK
const RATES: Record<string, number> = { EUR: 1, SEK: 10 }
const convert = (amount: number, from: string, to: string): number =>
  from === to ? amount : Math.round(amount * (RATES[to]! / RATES[from]!) * 100) / 100

const inputs = (overrides: Partial<ProjectionInputs> = {}): ProjectionInputs => ({
  monthlyIncome: 0,
  monthlyExpenses: 0,
  months: 12,
  incomeItems: [],
  expenseItems: [],
  monthlyAdjustments: [],
  ...overrides,
})

describe('toDisplayInputs', () => {
  it('combines income entered in different currencies', () => {
    const display = toDisplayInputs(
      inputs({
        currency: 'EUR',
        incomeItems: [
          { id: 'me', name: 'My pay', amount: 3000, currency: 'EUR' },
          { id: 'wife', name: "Wife's pay", amount: 30000, currency: 'SEK' },
        ],
      }),
      'EUR',
      convert,
    )

    expect(display.incomeItems.map((i) => i.amount)).toEqual([3000, 3000])
    expect(monthlyTotals(display).income).toBe(6000)
  })

  it('shows the same budget in another display currency without touching the source', () => {
    const source = inputs({
      currency: 'EUR',
      incomeItems: [
        { id: 'me', name: 'My pay', amount: 3000, currency: 'EUR' },
        { id: 'wife', name: "Wife's pay", amount: 30000, currency: 'SEK' },
      ],
    })
    const display = toDisplayInputs(source, 'SEK', convert)

    expect(monthlyTotals(display).income).toBe(60000)
    expect(source.incomeItems[0]?.amount).toBe(3000)
    expect(source.incomeItems[0]?.currency).toBe('EUR')
  })

  it('treats items and adjustments without a currency as being in the base currency', () => {
    const display = toDisplayInputs(
      inputs({
        currency: 'SEK',
        monthlyIncome: 20000,
        expenseItems: [{ id: 'rent', name: 'Rent', amount: 10000, sortOrder: 0 }],
        monthlyAdjustments: [{ id: 'a', monthKey: '2026-01', incomeAdjustment: 5000, expenseAdjustment: 1000 }],
      }),
      'EUR',
      convert,
    )

    expect(display.monthlyIncome).toBe(2000)
    expect(display.expenseItems[0]?.amount).toBe(1000)
    expect(display.monthlyAdjustments[0]).toMatchObject({ incomeAdjustment: 500, expenseAdjustment: 100 })
  })

  it('converts the starting balance from the currency it was entered in', () => {
    const display = toDisplayInputs(
      inputs({ currency: 'EUR', startingBalance: 20000, startingBalanceCurrency: 'SEK' }),
      'EUR',
      convert,
    )
    expect(display.startingBalance).toBe(2000)
  })

  it('falls back to the display currency when the budget has no base currency yet', () => {
    const display = toDisplayInputs(inputs({ monthlyIncome: 4000 }), 'EUR', convert)
    expect(display.monthlyIncome).toBe(4000)
  })
})

describe('rebaseInputs', () => {
  it('converts the plain fields and keeps every item as it was entered', () => {
    const rebased = rebaseInputs(
      inputs({
        currency: 'EUR',
        monthlyIncome: 3000,
        monthlyExpenses: 2000,
        expenseItems: [{ id: 'rent', name: 'Rent', amount: 900, sortOrder: 0 }],
        incomeItems: [{ id: 'wife', name: "Wife's pay", amount: 30000, currency: 'SEK' }],
      }),
      'EUR',
      'SEK',
      convert,
    )

    expect(rebased.currency).toBe('SEK')
    expect(rebased.monthlyIncome).toBe(30000)
    expect(rebased.monthlyExpenses).toBe(20000)
    // Untagged item is stamped with the old base currency, not relabelled as SEK
    expect(rebased.expenseItems[0]).toMatchObject({ amount: 900, currency: 'EUR' })
    expect(rebased.incomeItems[0]).toMatchObject({ amount: 30000, currency: 'SEK' })
  })

  it('converts a starting balance held in the base currency and leaves others alone', () => {
    const inBase = rebaseInputs(inputs({ currency: 'EUR', startingBalance: 1000 }), 'EUR', 'SEK', convert)
    expect(inBase).toMatchObject({ startingBalance: 10000, startingBalanceCurrency: 'SEK' })

    const inOther = rebaseInputs(
      inputs({ currency: 'EUR', startingBalance: 5000, startingBalanceCurrency: 'SEK' }),
      'EUR',
      'SEK',
      convert,
    )
    expect(inOther).toMatchObject({ startingBalance: 5000, startingBalanceCurrency: 'SEK' })
  })

  it('gives the same totals before and after rebasing', () => {
    const source = inputs({
      currency: 'EUR',
      monthlyIncome: 3000,
      expenseItems: [{ id: 'rent', name: 'Rent', amount: 900, sortOrder: 0 }],
    })
    const before = monthlyTotals(toDisplayInputs(source, 'SEK', convert))
    const after = monthlyTotals(toDisplayInputs(rebaseInputs(source, 'EUR', 'SEK', convert), 'SEK', convert))

    expect(after).toEqual(before)
  })
})

describe('savings conversion', () => {
  const goal: SavingsGoal = {
    id: 'g1', userId: 'u1', name: 'Car', emoji: '🚗', currency: 'SEK',
    targetAmount: 100000, currentAmount: 20000, monthlyContribution: 5000,
    targetDate: null, status: 'active', note: null, sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('converts a goal to the display currency', () => {
    expect(toDisplayGoal(goal, 'EUR', convert)).toMatchObject({
      targetAmount: 10000,
      currentAmount: 2000,
      monthlyContribution: 500,
    })
  })
})

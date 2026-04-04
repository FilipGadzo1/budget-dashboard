import type { MonthAdjustment, SavingsDeposit } from '@/models'
import { mergeDepositsIntoAdjustments } from './savingsProjectionService'

const makeAdj = (overrides: Partial<MonthAdjustment> = {}): MonthAdjustment => ({
  id: 'adj-1',
  monthKey: '2026-04',
  incomeAdjustment: 0,
  expenseAdjustment: 0,
  ...overrides,
})

const makeDeposit = (overrides: Partial<SavingsDeposit> = {}): SavingsDeposit => ({
  id: 'dep-1',
  goalId: 'goal-1',
  userId: 'user-1',
  amount: 500,
  note: null,
  depositDate: '2026-04-15',
  createdAt: '2026-04-15T10:00:00.000Z',
  ...overrides,
})

describe('mergeDepositsIntoAdjustments', () => {
  it('returns same array reference when deposits is empty', () => {
    const existing = [makeAdj()]
    expect(mergeDepositsIntoAdjustments(existing, [])).toBe(existing)
  })

  it('adds deposit amount to existing adjustment for matching month', () => {
    const existing = [makeAdj({ monthKey: '2026-04', expenseAdjustment: 100 })]
    const result = mergeDepositsIntoAdjustments(existing, [makeDeposit({ amount: 500, depositDate: '2026-04-15' })])
    expect(result[0].expenseAdjustment).toBe(600)
    expect(result[0].incomeAdjustment).toBe(0)
  })

  it('creates a new adjustment for a month with no existing entry', () => {
    const result = mergeDepositsIntoAdjustments([], [makeDeposit({ amount: 300, depositDate: '2026-06-10' })])
    expect(result).toHaveLength(1)
    expect(result[0].monthKey).toBe('2026-06')
    expect(result[0].expenseAdjustment).toBe(300)
    expect(result[0].incomeAdjustment).toBe(0)
  })

  it('sums multiple deposits in the same month', () => {
    const result = mergeDepositsIntoAdjustments(
      [],
      [
        makeDeposit({ id: 'd1', amount: 200, depositDate: '2026-04-01' }),
        makeDeposit({ id: 'd2', amount: 350, depositDate: '2026-04-20' }),
      ],
    )
    expect(result).toHaveLength(1)
    expect(result[0].expenseAdjustment).toBe(550)
  })

  it('does not mutate the input array', () => {
    const existing = [makeAdj({ monthKey: '2026-04', expenseAdjustment: 0 })]
    const copy = [...existing]
    mergeDepositsIntoAdjustments(existing, [makeDeposit()])
    expect(existing).toEqual(copy)
  })

  it('preserves existing incomeAdjustment when adding deposit', () => {
    const existing = [makeAdj({ monthKey: '2026-04', incomeAdjustment: 200, expenseAdjustment: 50 })]
    const result = mergeDepositsIntoAdjustments(existing, [makeDeposit({ amount: 100, depositDate: '2026-04-01' })])
    expect(result[0].incomeAdjustment).toBe(200)
    expect(result[0].expenseAdjustment).toBe(150)
  })
})

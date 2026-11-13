import type { SavingsGoal } from '@/models'

import { buildGoalBalances, buildSavingsContributionAdjustments, savingsStartingBalance } from './savingsProjectionService'

const goal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 'g1',
  userId: 'u1',
  name: 'Car',
  emoji: '🚗',
  targetAmount: 10000,
  currentAmount: 0,
  monthlyContribution: 500,
  targetDate: null,
  status: 'active',
  note: null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const amounts = (goals: SavingsGoal[], months: number): number[] =>
  buildSavingsContributionAdjustments(goals, '2026-01', months).map((a) => a.expenseAdjustment)

describe('buildSavingsContributionAdjustments', () => {
  it('contributes every month for an active goal', () => {
    const result = buildSavingsContributionAdjustments([goal()], '2026-01', 3)
    expect(result.map((a) => a.monthKey)).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(result.map((a) => a.expenseAdjustment)).toEqual([500, 500, 500])
  })

  it('ignores paused, completed and zero-contribution goals', () => {
    expect(
      amounts(
        [
          goal({ id: 'a', status: 'paused' }),
          goal({ id: 'b', status: 'completed' }),
          goal({ id: 'c', monthlyContribution: 0 }),
        ],
        3,
      ),
    ).toEqual([])
  })

  it('stops after the goal target date', () => {
    const result = buildSavingsContributionAdjustments([goal({ targetDate: '2026-02-15' })], '2026-01', 4)
    expect(result.map((a) => a.monthKey)).toEqual(['2026-01', '2026-02'])
  })

  it('stops once the target is reached and trims the final contribution', () => {
    // 800 already saved of 2000, 500/month → 500, 500, then only 200 is needed
    expect(amounts([goal({ targetAmount: 2000, currentAmount: 800 })], 6)).toEqual([500, 500, 200])
  })

  it('contributes nothing for a goal that is already fully funded', () => {
    expect(amounts([goal({ targetAmount: 1000, currentAmount: 1000 })], 3)).toEqual([])
  })

  it('sums goals per month and lets each finish on its own schedule', () => {
    expect(
      amounts(
        [
          goal({ id: 'short', targetAmount: 1000, monthlyContribution: 500 }),
          goal({ id: 'long', targetAmount: 100000, monthlyContribution: 300 }),
        ],
        4,
      ),
    ).toEqual([800, 800, 300, 300])
  })
})

describe('savingsStartingBalance', () => {
  it('counts what is saved in every goal, whatever its status', () => {
    expect(
      savingsStartingBalance([
        goal({ id: 'a', currentAmount: 1200 }),
        goal({ id: 'b', currentAmount: 300, status: 'paused' }),
        goal({ id: 'c', currentAmount: 5000, status: 'completed' }),
      ]),
    ).toBe(6500)
  })
})

describe('buildGoalBalances', () => {
  it('tracks each goal month by month and stops at the target', () => {
    const result = buildGoalBalances([goal({ currentAmount: 9200 })], '2026-01', 3)
    expect(result.g1).toEqual([9700, 10000, 10000])
  })

  it('keeps a paused goal at what it holds today', () => {
    const result = buildGoalBalances([goal({ status: 'paused', currentAmount: 300 })], '2026-01', 2)
    expect(result.g1).toEqual([300, 300])
  })

  it('stops contributing after the target date', () => {
    const result = buildGoalBalances([goal({ targetDate: '2026-02-15' })], '2026-01', 4)
    expect(result.g1).toEqual([500, 1000, 1000, 1000])
  })

  it('adds up to the same totals as the contribution schedule', () => {
    const goals = [goal({ currentAmount: 9200 }), goal({ id: 'g2', monthlyContribution: 250, targetAmount: 600 })]
    const balances = buildGoalBalances(goals, '2026-01', 4)
    const contributed = buildSavingsContributionAdjustments(goals, '2026-01', 4).reduce((sum, a) => sum + a.expenseAdjustment, 0)
    const growth = goals.reduce((sum, g) => sum + balances[g.id][3] - g.currentAmount, 0)
    expect(growth).toBe(contributed)
  })
})

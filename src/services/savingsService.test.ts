import type { SavingsGoal } from '@/models'
import {
  computeIsOnTrack,
  computeMonthsRemaining,
  computeProgress,
  computeProjectedCompletion,
  computeRemaining,
  computeRequiredMonthly,
  isGoalReached,
  sortGoals,
} from './savingsService'

const makeGoal = (overrides: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 'test-id',
  userId: 'user-id',
  name: 'Test Goal',
  emoji: '🎯',
  targetAmount: 10000,
  currentAmount: 2500,
  monthlyContribution: 200,
  targetDate: null,
  status: 'active',
  note: null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('computeProgress', () => {
  it('returns correct percentage', () => {
    expect(computeProgress(makeGoal({ currentAmount: 2500, targetAmount: 10000 }))).toBe(25)
    expect(computeProgress(makeGoal({ currentAmount: 5000, targetAmount: 10000 }))).toBe(50)
  })

  it('clamps at 100 when over-funded', () => {
    expect(computeProgress(makeGoal({ currentAmount: 12000, targetAmount: 10000 }))).toBe(100)
  })

  it('returns 100 when targetAmount is 0', () => {
    expect(computeProgress(makeGoal({ currentAmount: 0, targetAmount: 0 }))).toBe(100)
  })

  it('returns 0 when nothing saved', () => {
    expect(computeProgress(makeGoal({ currentAmount: 0, targetAmount: 10000 }))).toBe(0)
  })
})

describe('computeRemaining', () => {
  it('returns correct remaining amount', () => {
    expect(computeRemaining(makeGoal({ currentAmount: 2500, targetAmount: 10000 }))).toBe(7500)
  })

  it('returns 0 when goal is reached', () => {
    expect(computeRemaining(makeGoal({ currentAmount: 10000, targetAmount: 10000 }))).toBe(0)
  })

  it('never returns negative', () => {
    expect(computeRemaining(makeGoal({ currentAmount: 11000, targetAmount: 10000 }))).toBe(0)
  })
})

describe('computeMonthsRemaining', () => {
  it('returns null when no targetDate', () => {
    expect(computeMonthsRemaining(makeGoal({ targetDate: null }))).toBeNull()
  })

  it('returns 0 when deadline has already passed', () => {
    expect(computeMonthsRemaining(makeGoal({ targetDate: '2020-01-01' }))).toBe(0)
  })

  it('returns correct months ahead', () => {
    const now = new Date('2026-01-01')
    const result = computeMonthsRemaining(makeGoal({ targetDate: '2026-07-01' }), now)
    expect(result).toBe(6)
  })
})

describe('computeRequiredMonthly', () => {
  it('returns null when goal already reached', () => {
    expect(computeRequiredMonthly(makeGoal({ currentAmount: 10000, targetAmount: 10000 }))).toBeNull()
  })

  it('returns null when no targetDate', () => {
    expect(computeRequiredMonthly(makeGoal({ targetDate: null }))).toBeNull()
  })

  it('returns ceiled monthly amount', () => {
    const now = new Date('2026-01-01')
    // 7500 remaining over 10 months = 750
    const goal = makeGoal({ currentAmount: 2500, targetAmount: 10000, targetDate: '2026-11-01' })
    expect(computeRequiredMonthly(goal, now)).toBe(750)
  })
})

describe('isGoalReached', () => {
  it('returns true when currentAmount >= targetAmount (and target > 0)', () => {
    expect(isGoalReached(makeGoal({ currentAmount: 10000, targetAmount: 10000 }))).toBe(true)
    expect(isGoalReached(makeGoal({ currentAmount: 10001, targetAmount: 10000 }))).toBe(true)
  })

  it('returns false when not yet reached', () => {
    expect(isGoalReached(makeGoal({ currentAmount: 9999, targetAmount: 10000 }))).toBe(false)
  })

  it('returns false when targetAmount is 0', () => {
    expect(isGoalReached(makeGoal({ currentAmount: 0, targetAmount: 0 }))).toBe(false)
  })
})

describe('computeProjectedCompletion', () => {
  it('returns null when goal is already reached', () => {
    expect(
      computeProjectedCompletion(makeGoal({ currentAmount: 10000, targetAmount: 10000 })),
    ).toBeNull()
  })

  it('returns null when monthlyContribution is 0', () => {
    expect(
      computeProjectedCompletion(makeGoal({ monthlyContribution: 0 })),
    ).toBeNull()
  })

  it('returns correct completion month', () => {
    // 7500 remaining at 500/mo = 15 months from Jan 2026 → Apr 2027
    const now = new Date('2026-01-01')
    const goal = makeGoal({ currentAmount: 2500, targetAmount: 10000, monthlyContribution: 500 })
    expect(computeProjectedCompletion(goal, now)).toBe('2027-04')
  })

  it('handles month overflow across year boundary', () => {
    // 1000 remaining at 100/mo = 10 months from Sep 2026 → Jul 2027
    const now = new Date('2026-09-01')
    const goal = makeGoal({ currentAmount: 9000, targetAmount: 10000, monthlyContribution: 100 })
    expect(computeProjectedCompletion(goal, now)).toBe('2027-07')
  })
})

describe('computeIsOnTrack', () => {
  it('returns null when no targetDate', () => {
    expect(computeIsOnTrack(makeGoal({ targetDate: null }))).toBeNull()
  })

  it('returns true when goal is already reached', () => {
    expect(
      computeIsOnTrack(makeGoal({ currentAmount: 10000, targetAmount: 10000, targetDate: '2027-01-01' })),
    ).toBe(true)
  })

  it('returns true when contribution meets required', () => {
    const now = new Date('2026-01-01')
    // 7500 remaining over 10 months = 750 required; contribution 750 → on track
    const goal = makeGoal({
      currentAmount: 2500,
      targetAmount: 10000,
      targetDate: '2026-11-01',
      monthlyContribution: 750,
    })
    expect(computeIsOnTrack(goal, now)).toBe(true)
  })

  it('returns false when contribution is below required', () => {
    const now = new Date('2026-01-01')
    // 7500 remaining over 10 months = 750 required; contribution 200 → off track
    const goal = makeGoal({
      currentAmount: 2500,
      targetAmount: 10000,
      targetDate: '2026-11-01',
      monthlyContribution: 200,
    })
    expect(computeIsOnTrack(goal, now)).toBe(false)
  })
})

describe('sortGoals', () => {
  it('sorts active → paused → completed', () => {
    const goals = [
      makeGoal({ id: 'c', status: 'completed', sortOrder: 0 }),
      makeGoal({ id: 'p', status: 'paused', sortOrder: 0 }),
      makeGoal({ id: 'a', status: 'active', sortOrder: 0 }),
    ]
    expect(sortGoals(goals).map((g) => g.id)).toEqual(['a', 'p', 'c'])
  })

  it('sorts by sortOrder within same status', () => {
    const goals = [
      makeGoal({ id: 'a2', status: 'active', sortOrder: 1 }),
      makeGoal({ id: 'a1', status: 'active', sortOrder: 0 }),
    ]
    expect(sortGoals(goals).map((g) => g.id)).toEqual(['a1', 'a2'])
  })

  it('does not mutate the original array', () => {
    const goals = [
      makeGoal({ id: 'c', status: 'completed', sortOrder: 0 }),
      makeGoal({ id: 'a', status: 'active', sortOrder: 0 }),
    ]
    const copy = [...goals]
    sortGoals(goals)
    expect(goals).toEqual(copy)
  })
})

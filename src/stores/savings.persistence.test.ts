// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

import * as db from '@/services/database'

import { useSavingsStore } from './savings'

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ user: ref({ id: 'owner-1' }) }),
}))

vi.mock('@/services/database', () => ({
  fetchSavingsGoals: vi.fn(),
  fetchDepositsForGoals: vi.fn(),
  fetchDepositsForGoal: vi.fn(),
  changeSavingsGoalCurrency: vi.fn(),
  insertSavingsGoal: vi.fn(),
  updateSavingsGoal: vi.fn(),
  deleteSavingsGoal: vi.fn(),
  insertSavingsDeposit: vi.fn(),
  deleteSavingsDeposit: vi.fn(),
}))

const goalRow = (id: string) => ({
  id,
  userId: 'owner-1',
  name: id,
  emoji: '🎯',
  targetAmount: 1000,
  currentAmount: 0,
  monthlyContribution: 100,
  targetDate: null,
  status: 'active' as const,
  note: null,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('useSavingsStore persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.mocked(db.fetchSavingsGoals).mockResolvedValue([goalRow('g1'), goalRow('g2')])
    vi.mocked(db.fetchDepositsForGoals).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads deposits by goal so deposits made by collaborators are included', async () => {
    vi.mocked(db.fetchDepositsForGoals).mockResolvedValue([
      {
        id: 'd1', goalId: 'g1', userId: 'editor-9', amount: 250,
        note: null, depositDate: '2026-03-01', createdAt: '2026-03-01T00:00:00.000Z',
      },
    ])
    const store = useSavingsStore()
    await store.hydrate()

    expect(db.fetchDepositsForGoals).toHaveBeenCalledWith(['g1', 'g2'])
    expect(store.deposits['g1']?.[0]?.userId).toBe('editor-9')
  })

  it('persists edits to two different goals made within the debounce window', async () => {
    const store = useSavingsStore()
    await store.hydrate()

    store.updateGoal('g1', { monthlyContribution: 150 })
    store.updateGoal('g2', { monthlyContribution: 300 })
    vi.advanceTimersByTime(700)

    expect(db.updateSavingsGoal).toHaveBeenCalledTimes(2)
    expect(db.updateSavingsGoal).toHaveBeenCalledWith('g1', { monthly_contribution: 150 })
    expect(db.updateSavingsGoal).toHaveBeenCalledWith('g2', { monthly_contribution: 300 })
  })

  it('merges rapid edits to different fields of one goal into a single write', async () => {
    const store = useSavingsStore()
    await store.hydrate()

    store.updateGoal('g1', { name: 'Car' })
    store.updateGoal('g1', { monthlyContribution: 400 })
    vi.advanceTimersByTime(700)

    expect(db.updateSavingsGoal).toHaveBeenCalledTimes(1)
    expect(db.updateSavingsGoal).toHaveBeenCalledWith('g1', { name: 'Car', monthly_contribution: 400 })
  })

  it('drops a pending write when the goal is deleted', async () => {
    const store = useSavingsStore()
    await store.hydrate()

    store.updateGoal('g1', { name: 'Car' })
    store.deleteGoal('g1')
    vi.advanceTimersByTime(700)

    expect(db.updateSavingsGoal).not.toHaveBeenCalled()
    expect(db.deleteSavingsGoal).toHaveBeenCalledWith('g1')
  })

  it('converts a goal and its deposits when its currency is changed', async () => {
    vi.mocked(db.fetchDepositsForGoals).mockResolvedValue([
      {
        id: 'd1', goalId: 'g1', userId: 'owner-1', amount: 250,
        note: null, depositDate: '2026-03-01', createdAt: '2026-03-01T00:00:00.000Z',
      },
    ])
    vi.mocked(db.changeSavingsGoalCurrency).mockResolvedValue(true)
    const store = useSavingsStore()
    await store.hydrate()

    // 1 EUR = 10 SEK
    await store.changeGoalCurrency('g1', 'SEK', 10)

    const goal = store.goals.find((g) => g.id === 'g1')
    expect(goal).toMatchObject({ currency: 'SEK', targetAmount: 10000, monthlyContribution: 1000 })
    expect(store.deposits['g1']?.[0]?.amount).toBe(2500)
    expect(db.changeSavingsGoalCurrency).toHaveBeenCalledWith('g1', 'SEK', 10)
    // Other goals are untouched
    expect(store.goals.find((g) => g.id === 'g2')?.targetAmount).toBe(1000)
  })

  it('reloads the goal when the server rejects a currency change', async () => {
    vi.mocked(db.changeSavingsGoalCurrency).mockResolvedValue(false)
    const store = useSavingsStore()
    await store.hydrate()

    await store.changeGoalCurrency('g1', 'SEK', 10)

    expect(db.fetchSavingsGoals).toHaveBeenCalledTimes(2)
    expect(store.goals.find((g) => g.id === 'g1')?.targetAmount).toBe(1000)
  })
})

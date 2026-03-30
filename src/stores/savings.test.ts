// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'

import { useSavingsStore } from './savings'

describe('useSavingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty state', () => {
    const store = useSavingsStore()
    expect(store.goals).toEqual([])
    expect(store.deposits).toEqual({})
    expect(store.isReady).toBe(false)
    expect(store.sortedGoals).toEqual([])
    expect(store.totalMonthlyContributions).toBe(0)
  })

  it('resetStore clears all state', () => {
    const store = useSavingsStore()
    store.applyRemoteGoalUpsert({
      id: 'g1',
      user_id: 'u1',
      name: 'Test',
      emoji: '🎯',
      target_amount: 1000,
      current_amount: 0,
      monthly_contribution: 100,
      target_date: null,
      status: 'active',
      note: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    store.resetStore()
    expect(store.goals).toEqual([])
    expect(store.isReady).toBe(false)
  })

  it('applyRemoteGoalUpsert inserts a new goal', () => {
    const store = useSavingsStore()
    store.applyRemoteGoalUpsert({
      id: 'g1',
      user_id: 'u1',
      name: 'Wedding',
      emoji: '💍',
      target_amount: 20000,
      current_amount: 5000,
      monthly_contribution: 500,
      target_date: '2027-06-01',
      status: 'active',
      note: null,
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    })
    expect(store.goals).toHaveLength(1)
    expect(store.goals[0]?.name).toBe('Wedding')
    expect(store.goals[0]?.targetAmount).toBe(20000)
    expect(store.goals[0]?.currentAmount).toBe(5000)
  })

  it('applyRemoteGoalUpsert updates an existing goal', () => {
    const store = useSavingsStore()
    store.applyRemoteGoalUpsert({
      id: 'g1', user_id: 'u1', name: 'Old Name', emoji: '🎯',
      target_amount: 1000, current_amount: 0, monthly_contribution: 0,
      target_date: null, status: 'active', note: null, sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    })
    store.applyRemoteGoalUpsert({
      id: 'g1', user_id: 'u1', name: 'New Name', emoji: '🎯',
      target_amount: 1000, current_amount: 250, monthly_contribution: 0,
      target_date: null, status: 'active', note: null, sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z',
    })
    expect(store.goals).toHaveLength(1)
    expect(store.goals[0]?.name).toBe('New Name')
    expect(store.goals[0]?.currentAmount).toBe(250)
  })

  it('applyRemoteGoalDelete removes a goal', () => {
    const store = useSavingsStore()
    store.applyRemoteGoalUpsert({
      id: 'g1', user_id: 'u1', name: 'To delete', emoji: '🎯',
      target_amount: 500, current_amount: 0, monthly_contribution: 0,
      target_date: null, status: 'active', note: null, sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    })
    store.applyRemoteGoalDelete('g1')
    expect(store.goals).toHaveLength(0)
  })

  it('totalMonthlyContributions sums only active goals', () => {
    const store = useSavingsStore()
    store.applyRemoteGoalUpsert({
      id: 'g1', user_id: 'u1', name: 'Active', emoji: '🎯',
      target_amount: 1000, current_amount: 0, monthly_contribution: 200,
      target_date: null, status: 'active', note: null, sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    })
    store.applyRemoteGoalUpsert({
      id: 'g2', user_id: 'u1', name: 'Paused', emoji: '🎯',
      target_amount: 1000, current_amount: 0, monthly_contribution: 300,
      target_date: null, status: 'paused', note: null, sort_order: 1,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    })
    store.applyRemoteGoalUpsert({
      id: 'g3', user_id: 'u1', name: 'Completed', emoji: '🎯',
      target_amount: 500, current_amount: 500, monthly_contribution: 100,
      target_date: null, status: 'completed', note: null, sort_order: 2,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    })
    // Only the active goal (200) counts
    expect(store.totalMonthlyContributions).toBe(200)
  })

  it('sortedGoals returns active → paused → completed', () => {
    const store = useSavingsStore()
    store.applyRemoteGoalUpsert({
      id: 'c', user_id: 'u1', name: 'C', emoji: '🎯',
      target_amount: 500, current_amount: 500, monthly_contribution: 0,
      target_date: null, status: 'completed', note: null, sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    })
    store.applyRemoteGoalUpsert({
      id: 'p', user_id: 'u1', name: 'P', emoji: '🎯',
      target_amount: 1000, current_amount: 0, monthly_contribution: 0,
      target_date: null, status: 'paused', note: null, sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    })
    store.applyRemoteGoalUpsert({
      id: 'a', user_id: 'u1', name: 'A', emoji: '🎯',
      target_amount: 2000, current_amount: 100, monthly_contribution: 200,
      target_date: null, status: 'active', note: null, sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    })
    expect(store.sortedGoals.map((g) => g.id)).toEqual(['a', 'p', 'c'])
  })

  it('applyRemoteDepositInsert adds deposit to the correct goal', () => {
    const store = useSavingsStore()
    store.applyRemoteDepositInsert({
      id: 'd1',
      goal_id: 'g1',
      user_id: 'u1',
      amount: 500,
      note: 'First deposit',
      deposit_date: '2026-03-01',
      created_at: '2026-03-01T10:00:00.000Z',
    })
    expect(store.deposits['g1']).toHaveLength(1)
    expect(store.deposits['g1']?.[0]?.amount).toBe(500)
  })

  it('applyRemoteDepositInsert ignores duplicate deposit ids', () => {
    const store = useSavingsStore()
    const row = {
      id: 'd1', goal_id: 'g1', user_id: 'u1', amount: 500,
      note: null, deposit_date: '2026-03-01', created_at: '2026-03-01T10:00:00.000Z',
    }
    store.applyRemoteDepositInsert(row)
    store.applyRemoteDepositInsert(row)
    expect(store.deposits['g1']).toHaveLength(1)
  })

  it('applyRemoteDepositDelete removes a deposit', () => {
    const store = useSavingsStore()
    store.applyRemoteDepositInsert({
      id: 'd1', goal_id: 'g1', user_id: 'u1', amount: 300,
      note: null, deposit_date: '2026-03-01', created_at: '2026-03-01T10:00:00.000Z',
    })
    store.applyRemoteDepositDelete('d1', 'g1')
    expect(store.deposits['g1']).toHaveLength(0)
  })
})

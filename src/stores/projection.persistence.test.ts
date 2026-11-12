// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

import * as db from '@/services/database'

import { useProjectionStore } from './projection'

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ user: ref({ id: 'owner-1' }) }),
}))

vi.mock('@/services/database', () => ({
  deleteAllScenarios: vi.fn(),
  deleteScenario: vi.fn(),
  fetchProjectionInputs: vi.fn(),
  fetchScenarios: vi.fn(),
  insertScenario: vi.fn(),
  saveProjectionInputs: vi.fn(),
  setActiveScenario: vi.fn(),
  syncExpenseItems: vi.fn(),
  updateScenario: vi.fn(),
}))

describe('projection store persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('persists the expense items of a loaded scenario', () => {
    const store = useProjectionStore()
    store.setExpenseItems([{ id: 'rent', name: 'Rent', amount: 1200, sortOrder: 0 }])
    const scenario = store.saveScenario('With rent')

    store.setExpenseItems([])
    vi.mocked(db.syncExpenseItems).mockClear()
    store.loadScenario(scenario.id)

    expect(store.inputs.expenseItems).toHaveLength(1)
    expect(db.syncExpenseItems).toHaveBeenCalledTimes(1)
    const [userId, items] = vi.mocked(db.syncExpenseItems).mock.calls[0]!
    expect(userId).toBe('owner-1')
    expect(items).toEqual([expect.objectContaining({ name: 'Rent', amount: 1200 })])
    // Fresh id, so re-inserting can never collide with an existing row
    expect(items[0]?.id).not.toBe('rent')
  })

  it('applies remote income items and keeps fields the remote payload omits', () => {
    const store = useProjectionStore()
    store.setExpenseItems([{ id: 'rent', name: 'Rent', amount: 1200, sortOrder: 0 }])

    store.applyRemoteFullInputs({
      monthlyIncome: 5000,
      monthlyExpenses: 1200,
      months: 24,
      incomeItems: [{ id: 'salary', name: 'Salary', amount: 5000 }],
    })

    expect(store.inputs.months).toBe(24)
    expect(store.inputs.incomeItems).toEqual([{ id: 'salary', name: 'Salary', amount: 5000 }])
    expect(store.inputs.expenseItems).toHaveLength(1)
  })

  it('resets the plan but keeps saved scenarios and the base currency', async () => {
    const store = useProjectionStore()
    store.setInputs({ monthlyIncome: 5000, monthlyExpenses: 3000, months: 24, startingBalance: 1500, currency: 'SEK' })
    store.setIncomeItems([{ id: 'salary', name: 'Salary', amount: 5000 }])
    store.setExpenseItems([{ id: 'rent', name: 'Rent', amount: 1200, sortOrder: 0 }])
    store.setMonthlyAdjustments([{ id: 'a', monthKey: '2026-06', incomeAdjustment: 0, expenseAdjustment: 800 }])
    store.saveScenario('Keep me')
    vi.clearAllMocks()

    await store.resetInputs()

    expect(store.inputs).toMatchObject({
      monthlyIncome: 0,
      monthlyExpenses: 0,
      months: 12,
      startingBalance: 0,
      incomeItems: [],
      expenseItems: [],
      monthlyAdjustments: [],
      currency: 'SEK',
    })
    expect(store.savedScenarios).toHaveLength(1)
    expect(store.activeScenarioId).toBeNull()

    expect(db.syncExpenseItems).toHaveBeenCalledWith('owner-1', [])
    expect(db.setActiveScenario).toHaveBeenCalledWith('owner-1', null)
    expect(db.deleteAllScenarios).not.toHaveBeenCalled()
    expect(db.saveProjectionInputs).toHaveBeenCalledWith('owner-1', expect.objectContaining({ monthlyIncome: 0, months: 12 }))
  })
})

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
})

import { computed, nextTick, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { useAuth } from '@/composables/useAuth'
import { defaultProjectionInputs } from '@/data/defaults'
import type { ExpenseItem, IncomeItem, MonthAdjustment, ProjectionInputs, ProjectionScenario, ProjectionStateSnapshot } from '@/models'
import {
  deleteAllScenarios,
  deleteScenario as dbDeleteScenario,
  fetchProjectionInputs,
  fetchScenarios,
  insertScenario,
  saveProjectionInputs,
  setActiveScenario,
  syncExpenseItems,
  updateScenario,
} from '@/services/database'
import { mapScenarioRow } from '@/services/mappers'

interface ProjectionScenarioExportPayload {
  version: 1
  exportedAt: string
  scenarios: ProjectionScenario[]
}

const sameProjectionInputs = (left: ProjectionInputs, right: ProjectionInputs): boolean =>
  left.monthlyIncome === right.monthlyIncome
  && left.monthlyExpenses === right.monthlyExpenses
  && left.months === right.months

const buildImportedScenarioName = (
  scenarios: ProjectionScenario[],
  preferredName: string,
  inputs: ProjectionInputs,
): string | null => {
  const matchingName = scenarios.find(
    (s) => s.name.trim().toLowerCase() === preferredName.trim().toLowerCase(),
  )
  if (!matchingName) return preferredName
  if (sameProjectionInputs(matchingName.inputs, inputs)) return null

  let suffix = 1
  let candidate = `${preferredName} (Imported)`
  while (scenarios.some((s) => s.name.trim().toLowerCase() === candidate.trim().toLowerCase())) {
    suffix += 1
    candidate = `${preferredName} (Imported ${suffix})`
  }
  return candidate
}

let inputsSaveTimer: ReturnType<typeof setTimeout> | undefined
let expenseItemsSaveTimer: ReturnType<typeof setTimeout> | undefined
let adjustmentsSaveTimer: ReturnType<typeof setTimeout> | undefined

const defaultSnapshot = (): ProjectionStateSnapshot => ({
  inputs: { ...defaultProjectionInputs },
  savedScenarios: [],
  activeScenarioId: null,
})

export const useProjectionStore = defineStore('projection', () => {
  const snapshot = ref<ProjectionStateSnapshot>(defaultSnapshot())
  const isReady = ref(false)
  // Overrides own user ID when viewing a shared budget (set by collaboration store)
  const targetUserId = ref<string | null>(null)
  // Prevents the save watcher from re-persisting changes that arrived via Realtime
  const isReceivingRemoteUpdate = ref(false)

  const getUserId = (): string | null => {
    const { user } = useAuth()
    return user.value?.id ?? null
  }

  const getEffectiveUserId = (): string | null => targetUserId.value ?? getUserId()

  const debouncedSaveInputs = (): void => {
    clearTimeout(inputsSaveTimer)
    inputsSaveTimer = setTimeout(() => {
      const userId = getEffectiveUserId()
      if (userId) void saveProjectionInputs(userId, snapshot.value.inputs)
    }, 500)
  }

  watch(() => snapshot.value.inputs, () => {
    if (isReady.value && !isReceivingRemoteUpdate.value) debouncedSaveInputs()
  }, { deep: true })

  const hydrate = async (overrideUserId?: string): Promise<void> => {
    const userId = overrideUserId ?? getUserId()
    if (!userId) return

    targetUserId.value = overrideUserId ?? null

    const [inputs, scenarioData] = await Promise.all([
      fetchProjectionInputs(userId),
      fetchScenarios(userId),
    ])

    snapshot.value = {
      inputs: inputs ?? { ...defaultProjectionInputs },
      savedScenarios: scenarioData.scenarios,
      activeScenarioId: scenarioData.activeScenarioId,
    }
    isReady.value = true
  }

  const resetStore = (): void => {
    clearTimeout(inputsSaveTimer)
    clearTimeout(expenseItemsSaveTimer)
    clearTimeout(adjustmentsSaveTimer)
    isReady.value = false
    targetUserId.value = null
    snapshot.value = defaultSnapshot()
  }

  const buildScenarioName = (): string => `Scenario ${snapshot.value.savedScenarios.length + 1}`

  const setInputs = (nextInputs: Partial<ProjectionInputs>): void => {
    snapshot.value = { ...snapshot.value, inputs: { ...snapshot.value.inputs, ...nextInputs } }
  }

  const setIncomeItems = (items: IncomeItem[]): void => {
    snapshot.value = {
      ...snapshot.value,
      inputs: { ...snapshot.value.inputs, incomeItems: items },
    }
    // The watch on snapshot.value.inputs triggers debouncedSaveInputs automatically
  }

  const setExpenseItems = (items: ExpenseItem[]): void => {
    snapshot.value = {
      ...snapshot.value,
      inputs: { ...snapshot.value.inputs, expenseItems: items },
    }

    clearTimeout(expenseItemsSaveTimer)
    expenseItemsSaveTimer = setTimeout(() => {
      const userId = getEffectiveUserId()
      if (userId && isReady.value) void syncExpenseItems(userId, snapshot.value.inputs.expenseItems)
    }, 500)
  }

  const setMonthlyAdjustments = (adjustments: MonthAdjustment[]): void => {
    snapshot.value = {
      ...snapshot.value,
      inputs: { ...snapshot.value.inputs, monthlyAdjustments: adjustments },
    }

    clearTimeout(adjustmentsSaveTimer)
    adjustmentsSaveTimer = setTimeout(() => {
      const userId = getEffectiveUserId()
      if (userId && isReady.value) void saveProjectionInputs(userId, snapshot.value.inputs)
    }, 500)
  }

  const reset = async (): Promise<void> => {
    clearTimeout(inputsSaveTimer)
    clearTimeout(expenseItemsSaveTimer)
    clearTimeout(adjustmentsSaveTimer)
    const userId = getEffectiveUserId()
    const zeroInputs: ProjectionInputs = { ...defaultProjectionInputs, expenseItems: [], monthlyAdjustments: [] }
    snapshot.value = {
      ...snapshot.value,
      inputs: zeroInputs,
      savedScenarios: [],
      activeScenarioId: null,
    }
    if (userId) {
      await Promise.all([
        saveProjectionInputs(userId, zeroInputs),
        syncExpenseItems(userId, []),
        deleteAllScenarios(userId),
      ])
    }
  }

  // Clears the plan itself — starting balance, income, expenses, their items,
  // one-time adjustments and the projection length — back to a blank budget.
  // Saved scenarios and the budget's base currency are kept; no scenario is
  // "active" afterwards because the inputs no longer match any of them.
  const resetInputs = async (): Promise<void> => {
    clearTimeout(inputsSaveTimer)
    clearTimeout(expenseItemsSaveTimer)
    clearTimeout(adjustmentsSaveTimer)
    const userId = getEffectiveUserId()
    const blank: ProjectionInputs = {
      ...defaultProjectionInputs,
      incomeItems: [],
      expenseItems: [],
      monthlyAdjustments: [],
      startingBalance: 0,
      startingBalanceCurrency: undefined,
      currency: snapshot.value.inputs.currency,
    }
    snapshot.value = { ...snapshot.value, inputs: blank, activeScenarioId: null }
    if (userId) {
      await Promise.all([
        saveProjectionInputs(userId, blank),
        syncExpenseItems(userId, []),
        setActiveScenario(userId, null),
      ])
    }
  }

  const saveScenario = (name?: string): ProjectionScenario => {
    const scenario: ProjectionScenario = {
      id: crypto.randomUUID(),
      name: name?.trim() || buildScenarioName(),
      inputs: { ...snapshot.value.inputs },
      updatedAt: new Date().toISOString(),
    }

    snapshot.value = {
      ...snapshot.value,
      savedScenarios: [scenario, ...snapshot.value.savedScenarios],
      activeScenarioId: scenario.id,
    }

    const userId = getEffectiveUserId()
    if (userId) void insertScenario(userId, scenario, true)

    return scenario
  }

  const loadScenario = (scenarioId: string): void => {
    const scenario = snapshot.value.savedScenarios.find((e) => e.id === scenarioId)
    if (!scenario) return

    // Expense items live in their own table, which the inputs save-watcher does not
    // write — persist them explicitly or the previous list returns after a reload.
    // Fresh ids: the scenario may be an import whose item ids belong to other rows.
    const expenseItems = (scenario.inputs.expenseItems ?? []).map((item) => ({
      ...item,
      id: crypto.randomUUID(),
    }))

    // The starting balance is a fact about today, not part of a plan: keep it.
    const { startingBalance, startingBalanceCurrency } = snapshot.value.inputs

    snapshot.value = {
      ...snapshot.value,
      inputs: { ...scenario.inputs, expenseItems, startingBalance, startingBalanceCurrency },
      activeScenarioId: scenario.id,
    }

    clearTimeout(expenseItemsSaveTimer)
    const userId = getEffectiveUserId()
    if (userId) {
      void setActiveScenario(userId, scenario.id)
      void syncExpenseItems(userId, expenseItems)
    }
  }

  const renameScenario = (scenarioId: string, nextName: string): boolean => {
    const trimmedName = nextName.trim()
    if (!trimmedName) return false

    let renamed = false
    snapshot.value = {
      ...snapshot.value,
      savedScenarios: snapshot.value.savedScenarios.map((s) => {
        if (s.id !== scenarioId) return s
        renamed = true
        return { ...s, name: trimmedName, updatedAt: new Date().toISOString() }
      }),
    }

    if (renamed) void updateScenario(scenarioId, { name: trimmedName })
    return renamed
  }

  const overwriteActiveScenario = (nextName?: string): boolean => {
    const activeId = snapshot.value.activeScenarioId
    if (!activeId) return false

    const trimmedName = nextName?.trim()
    let overwritten = false
    snapshot.value = {
      ...snapshot.value,
      savedScenarios: snapshot.value.savedScenarios.map((s) => {
        if (s.id !== activeId) return s
        overwritten = true
        return {
          ...s,
          name: trimmedName || s.name,
          inputs: { ...snapshot.value.inputs },
          updatedAt: new Date().toISOString(),
        }
      }),
    }

    if (overwritten) {
      void updateScenario(activeId, {
        name: trimmedName || undefined,
        monthly_income: snapshot.value.inputs.monthlyIncome,
        monthly_expenses: snapshot.value.inputs.monthlyExpenses,
        months: snapshot.value.inputs.months,
        income_items: snapshot.value.inputs.incomeItems ?? [],
        expense_items: snapshot.value.inputs.expenseItems ?? [],
        monthly_adjustments: snapshot.value.inputs.monthlyAdjustments ?? [],
        currency: snapshot.value.inputs.currency ?? null,
      })
    }
    return overwritten
  }

  const deleteScenario = (scenarioId: string): void => {
    snapshot.value = {
      ...snapshot.value,
      savedScenarios: snapshot.value.savedScenarios.filter((e) => e.id !== scenarioId),
      activeScenarioId: snapshot.value.activeScenarioId === scenarioId ? null : snapshot.value.activeScenarioId,
    }
    void dbDeleteScenario(scenarioId)
  }

  const exportScenarios = (): string =>
    JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        scenarios: snapshot.value.savedScenarios,
      } satisfies ProjectionScenarioExportPayload,
      null,
      2,
    )

  const importScenarios = (payload: string): number => {
    const parsed = JSON.parse(payload) as Partial<ProjectionScenarioExportPayload>
    if (!Array.isArray(parsed.scenarios)) throw new Error('Invalid scenario file format.')

    const seenIds = new Set(snapshot.value.savedScenarios.map((s) => s.id))
    const incoming = parsed.scenarios.filter((s): s is ProjectionScenario => {
      if (!s || typeof s !== 'object' || typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.updatedAt !== 'string') return false
      const i = s.inputs
      return !!i && typeof i.monthlyIncome === 'number' && typeof i.monthlyExpenses === 'number' && typeof i.months === 'number'
    })

    const unique = incoming.filter((s) => {
      if (seenIds.has(s.id)) return false
      seenIds.add(s.id)
      return true
    })

    if (!unique.length) return 0

    const imported: ProjectionScenario[] = []
    const forNameChecks = [...snapshot.value.savedScenarios]

    unique.forEach((s) => {
      if (!Array.isArray(s.inputs.monthlyAdjustments)) s.inputs.monthlyAdjustments = []
      const name = buildImportedScenarioName(forNameChecks, s.name, s.inputs)
      if (!name) return
      const normalized = { ...s, name }
      imported.push(normalized)
      forNameChecks.unshift(normalized)
    })

    if (!imported.length) return 0

    snapshot.value = {
      ...snapshot.value,
      savedScenarios: [...imported, ...snapshot.value.savedScenarios],
    }

    const userId = getEffectiveUserId()
    if (userId) {
      imported.forEach((s) => void insertScenario(userId, s, false))
    }

    return imported.length
  }

  // ─── Remote update helpers (called by Realtime subscription) ─────────────────
  // These bypass the save watcher so received changes are not echoed back to DB.

  const withRemoteFlag = (fn: () => void): void => {
    isReceivingRemoteUpdate.value = true
    fn()
    // nextTick ensures the watcher (pre-flush) runs while the flag is still true,
    // then the flag is reset after the flush queue clears.
    void nextTick(() => { isReceivingRemoteUpdate.value = false })
  }

  // Applies a full inputs update (income/expense items and monthly adjustments) in a
  // single remote flag cycle. Used by the broadcast listener to avoid separate
  // withRemoteFlag calls that could briefly clear the flag between two reactive updates.
  // Fields left out of `remote` keep their current local value.
  const applyRemoteFullInputs = (remote: Partial<ProjectionInputs>): void => {
    withRemoteFlag(() => {
      const current = snapshot.value.inputs
      snapshot.value = {
        ...snapshot.value,
        inputs: {
          monthlyIncome: remote.monthlyIncome ?? current.monthlyIncome,
          monthlyExpenses: remote.monthlyExpenses ?? current.monthlyExpenses,
          months: remote.months ?? current.months,
          currency: remote.currency ?? current.currency,
          startingBalance: remote.startingBalance ?? current.startingBalance,
          startingBalanceCurrency: remote.startingBalanceCurrency ?? current.startingBalanceCurrency,
          incomeItems: remote.incomeItems ?? current.incomeItems,
          expenseItems: remote.expenseItems ?? current.expenseItems,
          monthlyAdjustments: remote.monthlyAdjustments ?? current.monthlyAdjustments,
        },
      }
    })
  }

  // Gives a budget that has no base currency yet (created before multi-currency, or
  // brand new) the currency its numbers are being shown in. In-memory only: it is
  // persisted with the next real edit, so a view-only collaborator never writes.
  const ensureCurrency = (currency: string): void => {
    if (snapshot.value.inputs.currency) return
    withRemoteFlag(() => {
      snapshot.value = { ...snapshot.value, inputs: { ...snapshot.value.inputs, currency } }
    })
  }

  const applyRemoteScenarioUpsert = (row: Record<string, unknown>): void => {
    const scenario = mapScenarioRow(row)

    withRemoteFlag(() => {
      const exists = snapshot.value.savedScenarios.some((s) => s.id === scenario.id)
      snapshot.value = {
        ...snapshot.value,
        savedScenarios: exists
          ? snapshot.value.savedScenarios.map((s) => (s.id === scenario.id ? scenario : s))
          : [scenario, ...snapshot.value.savedScenarios],
        activeScenarioId: row.is_active
          ? scenario.id
          : snapshot.value.activeScenarioId === scenario.id
            ? null
            : snapshot.value.activeScenarioId,
      }
    })
  }

  const applyRemoteScenarioDelete = (scenarioId: string): void => {
    withRemoteFlag(() => {
      snapshot.value = {
        ...snapshot.value,
        savedScenarios: snapshot.value.savedScenarios.filter((s) => s.id !== scenarioId),
        activeScenarioId: snapshot.value.activeScenarioId === scenarioId ? null : snapshot.value.activeScenarioId,
      }
    })
  }

  const applyRemoteExpenseItems = (items: ExpenseItem[]): void => {
    withRemoteFlag(() => {
      snapshot.value = {
        ...snapshot.value,
        inputs: { ...snapshot.value.inputs, expenseItems: items },
      }
    })
  }

  return {
    inputs: computed(() => snapshot.value.inputs),
    savedScenarios: computed(() => snapshot.value.savedScenarios),
    activeScenarioId: computed(() => snapshot.value.activeScenarioId),
    isReady,
    isReceivingRemoteUpdate,
    hydrate,
    resetStore,
    setInputs,
    setIncomeItems,
    setExpenseItems,
    setMonthlyAdjustments,
    reset,
    resetInputs,
    saveScenario,
    loadScenario,
    renameScenario,
    overwriteActiveScenario,
    deleteScenario,
    exportScenarios,
    importScenarios,
    applyRemoteFullInputs,
    ensureCurrency,
    applyRemoteScenarioUpsert,
    applyRemoteScenarioDelete,
    applyRemoteExpenseItems,
  }
})

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { useAuth } from '@/composables/useAuth'
import type { SavingsDeposit, SavingsGoal } from '@/models'
import {
  changeSavingsGoalCurrency,
  deleteSavingsDeposit,
  deleteSavingsGoal,
  fetchDepositsForGoal,
  fetchDepositsForGoals,
  fetchSavingsGoals,
  insertSavingsDeposit,
  insertSavingsGoal,
  updateSavingsGoal,
} from '@/services/database'
import { mapSavingsDepositRow, mapSavingsGoalRow } from '@/services/mappers'
import { sortGoals } from '@/services/savingsService'

type GoalDbUpdates = Parameters<typeof updateSavingsGoal>[1]

// One debounce slot per goal. Updates made while a write is pending are merged
// into it, so editing two goals (or two fields) in quick succession loses nothing.
const pendingGoalWrites = new Map<string, { timer: ReturnType<typeof setTimeout>; updates: GoalDbUpdates }>()

const clearPendingGoalWrites = (): void => {
  pendingGoalWrites.forEach(({ timer }) => clearTimeout(timer))
  pendingGoalWrites.clear()
}

const getUserId = (): string | null => {
  const { user } = useAuth()
  return user.value?.id ?? null
}

export const useSavingsStore = defineStore('savings', () => {
  const goals = ref<SavingsGoal[]>([])
  const deposits = ref<Record<string, SavingsDeposit[]>>({})
  const isReady = ref(false)

  // ─── Computed ─────────────────────────────────────────────────────────────────

  const sortedGoals = computed(() => sortGoals(goals.value))

  const totalMonthlyContributions = computed(() =>
    goals.value
      .filter((g) => g.status === 'active')
      .reduce((sum, g) => sum + g.monthlyContribution, 0),
  )

  // ─── Hydrate ──────────────────────────────────────────────────────────────────

  const hydrate = async (targetUserId?: string): Promise<void> => {
    const userId = targetUserId ?? getUserId()
    if (!userId) return

    isReady.value = false
    const fetchedGoals = await fetchSavingsGoals(userId)
    const allDeposits = await fetchDepositsForGoals(fetchedGoals.map((g) => g.id))
    goals.value = fetchedGoals
    deposits.value = allDeposits.reduce<Record<string, SavingsDeposit[]>>((acc, d) => {
      if (!acc[d.goalId]) acc[d.goalId] = []
      acc[d.goalId].push(d)
      return acc
    }, {})
    isReady.value = true
  }

  // ─── Local mutations (optimistic, then debounced DB write) ────────────────────

  const addGoal = (
    partial: Omit<SavingsGoal, 'id' | 'userId' | 'currentAmount' | 'sortOrder' | 'createdAt' | 'updatedAt'>,
  ): SavingsGoal => {
    const userId = getUserId()
    if (!userId) throw new Error('Not authenticated')

    const now = new Date().toISOString()
    const goal: SavingsGoal = {
      ...partial,
      id: crypto.randomUUID(),
      userId,
      currentAmount: 0,
      sortOrder: goals.value.length,
      createdAt: now,
      updatedAt: now,
    }

    goals.value = [...goals.value, goal]

    if (isReady.value) {
      void insertSavingsGoal(userId, goal)
    }

    return goal
  }

  const updateGoal = (goalId: string, updates: Partial<SavingsGoal>): void => {
    goals.value = goals.value.map((g) =>
      g.id === goalId ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g,
    )

    if (!isReady.value) return

    // Map camelCase updates to snake_case DB columns
    const dbUpdates: GoalDbUpdates = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency
    if (updates.targetAmount !== undefined) dbUpdates.target_amount = updates.targetAmount
    if (updates.monthlyContribution !== undefined) dbUpdates.monthly_contribution = updates.monthlyContribution
    if (updates.targetDate !== undefined) dbUpdates.target_date = updates.targetDate
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.note !== undefined) dbUpdates.note = updates.note
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder

    const pending = pendingGoalWrites.get(goalId)
    if (pending) clearTimeout(pending.timer)
    const merged: GoalDbUpdates = { ...pending?.updates, ...dbUpdates }
    pendingGoalWrites.set(goalId, {
      updates: merged,
      timer: setTimeout(() => {
        pendingGoalWrites.delete(goalId)
        void updateSavingsGoal(goalId, merged)
      }, 600),
    })
  }

  // Converts a goal and its deposits to another currency (`rate` = new per 1 old).
  // Applied locally straight away; if the server rejects it the goal is reloaded
  // so the screen never shows a conversion that did not happen.
  const changeGoalCurrency = async (goalId: string, currency: string, rate: number): Promise<void> => {
    const goal = goals.value.find((g) => g.id === goalId)
    if (!goal) return

    const to = (amount: number): number => Math.round(amount * rate * 100) / 100

    goals.value = goals.value.map((g) =>
      g.id === goalId
        ? {
            ...g,
            currency,
            targetAmount: to(g.targetAmount),
            monthlyContribution: to(g.monthlyContribution),
            currentAmount: to(g.currentAmount),
            updatedAt: new Date().toISOString(),
          }
        : g,
    )
    deposits.value = {
      ...deposits.value,
      [goalId]: (deposits.value[goalId] ?? []).map((d) => ({ ...d, amount: to(d.amount) })),
    }

    if (!isReady.value) return
    const ok = await changeSavingsGoalCurrency(goalId, currency, rate)
    if (!ok) await hydrate(goal.userId)
  }

  const applyRemoteDepositUpdate = (row: Record<string, unknown>): void => {
    const deposit = mapSavingsDepositRow(row)
    const existing = deposits.value[deposit.goalId]
    if (!existing?.some((d) => d.id === deposit.id)) return
    deposits.value = {
      ...deposits.value,
      [deposit.goalId]: existing.map((d) => (d.id === deposit.id ? deposit : d)),
    }
  }

  const deleteGoal = (goalId: string): void => {
    const pending = pendingGoalWrites.get(goalId)
    if (pending) {
      clearTimeout(pending.timer)
      pendingGoalWrites.delete(goalId)
    }

    goals.value = goals.value.filter((g) => g.id !== goalId)
    const { [goalId]: _removed, ...rest } = deposits.value
    deposits.value = rest

    if (isReady.value) {
      void deleteSavingsGoal(goalId)
    }
  }

  // ─── Deposits ─────────────────────────────────────────────────────────────────

  const loadDeposits = async (goalId: string): Promise<void> => {
    deposits.value = {
      ...deposits.value,
      [goalId]: await fetchDepositsForGoal(goalId),
    }
  }

  const addDeposit = async (
    goalId: string,
    partial: Omit<SavingsDeposit, 'id' | 'goalId' | 'userId' | 'createdAt'>,
  ): Promise<void> => {
    const userId = getUserId()
    if (!userId) throw new Error('Not authenticated')

    const deposit: SavingsDeposit = {
      ...partial,
      id: crypto.randomUUID(),
      goalId,
      userId,
      createdAt: new Date().toISOString(),
    }

    // Optimistic: update current_amount and deposit list locally
    goals.value = goals.value.map((g) => {
      if (g.id !== goalId) return g
      const newAmount = g.currentAmount + deposit.amount
      return {
        ...g,
        currentAmount: newAmount,
        status: newAmount >= g.targetAmount && g.status === 'active' ? 'completed' : g.status,
        updatedAt: new Date().toISOString(),
      }
    })

    deposits.value = {
      ...deposits.value,
      [goalId]: [deposit, ...(deposits.value[goalId] ?? [])],
    }

    await insertSavingsDeposit(deposit)
  }

  const removeDeposit = async (depositId: string, goalId: string): Promise<void> => {
    const deposit = deposits.value[goalId]?.find((d) => d.id === depositId)
    if (!deposit) return

    // Optimistic: reverse the deposit amount on the goal
    goals.value = goals.value.map((g) =>
      g.id === goalId
        ? {
            ...g,
            currentAmount: Math.max(0, g.currentAmount - deposit.amount),
            updatedAt: new Date().toISOString(),
          }
        : g,
    )

    deposits.value = {
      ...deposits.value,
      [goalId]: (deposits.value[goalId] ?? []).filter((d) => d.id !== depositId),
    }

    await deleteSavingsDeposit(depositId)
  }

  // ─── Remote apply methods (called by collaboration store realtime handlers) ───

  const applyRemoteGoalUpsert = (row: Record<string, unknown>): void => {
    const goal = mapSavingsGoalRow(row)

    const idx = goals.value.findIndex((g) => g.id === goal.id)
    if (idx === -1) {
      goals.value = [...goals.value, goal]
    } else {
      goals.value = goals.value.map((g) => (g.id === goal.id ? goal : g))
    }
  }

  const applyRemoteGoalDelete = (goalId: string): void => {
    goals.value = goals.value.filter((g) => g.id !== goalId)
    const { [goalId]: _removed, ...rest } = deposits.value
    deposits.value = rest
  }

  const applyRemoteDepositInsert = (row: Record<string, unknown>): void => {
    const deposit = mapSavingsDepositRow(row)

    const goalId = deposit.goalId
    const existing = deposits.value[goalId] ?? []
    if (existing.some((d) => d.id === deposit.id)) return

    deposits.value = {
      ...deposits.value,
      [goalId]: [deposit, ...existing],
    }
    // The DB trigger already updated current_amount; we'll see the updated goal via
    // the savings_goals UPDATE realtime event — no need to touch currentAmount here.
  }

  const applyRemoteDepositDelete = (depositId: string, goalId: string): void => {
    deposits.value = {
      ...deposits.value,
      [goalId]: (deposits.value[goalId] ?? []).filter((d) => d.id !== depositId),
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────────

  const resetStore = (): void => {
    clearPendingGoalWrites()
    goals.value = []
    deposits.value = {}
    isReady.value = false
  }

  return {
    goals,
    deposits,
    isReady,
    sortedGoals,
    totalMonthlyContributions,
    hydrate,
    addGoal,
    updateGoal,
    deleteGoal,
    changeGoalCurrency,
    loadDeposits,
    addDeposit,
    removeDeposit,
    applyRemoteGoalUpsert,
    applyRemoteGoalDelete,
    applyRemoteDepositInsert,
    applyRemoteDepositUpdate,
    applyRemoteDepositDelete,
    resetStore,
  }
})

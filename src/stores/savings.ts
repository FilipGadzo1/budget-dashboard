import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { useAuth } from '@/composables/useAuth'
import type { SavingsDeposit, SavingsGoal } from '@/models'
import {
  deleteSavingsDeposit,
  deleteSavingsGoal,
  fetchDepositsForGoal,
  fetchSavingsGoals,
  insertSavingsDeposit,
  insertSavingsGoal,
  updateSavingsGoal,
} from '@/services/database'
import { sortGoals } from '@/services/savingsService'

let goalsSaveTimer: ReturnType<typeof setTimeout> | undefined

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
    goals.value = await fetchSavingsGoals(userId)
    deposits.value = {}
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
    const dbUpdates: Parameters<typeof updateSavingsGoal>[1] = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji
    if (updates.targetAmount !== undefined) dbUpdates.target_amount = updates.targetAmount
    if (updates.monthlyContribution !== undefined) dbUpdates.monthly_contribution = updates.monthlyContribution
    if (updates.targetDate !== undefined) dbUpdates.target_date = updates.targetDate
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.note !== undefined) dbUpdates.note = updates.note
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder

    clearTimeout(goalsSaveTimer)
    goalsSaveTimer = setTimeout(() => {
      void updateSavingsGoal(goalId, dbUpdates)
    }, 600)
  }

  const deleteGoal = (goalId: string): void => {
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
    const goal: SavingsGoal = {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      emoji: (row.emoji as string) ?? '🎯',
      targetAmount: Number(row.target_amount ?? 0),
      currentAmount: Number(row.current_amount ?? 0),
      monthlyContribution: Number(row.monthly_contribution ?? 0),
      targetDate: (row.target_date as string | null) ?? null,
      status: (row.status as SavingsGoal['status']) ?? 'active',
      note: (row.note as string | null) ?? null,
      sortOrder: Number(row.sort_order ?? 0),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }

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
    const deposit: SavingsDeposit = {
      id: row.id as string,
      goalId: row.goal_id as string,
      userId: row.user_id as string,
      amount: Number(row.amount ?? 0),
      note: (row.note as string | null) ?? null,
      depositDate: row.deposit_date as string,
      createdAt: row.created_at as string,
    }

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
    clearTimeout(goalsSaveTimer)
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
    loadDeposits,
    addDeposit,
    removeDeposit,
    applyRemoteGoalUpsert,
    applyRemoteGoalDelete,
    applyRemoteDepositInsert,
    applyRemoteDepositDelete,
    resetStore,
  }
})

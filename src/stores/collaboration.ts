import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'
import { fetchProfile, fetchProjectionInputs } from '@/services/database'
import type {
  ActivityEntry,
  BudgetContext,
  Collaboration,
  CollaborationRole,
  OnlineUser,
  SharedBudget,
} from '@/models'
import {
  acceptInvite as dbAcceptInvite,
  declineInvite as dbDeclineInvite,
  fetchActivityLog,
  fetchMyCollaborators,
  fetchSharedWithMe,
  inviteCollaborator,
  logActivity as dbLogActivity,
  revokeCollaborator,
  updateCollaboratorRole,
} from '@/services/collaborationService'

export const useCollaborationStore = defineStore('collaboration', () => {
  const collaborators = ref<Collaboration[]>([])
  const sharedBudgets = ref<SharedBudget[]>([])
  const activityLog = ref<ActivityEntry[]>([])
  const activeBudgetContext = ref<BudgetContext | null>(null)
  const isLoading = ref(false)
  const onlineUsers = ref<OnlineUser[]>([])

  let realtimeChannel: RealtimeChannel | null = null
  let stopInputsBroadcastWatcher: (() => void) | null = null
  let inputsBroadcastTimer: ReturnType<typeof setTimeout> | undefined

  const getUserId = (): string | null => {
    const { user } = useAuth()
    return user.value?.id ?? null
  }

  const getUser = () => {
    const { user } = useAuth()
    return user.value
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  const pendingInvitesCount = computed(
    () => sharedBudgets.value.filter((b) => b.status === 'pending').length,
  )

  const acceptedSharedBudgets = computed(
    () => sharedBudgets.value.filter((b) => b.status === 'accepted'),
  )

  const isViewingSharedBudget = computed(() => activeBudgetContext.value !== null)

  const isReadOnly = computed(
    () => activeBudgetContext.value !== null && activeBudgetContext.value.role === 'viewer',
  )

  const budgetOwnerId = computed(
    () => activeBudgetContext.value?.ownerId ?? getUserId(),
  )

  // ─── Hydrate ──────────────────────────────────────────────────────────────────

  const hydrate = async (): Promise<void> => {
    const userId = getUserId()
    if (!userId) return

    isLoading.value = true
    try {
      const [myCollabs, shared] = await Promise.all([
        fetchMyCollaborators(userId),
        fetchSharedWithMe(userId),
      ])

      collaborators.value = myCollabs
      sharedBudgets.value = shared

      // Load activity for the current budget context
      const ownerId = activeBudgetContext.value?.ownerId ?? userId
      activityLog.value = await fetchActivityLog(ownerId)

      // Start Realtime subscription for the current budget
      startRealtime(ownerId)
    } finally {
      isLoading.value = false
    }
  }

  const refreshActivity = async (): Promise<void> => {
    const ownerId = budgetOwnerId.value
    if (!ownerId) return
    activityLog.value = await fetchActivityLog(ownerId)
  }

  // ─── Invite actions ───────────────────────────────────────────────────────────

  const invite = async (
    collaboratorEmail: string,
    role: CollaborationRole,
  ): Promise<Collaboration> => {
    const user = getUser()
    if (!user) throw new Error('Not authenticated.')

    const uiStore = useUiStore()
    const result = await inviteCollaborator(
      user.id,
      user.email ?? '',
      user.user_metadata?.full_name ?? '',
      collaboratorEmail,
      role,
      uiStore.currencyCode,
      uiStore.locale,
    )

    collaborators.value = [result, ...collaborators.value]
    return result
  }

  const revoke = async (collaborationId: string): Promise<void> => {
    await revokeCollaborator(collaborationId)
    collaborators.value = collaborators.value.filter((c) => c.id !== collaborationId)
  }

  const updateRole = async (collaborationId: string, role: CollaborationRole): Promise<void> => {
    await updateCollaboratorRole(collaborationId, role)
    collaborators.value = collaborators.value.map((c) =>
      c.id === collaborationId ? { ...c, role } : c,
    )
  }

  // ─── Accept / Decline ─────────────────────────────────────────────────────────

  const acceptInvite = async (collaborationId: string): Promise<void> => {
    const user = getUser()
    if (!user) return

    await dbAcceptInvite(
      collaborationId,
      user.id,
      user.user_metadata?.full_name ?? '',
    )

    // Log the join activity
    const budget = sharedBudgets.value.find((b) => b.collaborationId === collaborationId)
    if (budget) {
      await dbLogActivity(
        budget.ownerId,
        user.id,
        user.email ?? '',
        user.user_metadata?.full_name ?? '',
        'joined',
        { role: budget.role },
      )
    }

    sharedBudgets.value = sharedBudgets.value.map((b) =>
      b.collaborationId === collaborationId
        ? { ...b, status: 'accepted' as const }
        : b,
    )
  }

  const declineInvite = async (collaborationId: string): Promise<void> => {
    await dbDeclineInvite(collaborationId)
    sharedBudgets.value = sharedBudgets.value.map((b) =>
      b.collaborationId === collaborationId
        ? { ...b, status: 'declined' as const }
        : b,
    )
  }

  // ─── Budget context switching ─────────────────────────────────────────────────

  const switchContext = async (context: BudgetContext): Promise<void> => {
    // Fetch the owner's profile to get their current selectedMonth
    const ownerProfile = await fetchProfile(context.ownerId)
    activeBudgetContext.value = {
      ...context,
      ownerSelectedMonth: ownerProfile?.selectedMonth ?? context.ownerSelectedMonth,
    }
    // Reload projection store with the owner's data
    const projectionStore = useProjectionStore()
    projectionStore.resetStore()
    await projectionStore.hydrate(context.ownerId)

    // Switch Realtime subscription to the new budget
    startRealtime(context.ownerId)

    // Load activity for the new context
    activityLog.value = await fetchActivityLog(context.ownerId)

    // Log the view event
    const user = getUser()
    if (user) {
      void dbLogActivity(
        context.ownerId,
        user.id,
        user.email ?? '',
        user.user_metadata?.full_name ?? '',
        'viewed_budget',
      )
    }
  }

  const exitContext = async (): Promise<void> => {
    activeBudgetContext.value = null
    const projectionStore = useProjectionStore()
    projectionStore.resetStore()
    await projectionStore.hydrate()

    // Switch Realtime subscription back to own budget
    const userId = getUserId()
    if (userId) {
      startRealtime(userId)
      activityLog.value = await fetchActivityLog(userId)
    }
  }

  // ─── Activity logging helper (for use from views) ─────────────────────────────

  const logActivity = async (
    action: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> => {
    const user = getUser()
    const ownerId = budgetOwnerId.value
    if (!user || !ownerId) return

    const entry: ActivityEntry = {
      id: crypto.randomUUID(),
      budgetOwnerId: ownerId,
      actorId: user.id,
      actorEmail: user.email ?? '',
      actorName: user.user_metadata?.full_name ?? '',
      action,
      metadata,
      createdAt: new Date().toISOString(),
    }

    // Optimistic update
    activityLog.value = [entry, ...activityLog.value].slice(0, 20)

    await dbLogActivity(
      ownerId,
      user.id,
      user.email ?? '',
      user.user_metadata?.full_name ?? '',
      action,
      metadata,
    )
  }

  // ─── Realtime subscription ────────────────────────────────────────────────────

  const stopRealtime = (): void => {
    stopInputsBroadcastWatcher?.()
    stopInputsBroadcastWatcher = null
    clearTimeout(inputsBroadcastTimer)
    if (realtimeChannel) {
      void supabase.removeChannel(realtimeChannel)
      realtimeChannel = null
    }
    // Do NOT clear onlineUsers here — presence repopulates via the sync event on the
    // new channel. Clearing causes a flash where all avatars disappear on every context
    // switch. Reset() clears it explicitly on logout.
  }

  const startRealtime = (ownerId: string): void => {
    stopRealtime()

    const user = getUser()
    const projectionStore = useProjectionStore()

    const channel = supabase.channel(`budget:${ownerId}`, {
      config: { presence: { key: user?.id ?? 'anon' } },
    })

    // ── Projection inputs ──
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'projection_inputs', filter: `user_id=eq.${ownerId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown>
        projectionStore.applyRemoteInputs(
          Number(row.monthly_income),
          Number(row.monthly_expenses),
          row.months as number,
        )
      },
    )

    // ── Scenarios ──
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'scenarios', filter: `user_id=eq.${ownerId}` },
      (payload) => projectionStore.applyRemoteScenarioUpsert(payload.new as Record<string, unknown>),
    )

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'scenarios', filter: `user_id=eq.${ownerId}` },
      (payload) => projectionStore.applyRemoteScenarioUpsert(payload.new as Record<string, unknown>),
    )

    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'scenarios', filter: `user_id=eq.${ownerId}` },
      (payload) => projectionStore.applyRemoteScenarioDelete((payload.old as { id: string }).id),
    )

    // ── Expense items — refetch all on any row change ──
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'expense_items', filter: `user_id=eq.${ownerId}` },
      (_payload) => {
        fetchProjectionInputs(ownerId)
          .then((inputs) => { if (inputs) projectionStore.applyRemoteExpenseItems(inputs.expenseItems) })
          .catch((err) => console.warn('[realtime] expense_items refetch error:', err))
      },
    )

    // ── Owner profile (currency / locale) — via Broadcast, not postgres_changes ──
    // postgres_changes RLS evaluation is unreliable for cross-table policies;
    // the owner explicitly broadcasts after saving so collaborators get it instantly.
    channel.on('broadcast', { event: 'profile_updated' }, ({ payload }) => {
      const p = payload as Record<string, string>
      if (activeBudgetContext.value?.ownerId === ownerId) {
        // Collaborator/viewer side: update the shared budget context
        activeBudgetContext.value = {
          ...activeBudgetContext.value,
          ownerCurrencyCode: p.currencyCode ?? activeBudgetContext.value.ownerCurrencyCode,
          ownerLocale: p.locale ?? activeBudgetContext.value.ownerLocale,
          ownerSelectedMonth: p.selectedMonth ?? activeBudgetContext.value.ownerSelectedMonth,
        }
      } else if (getUserId() === ownerId && p.selectedMonth) {
        // Owner side: an editor changed the start month, apply it to our own view
        useUiStore().setSelectedMonth(p.selectedMonth)
      }
    })

    // ── Collaborations — update collaborators list when someone accepts/declines/role changes ──
    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'collaborations', filter: `owner_id=eq.${ownerId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown>
        const newRole = row.role as CollaborationRole
        // Update the collaborator in place without a full refetch
        collaborators.value = collaborators.value.map((c) =>
          c.id === row.id
            ? {
                ...c,
                status: row.status as Collaboration['status'],
                role: newRole,
                collaboratorId: (row.collaborator_id as string | null) ?? null,
                collaboratorName: (row.collaborator_name as string | null) ?? null,
              }
            : c,
        )
        // Also update sharedBudgets (collaborator's own view) including role
        sharedBudgets.value = sharedBudgets.value.map((b) =>
          b.collaborationId === row.id
            ? { ...b, status: row.status as SharedBudget['status'], role: newRole }
            : b,
        )
        // If this update affects the current user's active context, update role live
        const myId = getUserId()
        if (myId && row.collaborator_id === myId && activeBudgetContext.value?.ownerId === ownerId) {
          activeBudgetContext.value = { ...activeBudgetContext.value, role: newRole }
        }
      },
    )

    // ── Inputs broadcast — fast path for real-time input sync (bidirectional) ──
    // All participants (owner + editors) broadcast their own changes. All receive others'.
    // isReceivingRemoteUpdate prevents echo: a change applied from broadcast is flagged,
    // so the watcher skips re-broadcasting it back.
    stopInputsBroadcastWatcher?.()
    stopInputsBroadcastWatcher = watch(
      () => projectionStore.inputs,
      (inputs) => {
        if (!projectionStore.isReady || projectionStore.isReceivingRemoteUpdate) return
        clearTimeout(inputsBroadcastTimer)
        inputsBroadcastTimer = setTimeout(() => {
          if (!realtimeChannel) return
          void realtimeChannel.send({
            type: 'broadcast',
            event: 'inputs_updated',
            payload: {
              monthly_income: inputs.monthlyIncome,
              monthly_expenses: inputs.monthlyExpenses,
              months: inputs.months,
              expense_items: inputs.expenseItems,
            },
          })
        }, 300)
      },
      { deep: true },
    )

    channel.on('broadcast', { event: 'inputs_updated' }, ({ payload }) => {
      const p = payload as Record<string, unknown>
      projectionStore.applyRemoteFullInputs(
        Number(p.monthly_income),
        Number(p.monthly_expenses),
        p.months as number,
        Array.isArray(p.expense_items) ? (p.expense_items as import('@/models').ExpenseItem[]) : [],
      )
    })

    // ── Presence ──
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<OnlineUser>()
      const all = Object.values(state).flat()
      // Deduplicate by userId: multiple connections from the same user (e.g. after a
      // refresh before the old socket closes) should only show one avatar.
      const seen = new Set<string>()
      onlineUsers.value = all.filter((u) => {
        if (seen.has(u.userId)) return false
        seen.add(u.userId)
        return true
      })
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && user) {
        channel.track({
          userId: user.id,
          userName: user.user_metadata?.full_name ?? '',
          userEmail: user.email ?? '',
          avatarUrl: user.user_metadata?.avatar_url ?? null,
        } satisfies OnlineUser).catch((err) => console.warn('[realtime] presence track error:', err))
      }
      if (status === 'CHANNEL_ERROR') {
        console.warn('[realtime] channel error for budget:', ownerId)
      }
    })

    realtimeChannel = channel
  }

  // ─── Broadcast helpers ───────────────────────────────────────────────────────

  // Called by the owner after saving currency/locale so all collaborators
  // viewing this budget get the update immediately via WebSocket.
  const broadcastProfileUpdate = (currencyCode: string, locale: string, selectedMonth?: string): void => {
    if (!realtimeChannel) return
    void realtimeChannel.send({
      type: 'broadcast',
      event: 'profile_updated',
      payload: { currencyCode, locale, ...(selectedMonth !== undefined && { selectedMonth }) },
    })
  }

  // Called by an editor to change the shared start month and propagate it to all viewers.
  const updateSharedSelectedMonth = (month: string): void => {
    if (!activeBudgetContext.value) return
    activeBudgetContext.value = { ...activeBudgetContext.value, ownerSelectedMonth: month }
    if (!realtimeChannel) return
    void realtimeChannel.send({
      type: 'broadcast',
      event: 'profile_updated',
      payload: {
        currencyCode: activeBudgetContext.value.ownerCurrencyCode,
        locale: activeBudgetContext.value.ownerLocale,
        selectedMonth: month,
      },
    })
  }

  // ─── Reset on logout ──────────────────────────────────────────────────────────

  const reset = (): void => {
    stopRealtime()
    collaborators.value = []
    sharedBudgets.value = []
    activityLog.value = []
    activeBudgetContext.value = null
    isLoading.value = false
    onlineUsers.value = []
  }

  return {
    collaborators,
    sharedBudgets,
    activityLog,
    activeBudgetContext,
    isLoading,
    onlineUsers,
    pendingInvitesCount,
    acceptedSharedBudgets,
    isViewingSharedBudget,
    isReadOnly,
    budgetOwnerId,
    hydrate,
    refreshActivity,
    invite,
    revoke,
    updateRole,
    acceptInvite,
    declineInvite,
    switchContext,
    exitContext,
    logActivity,
    broadcastProfileUpdate,
    updateSharedSelectedMonth,
    stopRealtime,
    reset,
  }
})

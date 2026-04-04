<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import ActivityFeed from '@/components/collaboration/ActivityFeed.vue'
import CollaboratorCard from '@/components/collaboration/CollaboratorCard.vue'
import InviteDialog from '@/components/collaboration/InviteDialog.vue'
import PendingInviteCard from '@/components/collaboration/PendingInviteCard.vue'
import ConfirmDeleteDialog from '@/components/shared/ConfirmDeleteDialog.vue'
import type { Collaboration, CollaborationRole, SharedBudget } from '@/models'
import { useCollaborationStore } from '@/stores/collaboration'

const collabStore = useCollaborationStore()
const router = useRouter()

const showInviteDialog = ref(false)
const showRevokeDialog = ref(false)
const revokeTarget = ref<Collaboration | null>(null)
const respondingId = ref<string | null>(null)

onMounted(() => {
  void collabStore.hydrate()
})

const openRevoke = (collab: Collaboration): void => {
  revokeTarget.value = collab
  showRevokeDialog.value = true
}

const confirmRevoke = async (): Promise<void> => {
  if (!revokeTarget.value) return
  await collabStore.revoke(revokeTarget.value.id)
  revokeTarget.value = null
}

const handleChangeRole = async (id: string, role: CollaborationRole): Promise<void> => {
  await collabStore.updateRole(id, role)
}

const handleAccept = async (budget: SharedBudget): Promise<void> => {
  respondingId.value = budget.collaborationId
  try {
    await collabStore.acceptInvite(budget.collaborationId)
  } finally {
    respondingId.value = null
  }
}

const handleDecline = async (budget: SharedBudget): Promise<void> => {
  respondingId.value = budget.collaborationId
  try {
    await collabStore.declineInvite(budget.collaborationId)
  } finally {
    respondingId.value = null
  }
}

const viewBudget = async (budget: SharedBudget): Promise<void> => {
  await collabStore.switchContext({
    ownerId: budget.ownerId,
    ownerName: budget.ownerName,
    ownerEmail: budget.ownerEmail,
    role: budget.role,
    ownerCurrencyCode: budget.ownerCurrencyCode,
    ownerLocale: budget.ownerLocale,
  })
  void router.push('/')
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Collaboration</h1>
      <p class="page-description">Share your budget with partners and family.</p>
    </div>

    <div class="collab-layout">
      <!-- Left column -->
      <div class="collab-main">

        <!-- People with access to my budget -->
        <section class="card mb-6">
          <div class="collab-section-header">
            <div>
              <h2 class="collab-section-title">People with access</h2>
              <p class="collab-section-desc">Manage who can view or edit your budget.</p>
            </div>
            <button class="btn btn-primary btn-sm" @click="showInviteDialog = true">
              <i class="pi pi-user-plus text-xs" />
              Invite
            </button>
          </div>

          <div v-if="collabStore.isLoading && !collabStore.collaborators.length" class="flex justify-center py-6">
            <i class="pi pi-spin pi-spinner text-secondary" />
          </div>

          <div v-else-if="!collabStore.collaborators.length" class="collab-empty">
            <i class="pi pi-users text-2xl" style="color: var(--app-text-tertiary)" />
            <p class="text-sm text-secondary">No one has access yet.</p>
            <button class="btn btn-secondary btn-sm" @click="showInviteDialog = true">
              <i class="pi pi-user-plus text-xs" /> Send first invite
            </button>
          </div>

          <div v-else class="flex flex-col gap-2 mt-4">
            <CollaboratorCard
              v-for="collab in collabStore.collaborators"
              :key="collab.id"
              :collaboration="collab"
              :is-online="collabStore.onlineUsers.some(u => u.userEmail === collab.collaboratorEmail)"
              @revoke="openRevoke(collab)"
              @change-role="handleChangeRole(collab.id, $event)"
            />
          </div>
        </section>

        <!-- Budgets shared with me -->
        <section class="card">
          <div class="collab-section-header mb-0">
            <div>
              <h2 class="collab-section-title">Shared with me</h2>
              <p class="collab-section-desc">Budgets other people have invited you to.</p>
            </div>
          </div>

          <div v-if="!collabStore.sharedBudgets.length" class="collab-empty">
            <i class="pi pi-share-alt text-2xl" style="color: var(--app-text-tertiary)" />
            <p class="text-sm text-secondary">No shared budgets yet.</p>
          </div>

          <div v-else class="flex flex-col gap-2 mt-4">
            <!-- Pending invites -->
            <template v-for="budget in collabStore.sharedBudgets" :key="budget.collaborationId">
              <PendingInviteCard
                v-if="budget.status !== 'accepted'"
                :budget="budget"
                :loading="respondingId === budget.collaborationId"
                @accept="handleAccept(budget)"
                @decline="handleDecline(budget)"
              />

              <!-- Accepted shared budgets -->
              <div v-else class="shared-budget-card">
                <div class="shared-budget-avatar">
                  {{ (budget.ownerName || budget.ownerEmail).charAt(0).toUpperCase() }}
                </div>
                <div class="shared-budget-info">
                  <p class="text-sm font-medium text-primary">{{ budget.ownerName || budget.ownerEmail }}</p>
                  <p class="text-xs text-secondary">{{ budget.ownerEmail }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="status-pill text-xs" :class="budget.role === 'editor' ? 'status-pill-positive' : ''">
                    <i :class="['pi', budget.role === 'editor' ? 'pi-pencil' : 'pi-eye', 'text-xs']" />
                    {{ budget.role }}
                  </span>
                  <button
                    class="btn btn-primary btn-sm"
                    :class="{ 'btn-outline': collabStore.activeBudgetContext?.ownerId === budget.ownerId }"
                    @click="viewBudget(budget)"
                  >
                    <i class="pi pi-arrow-right text-xs" />
                    {{ collabStore.activeBudgetContext?.ownerId === budget.ownerId ? 'Active' : 'Open' }}
                  </button>
                </div>
              </div>
            </template>
          </div>
        </section>
      </div>

      <!-- Right column: Activity feed -->
      <aside class="collab-sidebar">
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="collab-section-title mb-0">Recent activity</h2>
            <button
              class="btn btn-secondary btn-sm"
              :title="'Refresh'"
              @click="collabStore.refreshActivity()"
            >
              <i class="pi pi-refresh text-xs" />
            </button>
          </div>
          <ActivityFeed
            :entries="collabStore.activityLog"
            :loading="collabStore.isLoading && !collabStore.activityLog.length"
          />
        </div>
      </aside>
    </div>

    <!-- Invite dialog -->
    <InviteDialog v-model:visible="showInviteDialog" />

    <!-- Revoke confirm dialog -->
    <ConfirmDeleteDialog
      v-model:visible="showRevokeDialog"
      title="Revoke access"
      :message="`Remove ${revokeTarget?.collaboratorEmail ?? 'this person'}'s access to your budget? They won't be able to view or edit it anymore.`"
      confirm-label="Revoke"
      @confirm="confirmRevoke"
    />
  </div>
</template>

<style scoped>
.collab-layout {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .collab-layout {
    grid-template-columns: 1fr 18rem;
    align-items: start;
  }
}

.collab-main {
  min-width: 0;
}

.collab-sidebar {
  min-width: 0;
}

.collab-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.collab-section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--app-text);
  margin-bottom: 0.125rem;
}

.collab-section-desc {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.collab-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 0 0.5rem;
  text-align: center;
}

.shared-budget-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 0.625rem;
}

.shared-budget-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--app-accent-soft);
  color: var(--app-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
  flex-shrink: 0;
}

.shared-budget-info {
  flex: 1;
  min-width: 0;
}

@media (max-width: 1023px) {
  .collab-section-header {
    flex-direction: column;
    gap: 0.5rem;
  }

  .collab-section-header .btn {
    width: 100%;
    justify-content: center;
  }

  .collab-section-title {
    font-family: 'DM Sans', sans-serif;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .shared-budget-card {
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
  }

  .shared-budget-card .flex.items-center.gap-2 {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>

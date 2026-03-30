<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuth } from '@/composables/useAuth'
import type { InviteInfo } from '@/models'
import { acceptInvite, declineInvite, fetchInviteByToken } from '@/services/collaborationService'
import { useCollaborationStore } from '@/stores/collaboration'

const route = useRoute()
const router = useRouter()
const { user, loading: authLoading, signInWithGoogle } = useAuth()
const collabStore = useCollaborationStore()

const token = computed(() => route.params.token as string)

const invite = ref<InviteInfo | null>(null)
const fetchLoading = ref(true)
const actionLoading = ref(false)
const status = ref<'idle' | 'accepted' | 'declined' | 'error' | 'already_responded'>('idle')
const errorMessage = ref('')

onMounted(async () => {
  if (!token.value) {
    status.value = 'error'
    errorMessage.value = 'Invalid invite link.'
    fetchLoading.value = false
    return
  }

  const info = await fetchInviteByToken(token.value)
  fetchLoading.value = false

  if (!info) {
    status.value = 'error'
    errorMessage.value = 'This invite link is invalid or has expired.'
    return
  }

  if (info.status !== 'pending') {
    status.value = 'already_responded'
  }

  invite.value = info
})

const handleAccept = async (): Promise<void> => {
  if (!user.value || !invite.value) return
  actionLoading.value = true
  try {
    await acceptInvite(invite.value.id, user.value.id, user.value.user_metadata?.full_name ?? '')
    await collabStore.hydrate()
    status.value = 'accepted'
  } catch {
    errorMessage.value = 'Something went wrong. Please try again.'
  } finally {
    actionLoading.value = false
  }
}

const handleDecline = async (): Promise<void> => {
  if (!invite.value) return
  actionLoading.value = true
  try {
    await declineInvite(invite.value.id)
    status.value = 'declined'
  } finally {
    actionLoading.value = false
  }
}

const goToBudget = async (): Promise<void> => {
  if (!invite.value) {
    void router.push('/')
    return
  }
  const sharedBudget = collabStore.sharedBudgets.find(
    (b) => b.ownerId === invite.value!.ownerId,
  )
  if (sharedBudget) {
    await collabStore.switchContext({
      ownerId: sharedBudget.ownerId,
      ownerName: sharedBudget.ownerName,
      ownerEmail: sharedBudget.ownerEmail,
      role: sharedBudget.role,
      ownerCurrencyCode: sharedBudget.ownerCurrencyCode,
      ownerLocale: sharedBudget.ownerLocale,
    })
  }
  void router.push('/')
}

const goHome = (): void => {
  void router.push('/')
}
</script>

<template>
  <div class="invite-page">
    <div class="invite-card">
      <!-- Loading -->
      <div v-if="fetchLoading || authLoading" class="invite-state">
        <i class="pi pi-spin pi-spinner invite-icon" style="color: var(--app-accent)" />
        <p class="text-secondary text-sm">Loading invite...</p>
      </div>

      <!-- Error -->
      <div v-else-if="status === 'error'" class="invite-state">
        <i class="pi pi-exclamation-circle invite-icon" style="color: var(--app-negative)" />
        <h2 class="invite-title">Invalid invite</h2>
        <p class="text-secondary text-sm">{{ errorMessage }}</p>
        <button class="btn btn-primary" @click="goHome">Go to dashboard</button>
      </div>

      <!-- Already responded -->
      <div v-else-if="status === 'already_responded' && invite" class="invite-state">
        <i class="pi pi-info-circle invite-icon" style="color: var(--app-warning)" />
        <h2 class="invite-title">Already responded</h2>
        <p class="text-secondary text-sm text-center">
          This invitation from <strong>{{ invite.ownerName || invite.ownerEmail }}</strong>
          has already been {{ invite.status }}.
        </p>
        <button class="btn btn-primary" @click="goHome">Go to dashboard</button>
      </div>

      <!-- Accepted -->
      <div v-else-if="status === 'accepted' && invite" class="invite-state">
        <i class="pi pi-check-circle invite-icon" style="color: var(--app-positive)" />
        <h2 class="invite-title">You're in!</h2>
        <p class="text-secondary text-sm text-center">
          You now have {{ invite.role }} access to
          <strong>{{ invite.ownerName || invite.ownerEmail }}'s budget</strong>.
        </p>
        <button class="btn btn-primary" @click="goToBudget">
          <i class="pi pi-arrow-right text-sm" /> View their budget
        </button>
      </div>

      <!-- Declined -->
      <div v-else-if="status === 'declined'" class="invite-state">
        <i class="pi pi-times-circle invite-icon" style="color: var(--app-text-secondary)" />
        <h2 class="invite-title">Invitation declined</h2>
        <p class="text-secondary text-sm">You can always ask them to send a new invite.</p>
        <button class="btn btn-secondary" @click="goHome">Go to dashboard</button>
      </div>

      <!-- Not logged in -->
      <div v-else-if="!user && invite" class="invite-state">
        <div class="invite-brand">B</div>
        <h2 class="invite-title">Budget invitation</h2>
        <div class="invite-info-block">
          <p class="text-sm text-secondary text-center">
            <strong>{{ invite.ownerName || invite.ownerEmail }}</strong>
            has invited you to collaborate on their budget as
            <strong>{{ invite.role }}</strong>.
          </p>
        </div>
        <p class="text-xs text-secondary">Sign in to accept this invitation</p>
        <button class="btn btn-primary" @click="signInWithGoogle">
          <i class="pi pi-google text-sm" /> Continue with Google
        </button>
      </div>

      <!-- Pending invite, logged in -->
      <div v-else-if="invite && status === 'idle'" class="invite-state">
        <div class="invite-brand">B</div>
        <h2 class="invite-title">Budget invitation</h2>

        <div class="invite-info-block">
          <div class="invite-detail">
            <span class="invite-detail-label">From</span>
            <span class="invite-detail-value">{{ invite.ownerName || invite.ownerEmail }}</span>
          </div>
          <div class="invite-detail">
            <span class="invite-detail-label">Access</span>
            <span class="invite-detail-value capitalize">
              <i :class="['pi', invite.role === 'editor' ? 'pi-pencil' : 'pi-eye', 'text-xs']" />
              {{ invite.role }}
            </span>
          </div>
          <div class="invite-detail">
            <span class="invite-detail-label">For</span>
            <span class="invite-detail-value">{{ invite.collaboratorEmail }}</span>
          </div>
        </div>

        <p v-if="errorMessage" class="text-sm" style="color: var(--app-negative)">{{ errorMessage }}</p>

        <p class="text-xs text-secondary text-center">
          As a <strong>{{ invite.role }}</strong>,
          you will {{ invite.role === 'editor' ? 'be able to view and edit' : 'only be able to view' }}
          their financial projections.
        </p>

        <div class="flex gap-2 w-full">
          <button
            class="btn btn-secondary flex-1"
            :disabled="actionLoading"
            @click="handleDecline"
          >
            Decline
          </button>
          <button
            class="btn btn-primary flex-1"
            :disabled="actionLoading"
            @click="handleAccept"
          >
            <i v-if="actionLoading" class="pi pi-spin pi-spinner text-sm" />
            Accept
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.invite-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--app-bg);
}

.invite-card {
  width: min(100%, 22rem);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 1rem;
  padding: 2rem 1.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.invite-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.invite-icon {
  font-size: 2.5rem;
}

.invite-brand {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  background: var(--app-accent);
  color: var(--app-accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
}

.invite-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--app-text);
  text-align: center;
}

.invite-info-block {
  width: 100%;
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 0.625rem;
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.invite-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.invite-detail-label {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.invite-detail-value {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--app-text);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'

import DialogHeader from '@/components/shared/DialogHeader.vue'
import type { Collaboration, CollaborationRole } from '@/models'
import { useCollaborationStore } from '@/stores/collaboration'

const emit = defineEmits<{ invited: [collab: Collaboration] }>()

const visible = defineModel<boolean>('visible', { default: false })

const collabStore = useCollaborationStore()

const email = ref('')
const role = ref<CollaborationRole>('viewer')
const error = ref('')
const loading = ref(false)
const inviteLink = ref('')

const roleOptions = [
  { label: 'Viewer — read-only access', value: 'viewer' as CollaborationRole },
  { label: 'Editor — can modify budget', value: 'editor' as CollaborationRole },
]

const submit = async (): Promise<void> => {
  error.value = ''
  const trimmed = email.value.trim().toLowerCase()

  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    error.value = 'Please enter a valid email address.'
    return
  }

  loading.value = true
  try {
    const result = await collabStore.invite(trimmed, role.value)
    inviteLink.value = `${window.location.origin}/invite/${result.inviteToken}`
    emit('invited', result)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send invite. Please try again.'
  } finally {
    loading.value = false
  }
}

const copyLink = async (): Promise<void> => {
  await navigator.clipboard.writeText(inviteLink.value)
}

const close = (): void => {
  visible.value = false
  email.value = ''
  role.value = 'viewer'
  error.value = ''
  inviteLink.value = ''
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    dismissable-mask
    :draggable="false"
    :style="{ width: 'min(92vw, 30rem)' }"
    @hide="close"
  >
    <template #header>
      <DialogHeader label="Collaboration" title="Invite someone" />
    </template>

    <!-- Invite form -->
    <div v-if="!inviteLink" class="flex flex-col gap-4">
      <p class="text-sm text-secondary">
        Share your budget with a partner or collaborator. They'll need a Budget Dashboard account to accept.
      </p>

      <div>
        <label class="form-label" for="invite-email">Email address</label>
        <InputText
          id="invite-email"
          v-model="email"
          placeholder="partner@example.com"
          class="w-full"
          type="email"
          :disabled="loading"
          @keyup.enter="submit"
        />
      </div>

      <div>
        <label class="form-label" for="invite-role">Permission level</label>
        <Select
          id="invite-role"
          v-model="role"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          class="w-full"
          :disabled="loading"
        />
      </div>

      <p v-if="error" class="text-sm" style="color: var(--app-negative)">{{ error }}</p>
    </div>

    <!-- Invite link -->
    <div v-else class="flex flex-col gap-4">
      <div class="invite-success-icon">
        <i class="pi pi-check-circle" />
      </div>
      <p class="text-center text-sm text-secondary">
        Invitation created! Share this link with <strong>{{ email }}</strong>.
      </p>
      <div class="invite-link-box">
        <span class="invite-link-text">{{ inviteLink }}</span>
        <button class="btn btn-secondary btn-sm flex-shrink-0" @click="copyLink">
          <i class="pi pi-copy text-xs" /> Copy
        </button>
      </div>
      <a
        class="btn btn-secondary w-full"
        :href="`mailto:${email}?subject=${encodeURIComponent('Budget Dashboard invitation')}&body=${encodeURIComponent(`Hi,\n\nI'd like to share my budget with you on Budget Dashboard.\n\nClick the link below to accept:\n${inviteLink}\n\nSee you there!`)}`"
      >
        <i class="pi pi-envelope text-sm" /> Send via email
      </a>
      <p class="text-center text-xs text-secondary">
        The link expires when revoked from your collaborators list.
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button class="btn btn-secondary" @click="close">
          {{ inviteLink ? 'Done' : 'Cancel' }}
        </button>
        <button
          v-if="!inviteLink"
          class="btn btn-primary"
          :disabled="loading"
          @click="submit"
        >
          <i v-if="loading" class="pi pi-spin pi-spinner text-sm" />
          <i v-else class="pi pi-user-plus text-sm" />
          Send invite
        </button>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.invite-success-icon {
  display: flex;
  justify-content: center;
  font-size: 2.5rem;
  color: var(--app-positive);
}

.invite-link-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 0.5rem;
  overflow: hidden;
}

.invite-link-text {
  flex: 1;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
}
</style>

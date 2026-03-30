<script setup lang="ts">
import type { Collaboration, CollaborationRole } from '@/models'

const props = defineProps<{
  collaboration: Collaboration
  isOnline?: boolean
}>()

const emit = defineEmits<{
  revoke: []
  changeRole: [role: CollaborationRole]
}>()

const getInitial = (name: string | null, email: string): string => {
  if (name) return name.charAt(0).toUpperCase()
  return email.charAt(0).toUpperCase()
}

const getDisplayName = (): string =>
  props.collaboration.collaboratorName || props.collaboration.collaboratorEmail

const toggleRole = (): void => {
  const next: CollaborationRole = props.collaboration.role === 'viewer' ? 'editor' : 'viewer'
  emit('changeRole', next)
}
</script>

<template>
  <div class="collaborator-card">
    <div class="collaborator-avatar-wrap">
      <div class="collaborator-avatar">
        {{ getInitial(collaboration.collaboratorName, collaboration.collaboratorEmail) }}
      </div>
      <span v-if="isOnline" class="online-dot" title="Online now" />
    </div>

    <div class="collaborator-info">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-medium text-primary truncate">{{ getDisplayName() }}</span>
        <span
          class="status-pill text-xs"
          :class="{
            'status-pill-positive': collaboration.status === 'accepted',
            'status-pill-warning': collaboration.status === 'pending',
            'status-pill-negative': collaboration.status === 'declined',
          }"
        >
          {{ collaboration.status }}
        </span>
      </div>
      <p class="text-xs text-secondary truncate">{{ collaboration.collaboratorEmail }}</p>
    </div>

    <div class="collaborator-actions">
      <button
        v-tooltip.top="collaboration.role === 'viewer' ? 'Viewer — click to make Editor' : 'Editor — click to make Viewer'"
        class="role-badge"
        :class="{ 'role-badge-editor': collaboration.role === 'editor' }"
        @click="toggleRole"
      >
        <i :class="collaboration.role === 'editor' ? 'pi pi-pencil' : 'pi pi-eye'" class="text-xs" />
        {{ collaboration.role === 'editor' ? 'Editor' : 'Viewer' }}
      </button>
      <button
        v-tooltip.top="'Revoke access'"
        class="btn btn-danger btn-sm"
        @click="$emit('revoke')"
      >
        <i class="pi pi-times text-xs" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.collaborator-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 0.625rem;
}

.collaborator-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.online-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  background: var(--app-positive);
  border: 2px solid var(--app-surface);
}

.collaborator-avatar {
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
  border: 1px solid var(--app-accent-soft);
}

.collaborator-info {
  flex: 1;
  min-width: 0;
}

.collaborator-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.625rem;
  border-radius: 2rem;
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  background: var(--app-surface-hover);
  color: var(--app-text-secondary);
  border: 1px solid var(--app-border);
  transition: all 0.15s;
}

.role-badge:hover {
  border-color: var(--app-border-strong);
  color: var(--app-text);
}

.role-badge-editor {
  background: var(--app-accent-soft);
  color: var(--app-accent);
  border-color: rgba(var(--app-accent), 0.2);
}
</style>

<script setup lang="ts">
import type { ActivityEntry } from '@/models'

defineProps<{
  entries: ActivityEntry[]
  loading?: boolean
}>()

const getInitial = (name: string, email: string): string => {
  if (name) return name.charAt(0).toUpperCase()
  return email.charAt(0).toUpperCase()
}

const getDisplayName = (entry: ActivityEntry): string =>
  entry.actorName || entry.actorEmail

const formatAction = (entry: ActivityEntry): string => {
  const meta = entry.metadata
  switch (entry.action) {
    case 'joined':
      return `joined as ${(meta.role as string) ?? 'collaborator'}`
    case 'updated_inputs':
      return 'updated budget inputs'
    case 'saved_scenario':
      return meta.name ? `saved scenario "${meta.name as string}"` : 'saved a new scenario'
    case 'deleted_scenario':
      return meta.name ? `deleted scenario "${meta.name as string}"` : 'deleted a scenario'
    case 'loaded_scenario':
      return meta.name ? `loaded scenario "${meta.name as string}"` : 'loaded a scenario'
    case 'viewed_budget':
      return 'opened this budget'
    default:
      return entry.action.replace(/_/g, ' ')
  }
}

const formatTime = (iso: string): string => {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const getActionIcon = (action: string): string => {
  switch (action) {
    case 'joined': return 'pi-user-plus'
    case 'updated_inputs': return 'pi-pencil'
    case 'saved_scenario': return 'pi-bookmark'
    case 'deleted_scenario': return 'pi-trash'
    case 'loaded_scenario': return 'pi-arrow-right-arrow-left'
    case 'viewed_budget': return 'pi-eye'
    default: return 'pi-circle'
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-8">
      <i class="pi pi-spin pi-spinner text-secondary" />
    </div>

    <div v-else-if="!entries.length" class="flex flex-col items-center gap-2 py-8 text-secondary">
      <i class="pi pi-history text-xl" />
      <p class="text-sm">No activity yet</p>
    </div>

    <div v-else class="activity-feed">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="activity-entry"
      >
        <div class="activity-avatar">
          {{ getInitial(entry.actorName, entry.actorEmail) }}
        </div>
        <div class="activity-line" />
        <div class="activity-content">
          <div class="activity-body">
            <i :class="['pi', getActionIcon(entry.action), 'activity-icon']" />
            <span class="text-sm text-primary">
              <strong>{{ getDisplayName(entry) }}</strong>
              {{ formatAction(entry) }}
            </span>
          </div>
          <span class="activity-time">{{ formatTime(entry.createdAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity-feed {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.activity-entry {
  display: grid;
  grid-template-columns: 2rem 1px 1fr;
  gap: 0 0.75rem;
  align-items: start;
  position: relative;
  padding-bottom: 1rem;
}

.activity-entry:last-child {
  padding-bottom: 0;
}

.activity-entry:last-child .activity-line {
  display: none;
}

.activity-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--app-accent-soft);
  color: var(--app-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
  z-index: 1;
}

.activity-line {
  width: 1px;
  background: var(--app-border);
  align-self: stretch;
  margin-top: 2rem;
}

.activity-content {
  padding-top: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.activity-body {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.activity-icon {
  font-size: 0.7rem;
  color: var(--app-text-tertiary);
  flex-shrink: 0;
}

.activity-time {
  font-size: 0.7rem;
  color: var(--app-text-tertiary);
}
</style>

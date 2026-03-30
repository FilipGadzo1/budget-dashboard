<script setup lang="ts">
import type { SharedBudget } from '@/models'

defineProps<{
  budget: SharedBudget
  loading?: boolean
}>()

defineEmits<{
  accept: []
  decline: []
}>()

const getInitial = (name: string, email: string): string => {
  if (name) return name.charAt(0).toUpperCase()
  return email.charAt(0).toUpperCase()
}
</script>

<template>
  <div class="pending-card">
    <div class="pending-card-avatar">
      {{ getInitial(budget.ownerName, budget.ownerEmail) }}
    </div>

    <div class="pending-card-content">
      <div class="flex items-center gap-2 flex-wrap mb-0.5">
        <span class="text-sm font-medium text-primary">
          {{ budget.ownerName || budget.ownerEmail }}
        </span>
        <span class="status-pill status-pill-warning text-xs">
          {{ budget.status === 'pending' ? 'Pending' : budget.status }}
        </span>
      </div>
      <p class="text-xs text-secondary">
        Invited you as
        <span class="font-medium" :style="{ color: budget.role === 'editor' ? 'var(--app-accent)' : 'inherit' }">
          {{ budget.role }}
        </span>
        to their budget
      </p>
    </div>

    <div v-if="budget.status === 'pending'" class="pending-card-actions">
      <button
        class="btn btn-primary btn-sm"
        :disabled="loading"
        @click="$emit('accept')"
      >
        <i v-if="loading" class="pi pi-spin pi-spinner text-xs" />
        Accept
      </button>
      <button
        class="btn btn-secondary btn-sm"
        :disabled="loading"
        @click="$emit('decline')"
      >
        Decline
      </button>
    </div>

    <div v-else-if="budget.status === 'declined'" class="text-xs text-secondary">
      Declined
    </div>
  </div>
</template>

<style scoped>
.pending-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 0.625rem;
}

.pending-card-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: var(--app-warning-soft);
  color: var(--app-warning);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
  flex-shrink: 0;
  border: 1px solid var(--app-warning-border);
}

.pending-card-content {
  flex: 1;
  min-width: 0;
}

.pending-card-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
</style>

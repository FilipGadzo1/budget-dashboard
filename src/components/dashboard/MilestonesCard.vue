<script setup lang="ts">
defineProps<{
  firstNegativeMonthLabel: string | null
  highestBalanceMonthLabel: string | null
  savedScenariosCount: number
}>()
</script>

<template>
  <div class="card milestones-card">
    <p class="text-label mb-3">Milestones</p>
    <div class="milestones-list">

      <div class="milestone-row">
        <div class="milestone-icon milestone-icon-warning">
          <i class="pi pi-exclamation-triangle" />
        </div>
        <div class="milestone-content">
          <span class="milestone-label">First negative month</span>
          <span class="milestone-value" :class="firstNegativeMonthLabel ? 'text-negative' : 'text-positive'">
            {{ firstNegativeMonthLabel ?? 'Never' }}
          </span>
        </div>
      </div>

      <div class="milestone-divider" />

      <div class="milestone-row">
        <div class="milestone-icon milestone-icon-positive">
          <i class="pi pi-arrow-up" />
        </div>
        <div class="milestone-content">
          <span class="milestone-label">Peak balance month</span>
          <span class="milestone-value">{{ highestBalanceMonthLabel ?? 'N/A' }}</span>
        </div>
      </div>

      <div class="milestone-divider" />

      <div class="milestone-row">
        <div class="milestone-icon milestone-icon-accent">
          <i class="pi pi-bookmark" />
        </div>
        <div class="milestone-content">
          <span class="milestone-label">Saved scenarios</span>
          <span class="milestone-value">{{ savedScenariosCount }}</span>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.milestones-card {
  display: flex;
  flex-direction: column;
}

.milestones-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.milestone-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.milestone-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.milestone-icon-warning {
  background: rgba(245, 158, 11, 0.12);
  color: var(--app-warning, #f59e0b);
}

.milestone-icon-positive {
  background: var(--app-positive-soft, rgba(34, 197, 94, 0.1));
  color: var(--app-positive);
}

.milestone-icon-accent {
  background: var(--app-accent-soft);
  color: var(--app-accent);
}

.milestone-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
}

.milestone-label {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.milestone-value {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--app-text);
  font-family: 'DM Mono', monospace;
  white-space: nowrap;
  margin-left: 0.5rem;
}

.milestone-divider {
  height: 1px;
  background: var(--app-border);
  margin: 0;
}
</style>

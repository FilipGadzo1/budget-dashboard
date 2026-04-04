<script setup lang="ts">
import { computed } from 'vue'

import type { SavingsGoal } from '@/models'
import {
  computeIsOnTrack,
  computeMonthsRemaining,
  computeProgress,
  computeProjectedCompletion,
  computeRemaining,
  computeRequiredMonthly,
} from '@/services/savingsService'

const props = defineProps<{
  goal: SavingsGoal
  formatCurrency: (n: number) => string
  readonly?: boolean
}>()

defineEmits<{
  deposit: []
  edit: []
  delete: []
  'use-required': []
}>()

const progress = computed(() => computeProgress(props.goal))
const remaining = computed(() => computeRemaining(props.goal))
const monthsLeft = computed(() => computeMonthsRemaining(props.goal))
const isOnTrack = computed(() => computeIsOnTrack(props.goal))
const requiredMonthly = computed(() => computeRequiredMonthly(props.goal))
const projectedCompletionMonthKey = computed(() => computeProjectedCompletion(props.goal))

const projectedCompletionLabel = computed(() => {
  if (!projectedCompletionMonthKey.value) return null
  const [year, month] = projectedCompletionMonthKey.value.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})

const lateByMonths = computed(() => {
  if (isOnTrack.value !== false || !props.goal.targetDate || !projectedCompletionMonthKey.value) return null
  const [ty, tm] = props.goal.targetDate.slice(0, 7).split('-').map(Number)
  const [py, pm] = projectedCompletionMonthKey.value.split('-').map(Number)
  return (py - ty) * 12 + (pm - tm)
})

const statusLabel = computed(() => {
  if (props.goal.status === 'completed') return 'Completed'
  if (props.goal.status === 'paused') return 'Paused'
  return 'Active'
})

const statusClass = computed(() => {
  if (props.goal.status === 'paused') return 'status-pill-warning'
  return 'status-pill-positive'
})

const progressBarColor = computed(() =>
  props.goal.status === 'completed' ? 'var(--app-positive)' : 'var(--app-accent)',
)

const monthsLabel = computed(() => {
  if (monthsLeft.value === null) return null
  if (monthsLeft.value === 0) return 'Deadline passed'
  return `${monthsLeft.value} month${monthsLeft.value === 1 ? '' : 's'} left`
})

const targetDateLabel = computed(() => {
  if (!props.goal.targetDate) return null
  const d = new Date(props.goal.targetDate)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})
</script>

<template>
  <article class="card card-hover savings-card">
    <!-- Header row -->
    <div class="savings-card-header">
      <div class="savings-card-title-row">
        <span class="savings-card-emoji">{{ goal.emoji }}</span>
        <h3 class="savings-card-name">{{ goal.name }}</h3>
        <span :class="['status-pill', statusClass, 'savings-card-status']">{{ statusLabel }}</span>
      </div>
      <p v-if="goal.note" class="savings-card-note">{{ goal.note }}</p>
    </div>

    <!-- Progress -->
    <div class="savings-card-progress-section">
      <div class="savings-card-amounts">
        <span class="text-primary text-sm font-semibold tabular-nums">
          {{ formatCurrency(goal.currentAmount) }}
        </span>
        <span class="text-secondary text-xs tabular-nums">
          of {{ formatCurrency(goal.targetAmount) }}
        </span>
        <span class="text-secondary text-xs tabular-nums ml-auto">{{ progress }}%</span>
      </div>
      <div class="savings-progress-track">
        <div
          class="savings-progress-fill"
          :style="{ width: `${progress}%`, background: progressBarColor }"
        />
      </div>
    </div>

    <!-- Meta row -->
    <div class="savings-card-meta">
      <span v-if="goal.monthlyContribution > 0" class="savings-meta-chip">
        <i class="pi pi-arrow-up text-xs" />
        {{ formatCurrency(goal.monthlyContribution) }}/mo
      </span>
      <span v-if="targetDateLabel" class="savings-meta-chip">
        <i class="pi pi-calendar text-xs" />
        {{ targetDateLabel }}
      </span>
      <span v-if="monthsLabel" class="savings-meta-chip">
        <i class="pi pi-clock text-xs" />
        {{ monthsLabel }}
      </span>
      <span v-if="goal.status !== 'completed'" class="savings-meta-chip savings-meta-chip-remaining">
        {{ formatCurrency(remaining) }} to go
      </span>
      <!-- Projected completion -->
      <span
        v-if="projectedCompletionLabel && goal.status === 'active'"
        :class="['savings-meta-chip', isOnTrack === false ? 'savings-meta-chip-alert' : 'savings-meta-chip-positive']"
      >
        <i class="pi pi-flag text-xs" />
        {{ isOnTrack === false ? `Projected: ${projectedCompletionLabel}` : `On track: ${projectedCompletionLabel}` }}
      </span>
      <!-- Warning: won't hit target date -->
      <span v-if="isOnTrack === false && requiredMonthly !== null" class="savings-meta-chip savings-meta-chip-alert">
        <i class="pi pi-exclamation-triangle text-xs" />
        Needs {{ formatCurrency(requiredMonthly) }}/mo
        <span v-if="lateByMonths !== null">&nbsp;({{ lateByMonths }}mo late)</span>
      </span>
    </div>

    <!-- Actions -->
    <div class="savings-card-actions">
      <button
        v-if="goal.status !== 'completed' && !readonly"
        class="btn btn-primary btn-sm"
        @click="$emit('deposit')"
      >
        <i class="pi pi-plus" /> Deposit
      </button>
      <button
        v-if="isOnTrack === false && requiredMonthly !== null && !readonly"
        class="btn btn-secondary btn-sm"
        @click="$emit('use-required')"
      >
        Use required amount
      </button>
      <button
        v-if="!readonly"
        class="btn btn-secondary btn-sm"
        @click="$emit('edit')"
      >
        Edit
      </button>
      <button
        v-if="!readonly"
        class="btn btn-danger btn-sm"
        @click="$emit('delete')"
      >
        Delete
      </button>
      <button
        v-if="goal.status === 'completed' || readonly"
        class="btn btn-secondary btn-sm"
        @click="$emit('deposit')"
      >
        <i class="pi pi-history" /> History
      </button>
    </div>
  </article>
</template>

<style scoped>
.savings-card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.savings-card-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.savings-card-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.savings-card-emoji {
  font-size: 1.25rem;
  line-height: 1;
  flex-shrink: 0;
}

.savings-card-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--app-text);
  margin: 0;
  min-width: 0;
  flex: 1;
}

.savings-card-status {
  font-size: 0.6875rem;
  padding: 2px 8px;
  flex-shrink: 0;
}

.savings-card-note {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
  margin: 0;
  padding-left: 1.875rem;
}

.savings-card-progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.savings-card-amounts {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.savings-progress-track {
  height: 0.5rem;
  background: var(--app-border);
  border-radius: 100px;
  overflow: hidden;
}

.savings-progress-fill {
  height: 100%;
  border-radius: 100px;
  transition: width 0.4s ease;
  min-width: 2px;
}

.savings-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.savings-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
  background: var(--app-surface-hover);
  border: 1px solid var(--app-border);
  border-radius: 100px;
  padding: 0.1875rem 0.625rem;
}

.savings-meta-chip-remaining {
  color: var(--app-accent);
  background: var(--app-accent-soft);
  border-color: transparent;
}

.savings-meta-chip-alert {
  color: var(--app-warning, #f59e0b);
  background: rgba(245, 158, 11, 0.1);
  border-color: transparent;
}

.savings-meta-chip-positive {
  color: var(--app-positive);
  background: var(--app-positive-soft, rgba(34, 197, 94, 0.1));
  border-color: transparent;
}

.savings-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.125rem;
}

@media (max-width: 1023px) {
  /* Taller progress bar */
  .savings-progress-track {
    height: 12px;
  }

  /* Full-width action buttons */
  .savings-card-actions {
    flex-direction: column;
  }

  .savings-card-actions .btn {
    width: 100%;
    justify-content: center;
  }

  /* DM Mono for amounts */
  .savings-card-amounts {
    font-family: 'DM Mono', monospace;
  }
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Menu from 'primevue/menu'

import type { SavingsGoal } from '@/models'
import {
  computeIsOnTrack,
  computeProgress,
  computeProjectedCompletion,
  computeRequiredMonthly,
} from '@/services/savingsService'
import { formatShortMonthYear } from '@/utils/date'

// One goal as a single compact row: name, progress, monthly amount, one status
// chip, and one visible action. Everything else lives in the ⋯ menu or a tooltip.

const props = withDefaults(
  defineProps<{
    goal: SavingsGoal
    /** Exact amount in the goal's currency — used in tooltips. */
    formatCurrency: (n: number) => string
    /** Compact amount (€5.9K) in the goal's currency — what the row shows. */
    formatCompact: (n: number) => string
    locale: string
    readonly?: boolean
    canDelete?: boolean
  }>(),
  { canDelete: true },
)

const emit = defineEmits<{
  deposit: []
  edit: []
  delete: []
  'use-required': []
}>()

const progress = computed(() => computeProgress(props.goal))
const isOnTrack = computed(() => computeIsOnTrack(props.goal))
const requiredMonthly = computed(() => computeRequiredMonthly(props.goal))

const projected = computed(() => {
  const key = computeProjectedCompletion(props.goal)
  return key ? formatShortMonthYear(key, props.locale) : null
})

const targetDate = computed(() =>
  props.goal.targetDate ? formatShortMonthYear(props.goal.targetDate.slice(0, 7), props.locale) : null,
)

const canUseRequired = computed(
  () => !props.readonly && isOnTrack.value === false && requiredMonthly.value !== null,
)

// One chip says where the goal stands; the detail is in its tooltip.
const status = computed((): { label: string; tone: string; detail: string } => {
  const goal = props.goal
  if (goal.status === 'completed') {
    return { label: 'Completed', tone: 'status-pill-positive', detail: 'This goal has reached its target.' }
  }
  if (goal.status === 'paused') {
    return { label: 'Paused', tone: 'status-pill-warning', detail: 'Paused — nothing is being added each month.' }
  }
  if (isOnTrack.value === false) {
    const needs = requiredMonthly.value !== null ? ` Needs ${props.formatCurrency(requiredMonthly.value)} a month.` : ''
    return {
      label: projected.value ? `Behind · ${projected.value}` : 'Behind',
      tone: 'status-pill-negative',
      detail: projected.value
        ? `Reaches its target in ${projected.value}, after the ${targetDate.value} target date.${needs}`
        : `No monthly contribution is set, so it will miss the ${targetDate.value} target date.${needs}`,
    }
  }
  if (isOnTrack.value === true) {
    return {
      label: `On track · ${projected.value ?? targetDate.value}`,
      tone: 'status-pill-positive',
      detail: `On track for the ${targetDate.value} target date.`,
    }
  }
  return projected.value
    ? { label: `Done ${projected.value}`, tone: '', detail: `At this rate it reaches its target in ${projected.value}. No target date is set.` }
    : { label: 'Active', tone: '', detail: 'No monthly contribution or target date is set.' }
})

const amountsTitle = computed(
  () => `${props.formatCurrency(props.goal.currentAmount)} saved of ${props.formatCurrency(props.goal.targetAmount)} (${progress.value}%)`,
)

// ── ⋯ menu ───────────────────────────────────────────────────────────────────
const menu = ref<InstanceType<typeof Menu> | null>(null)

const menuItems = computed(() => [
  { label: 'Edit', icon: 'pi pi-pencil', command: () => emit('edit') },
  ...(canUseRequired.value
    ? [{
        label: `Use required amount (${props.formatCompact(requiredMonthly.value ?? 0)}/mo)`,
        icon: 'pi pi-bolt',
        command: () => emit('use-required'),
      }]
    : []),
  ...(props.canDelete
    ? [{ separator: true }, { label: 'Delete', icon: 'pi pi-trash', class: 'goal-menu-danger', command: () => emit('delete') }]
    : []),
])

const toggleMenu = (event: Event): void => menu.value?.toggle(event)

// A finished goal, or a view-only budget, can only look at the deposit history
const depositOnly = computed(() => props.goal.status === 'completed' || props.readonly)
</script>

<template>
  <article class="goal-row" :class="{ 'goal-row-muted': goal.status !== 'active' }">
    <div class="goal-name" :title="goal.note ? `${goal.name} — ${goal.note}` : goal.name">
      <span class="goal-emoji" aria-hidden="true">{{ goal.emoji }}</span>
      <h3 class="goal-title">{{ goal.name }}</h3>
    </div>

    <div class="goal-progress" :title="amountsTitle">
      <div
        class="goal-track"
        role="progressbar"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`${goal.name} progress`"
      >
        <div class="goal-fill" :style="{ width: `${progress}%` }" />
      </div>
      <p class="goal-amounts">
        <span class="goal-saved">{{ formatCompact(goal.currentAmount) }}</span>
        of {{ formatCompact(goal.targetAmount) }}
        <span class="goal-percent">{{ progress }}%</span>
      </p>
    </div>

    <div
      class="goal-monthly"
      :title="goal.monthlyContribution > 0 ? `${formatCurrency(goal.monthlyContribution)} moved to this goal each month` : 'No monthly contribution'"
    >
      <template v-if="goal.monthlyContribution > 0">{{ formatCompact(goal.monthlyContribution) }}<span class="goal-per">/mo</span></template>
      <template v-else>—</template>
    </div>

    <div class="goal-status">
      <span class="status-pill goal-pill" :class="status.tone" :title="status.detail">{{ status.label }}</span>
    </div>

    <div class="goal-actions">
      <button v-if="!depositOnly" class="btn btn-primary btn-sm" @click="$emit('deposit')">
        <i class="pi pi-plus" aria-hidden="true" /> Deposit
      </button>
      <button v-else class="btn btn-secondary btn-sm" @click="$emit('deposit')">
        <i class="pi pi-history" aria-hidden="true" /> History
      </button>
      <template v-if="!readonly">
        <button
          class="btn btn-ghost btn-icon goal-more"
          :aria-label="`More actions for ${goal.name}`"
          aria-haspopup="menu"
          title="More actions"
          @click="toggleMenu"
        >
          <i class="pi pi-ellipsis-h" aria-hidden="true" />
        </button>
        <Menu ref="menu" :model="menuItems" popup />
      </template>
    </div>
  </article>
</template>

<style scoped>
.goal-row {
  display: grid;
  /* Fixed tracks for the last three columns so every row lines up like a table */
  grid-template-columns: minmax(7rem, 1.2fr) minmax(7rem, 1.3fr) 4.75rem 9.5rem 8.5rem;
  grid-template-areas: 'name progress monthly status actions';
  align-items: center;
  gap: 0.875rem;
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid var(--app-border);
}

.goal-row:last-child {
  border-bottom: none;
}

/* ── Name ───────────────────────────────────────────────────── */
.goal-name {
  grid-area: name;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.goal-emoji {
  font-size: 1.0625rem;
  line-height: 1;
  flex-shrink: 0;
}

.goal-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goal-row-muted .goal-title {
  color: var(--app-text-secondary);
}

/* ── Progress ───────────────────────────────────────────────── */
.goal-progress {
  grid-area: progress;
  min-width: 0;
}

.goal-track {
  height: 6px;
  border-radius: 3px;
  background: var(--app-border);
  overflow: hidden;
}

.goal-fill {
  height: 100%;
  min-width: 2px;
  border-radius: 3px;
  background: var(--app-accent);
  transition: width 0.4s ease;
}

.goal-amounts {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  margin: 0.25rem 0 0;
  font-family: 'DM Mono', monospace;
  font-size: 0.71875rem;
  font-variant-numeric: tabular-nums;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.goal-saved {
  color: var(--app-text);
}

.goal-percent {
  margin-left: auto;
}

/* ── Monthly ────────────────────────────────────────────────── */
.goal-monthly {
  grid-area: monthly;
  text-align: right;
  font-family: 'DM Mono', monospace;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--app-text);
  white-space: nowrap;
}

.goal-per {
  color: var(--app-text-secondary);
  font-size: 0.71875rem;
}

/* ── Status ─────────────────────────────────────────────────── */
.goal-status {
  grid-area: status;
  min-width: 0;
}

.goal-pill {
  padding: 2px 9px;
  font-size: 0.6875rem;
  white-space: nowrap;
  cursor: help;
}

/* Neutral chip (no tone class): quiet surface */
.goal-pill:not(.status-pill-positive):not(.status-pill-negative):not(.status-pill-warning) {
  color: var(--app-text-secondary);
  background: var(--app-surface-hover);
}

/* ── Actions ────────────────────────────────────────────────── */
.goal-actions {
  grid-area: actions;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

.goal-more {
  color: var(--app-text-secondary);
}

/* ── Phone: three short lines per goal ──────────────────────── */
@media (max-width: 640px) {
  .goal-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'name status'
      'progress progress'
      'monthly actions';
    gap: 0.5rem 0.75rem;
    padding: 0.75rem 0.875rem;
  }

  .goal-monthly {
    text-align: left;
  }

  .goal-status {
    justify-self: end;
  }
}
</style>

<style>
/* The menu is teleported to <body>, so this cannot be scoped */
.goal-menu-danger .p-menu-item-label,
.goal-menu-danger .p-menu-item-icon {
  color: var(--app-negative) !important;
}
</style>

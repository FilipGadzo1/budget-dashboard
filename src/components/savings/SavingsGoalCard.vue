<script setup lang="ts">
import { computed, ref } from 'vue'

import Menu from 'primevue/menu'

import GoalRing from '@/components/shared/GoalRing.vue'
import type { SavingsGoal } from '@/models'
import {
  computeIsOnTrack,
  computeProjectedCompletion,
  computeRequiredMonthly,
} from '@/services/savingsService'
import { formatShortMonthYear } from '@/utils/date'

// One goal as a card: a progress ring, what is saved, one status chip, the
// monthly amount and one visible action. Everything else is in the ⋯ menu.
// `amount` is what the goal holds in the month the app is looking at, which is
// today's amount unless a month is picked in a chart.

const props = withDefaults(
  defineProps<{
    goal: SavingsGoal
    /** Saved amount to show, in the goal's currency. */
    amount: number
    /** Exact amount in the goal's currency. */
    formatCurrency: (n: number) => string
    /** Compact amount (€5.9K) in the goal's currency. */
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

const percent = computed(() => (props.goal.targetAmount > 0 ? Math.min(100, (props.amount / props.goal.targetAmount) * 100) : 0))
const reached = computed(() => props.goal.status === 'completed' || props.amount >= props.goal.targetAmount)
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
  if (reached.value) {
    return { label: 'Done', tone: 'status-pill-positive', detail: 'This goal has reached its target.' }
  }
  if (goal.status === 'paused') {
    return { label: 'Paused', tone: 'status-pill-warning', detail: 'Paused — nothing is being added each month.' }
  }
  if (isOnTrack.value === false) {
    const needs = requiredMonthly.value !== null ? ` Needs ${props.formatCurrency(requiredMonthly.value)} a month.` : ''
    return {
      label: projected.value ? `Behind, lands ${projected.value}` : 'Behind',
      tone: 'status-pill-negative',
      detail: projected.value
        ? `Reaches its target in ${projected.value}, after the ${targetDate.value} target date.${needs}`
        : `No monthly contribution is set, so it will miss the ${targetDate.value} target date.${needs}`,
    }
  }
  if (isOnTrack.value === true) {
    return {
      label: `On track, ${projected.value ?? targetDate.value}`,
      tone: 'status-pill-positive',
      detail: `On track for the ${targetDate.value} target date.`,
    }
  }
  return projected.value
    ? { label: `Lands ${projected.value}`, tone: '', detail: `At this rate it reaches its target in ${projected.value}. No target date is set.` }
    : { label: 'No monthly amount', tone: '', detail: 'No monthly contribution or target date is set.' }
})

// ── ⋯ menu ───────────────────────────────────────────────────────────────────
const menu = ref<InstanceType<typeof Menu> | null>(null)

const menuItems = computed(() => [
  ...(canUseRequired.value
    ? [{
        label: `Use required amount (${props.formatCompact(requiredMonthly.value ?? 0)}/mo)`,
        icon: 'pi pi-bolt',
        command: () => emit('use-required'),
      }]
    : []),
  ...(props.canDelete
    ? [...(canUseRequired.value ? [{ separator: true }] : []), { label: 'Delete', icon: 'pi pi-trash', class: 'goal-menu-danger', command: () => emit('delete') }]
    : []),
])

const toggleMenu = (event: Event): void => menu.value?.toggle(event)

// A finished goal, or a view-only budget, can only look at the deposit history
const depositOnly = computed(() => props.goal.status === 'completed' || props.readonly)
</script>

<template>
  <article class="card goal-card" :class="{ 'goal-card-muted': goal.status !== 'active' }">
    <div class="goal-top">
      <GoalRing :percent="percent" :size="68" :complete="reached" :label="`${goal.name} progress`" />
      <div class="goal-text">
        <h3 class="goal-title" :title="goal.note ? `${goal.name} — ${goal.note}` : goal.name">
          <span aria-hidden="true">{{ goal.emoji }}</span> {{ goal.name }}
        </h3>
        <p class="goal-amounts" :title="`${formatCurrency(amount)} saved of ${formatCurrency(goal.targetAmount)}`">
          <b>{{ formatCompact(amount) }}</b> of {{ formatCompact(goal.targetAmount) }}
        </p>
      </div>
      <template v-if="!readonly && menuItems.length > 0">
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

    <div class="goal-bottom">
      <span class="status-pill goal-pill" :class="status.tone" :title="status.detail">{{ status.label }}</span>
      <span
        class="goal-monthly"
        :title="goal.monthlyContribution > 0 ? `${formatCurrency(goal.monthlyContribution)} moved to this goal each month` : 'No monthly contribution'"
      >
        <template v-if="goal.monthlyContribution > 0">{{ formatCompact(goal.monthlyContribution) }}/mo</template>
      </span>
    </div>

    <div class="goal-actions">
      <button v-if="!depositOnly" class="btn btn-secondary btn-sm" @click="$emit('deposit')">
        <i class="pi pi-plus text-xs" aria-hidden="true" /> Deposit
      </button>
      <button v-else class="btn btn-ghost btn-sm" @click="$emit('deposit')">
        <i class="pi pi-history text-xs" aria-hidden="true" /> History
      </button>
      <button v-if="!readonly" class="btn btn-secondary btn-sm" :aria-label="`Edit ${goal.name}`" @click="$emit('edit')">
        <i class="pi pi-pencil text-xs" aria-hidden="true" /> Edit
      </button>
    </div>
  </article>
</template>

<style scoped>
.goal-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.125rem;
}

.goal-top {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.goal-text {
  flex: 1;
  min-width: 0;
}

.goal-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goal-card-muted .goal-title {
  color: var(--app-text-secondary);
}

.goal-amounts {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.goal-amounts b {
  font-weight: 600;
  color: var(--app-text);
}

.goal-more {
  flex: none;
  align-self: flex-start;
  width: 30px;
  height: 30px;
  color: var(--app-text-secondary);
}

.goal-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
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

.goal-monthly {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.goal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>

<style>
/* The menu is teleported to <body>, so this cannot be scoped */
.goal-menu-danger .p-menu-item-label,
.goal-menu-danger .p-menu-item-icon {
  color: var(--app-negative) !important;
}
</style>

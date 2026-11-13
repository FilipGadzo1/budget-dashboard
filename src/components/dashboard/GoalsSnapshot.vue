<script setup lang="ts">
import { computed } from 'vue'

import GoalRing from '@/components/shared/GoalRing.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useEffectiveProjection } from '@/composables/useEffectiveProjection'
import { computeIsOnTrack, computeProjectedCompletion } from '@/services/savingsService'
import { useSavingsStore } from '@/stores/savings'
import { formatShortMonthYear } from '@/utils/date'

// Every savings goal as a compact row with a progress ring, for the Overview.
// The list scrolls inside the card, so any number of goals fits. Amounts follow
// the month the app is looking at. Actions live on the Savings page.

const savingsStore = useSavingsStore()
const { formatMoney, formatCompactMoney, locale } = useCurrency()
const { goalAmountAt } = useEffectiveProjection()

const rows = computed(() =>
  savingsStore.sortedGoals.map((goal) => {
    const amount = goalAmountAt(goal)
    const complete = goal.status === 'completed' || amount >= goal.targetAmount
    const projected = computeProjectedCompletion(goal)
    const behind = !complete && computeIsOnTrack(goal) === false
    return {
      goal,
      complete,
      percent: goal.targetAmount > 0 ? Math.min(100, (amount / goal.targetAmount) * 100) : 0,
      amounts: `${formatCompactMoney(amount, goal.currency)} of ${formatCompactMoney(goal.targetAmount, goal.currency)}`,
      title: `${formatMoney(amount, goal.currency)} saved of ${formatMoney(goal.targetAmount, goal.currency)}`,
      status: complete ? 'Done' : goal.status === 'paused' ? 'Paused' : behind ? 'Behind' : projected ? formatShortMonthYear(projected, locale.value) : 'Open',
      tone: complete ? 'status-pill-positive' : behind ? 'status-pill-negative' : '',
    }
  }),
)
</script>

<template>
  <section class="card card-col goals-card" aria-labelledby="goals-snapshot-title">
    <div class="card-head">
      <h2 id="goals-snapshot-title" class="card-title">Savings goals</h2>
      <RouterLink to="/savings" class="goals-link">{{ rows.length }} goal{{ rows.length === 1 ? '' : 's' }}</RouterLink>
    </div>

    <ul v-if="rows.length" class="goals-list scroll-y grow">
      <li v-for="row in rows" :key="row.goal.id" class="goals-row" :title="row.title">
        <GoalRing :percent="row.percent" :size="40" :complete="row.complete" :label="`${row.goal.name} progress`" />
        <div class="goals-text">
          <p class="goals-name"><span aria-hidden="true">{{ row.goal.emoji }}</span> {{ row.goal.name }}</p>
          <p class="goals-amounts">{{ row.amounts }}</p>
        </div>
        <span class="status-pill goals-pill" :class="row.tone">{{ row.status }}</span>
      </li>
    </ul>
    <p v-else class="goals-empty">
      No goals yet. A goal sets money aside each month and shows when you will get there.
      <RouterLink to="/savings" class="goals-link">Create one</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.goals-link {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--app-text-secondary);
}

.goals-link:hover {
  color: var(--app-text);
  text-decoration: underline;
}

.goals-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin: 0;
  padding: 0 0.25rem 0 0;
  list-style: none;
}

.goals-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.goals-text {
  flex: 1;
  min-width: 0;
}

.goals-name {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 550;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goals-amounts {
  margin: 0;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.goals-pill {
  padding: 2px 9px;
  font-size: 0.6875rem;
  white-space: nowrap;
  flex: none;
}

.goals-pill:not(.status-pill-positive):not(.status-pill-negative) {
  color: var(--app-text-secondary);
  background: var(--app-surface-hover);
}

.goals-empty {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--app-text-secondary);
}
</style>

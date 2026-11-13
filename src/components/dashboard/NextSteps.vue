<script setup lang="ts">
// What deserves attention right now, as a short list: each row says what is
// going on and, where there is something to do about it, links to the place to
// do it. Replaces the old stack of coloured insight banners.

export interface NextStep {
  key: string
  tone: 'positive' | 'warning' | 'neutral'
  icon: string
  title: string
  body: string
  /** Where to act on it; a row without one is information only. */
  to?: string
  action?: string
}

withDefaults(
  defineProps<{
    steps: NextStep[]
    title?: string
    /** Smaller tiles and the link on the title line, for a short card. */
    compact?: boolean
  }>(),
  { title: 'Worth a look' },
)

// Tile hue per tone: green for good news, amber for something to fix
const hue = (tone: NextStep['tone']): number => (tone === 'warning' ? 38 : 158)
</script>

<template>
  <section class="card steps-card" :class="{ 'steps-compact': compact }" :aria-label="title">
    <h2 class="card-title">{{ title }}</h2>

    <ul class="steps-list scroll-y">
      <li v-for="step in steps" :key="step.key" class="step">
        <span
          class="tile"
          :class="{ 'tile-neutral': step.tone === 'neutral', 'tile-sm': compact }"
          :style="{ '--h': hue(step.tone) }"
          aria-hidden="true"
        >
          <i :class="step.icon" />
        </span>
        <div class="step-text">
          <p class="step-title">{{ step.title }}</p>
          <p class="step-body">{{ step.body }}</p>
          <RouterLink v-if="step.to" :to="step.to" class="step-link">
            {{ step.action ?? 'Open' }}
            <i class="pi pi-arrow-right" aria-hidden="true" />
          </RouterLink>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.steps-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.steps-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  display: flex;
  gap: 0.875rem;
}

.step-text {
  min-width: 0;
}

.step-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--app-text);
}

.step-body {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--app-text-secondary);
}

.step-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 550;
  color: var(--app-text);
}

.step-link .pi {
  font-size: 0.625rem;
  transition: transform 0.15s ease;
}

.step-link:hover {
  text-decoration: underline;
}

.step-link:hover .pi {
  transform: translateX(2px);
}

/* Compact: the action sits beside the title and the rows are closer */
.steps-compact {
  gap: 0.75rem;
}

.steps-compact .steps-list {
  gap: 0.75rem;
}

.steps-compact .step {
  gap: 0.625rem;
}

.steps-compact .step-text {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 0.75rem;
  flex: 1;
}

.steps-compact .step-body {
  grid-column: 1;
  margin-top: 0;
}

.steps-compact .step-link {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  margin-top: 0;
  white-space: nowrap;
}
</style>

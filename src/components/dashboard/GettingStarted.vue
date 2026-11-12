<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

// First-run guide: shown on the dashboard until the plan has income and expenses.
// Each step links to where it is done and ticks itself off from real data.

export interface SetupStep {
  key: string
  title: string
  description: string
  to: string
  done: boolean
  optional?: boolean
}

const props = defineProps<{
  steps: SetupStep[]
}>()

const required = computed(() => props.steps.filter((s) => !s.optional))
const doneCount = computed(() => required.value.filter((s) => s.done).length)
// The first step still to do gets the emphasis
const nextKey = computed(() => props.steps.find((s) => !s.done && !s.optional)?.key ?? null)
</script>

<template>
  <section class="card setup-card" aria-labelledby="setup-title">
    <div class="setup-header">
      <div>
        <h2 id="setup-title" class="setup-title">Set up your plan</h2>
        <p class="setup-subtitle">A few numbers are enough to see where your money is heading.</p>
      </div>
      <span class="setup-progress">{{ doneCount }} of {{ required.length }} done</span>
    </div>

    <ol class="setup-steps">
      <li v-for="(step, index) in steps" :key="step.key">
        <RouterLink
          :to="step.to"
          class="setup-step"
          :class="{ 'setup-step-done': step.done, 'setup-step-next': step.key === nextKey }"
        >
          <span class="setup-step-mark" aria-hidden="true">
            <i v-if="step.done" class="pi pi-check" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span class="setup-step-text">
            <span class="setup-step-title">
              {{ step.title }}
              <span v-if="step.optional" class="setup-step-optional">Optional</span>
              <span v-if="step.done" class="sr-only">(done)</span>
            </span>
            <span class="setup-step-desc">{{ step.description }}</span>
          </span>
          <i class="pi pi-chevron-right setup-step-arrow" aria-hidden="true" />
        </RouterLink>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.setup-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.setup-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.setup-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--app-text);
}

.setup-subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
}

.setup-progress {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.setup-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.setup-step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 100%;
  padding: 0.75rem 0.875rem;
  border: 1px solid var(--app-border);
  border-radius: 0.625rem;
  text-decoration: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.setup-step:hover {
  border-color: var(--app-border-strong);
  background: var(--app-surface-hover);
}

.setup-step-next {
  border-color: var(--app-accent);
  background: var(--app-accent-soft);
}

.setup-step-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  border-radius: 50%;
  border: 1px solid var(--app-border-strong);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--app-text-secondary);
}

.setup-step-next .setup-step-mark {
  border-color: var(--app-accent);
  color: var(--app-accent);
}

.setup-step-done .setup-step-mark {
  border-color: transparent;
  background: var(--app-accent);
  color: var(--app-accent-text);
}

.setup-step-mark .pi {
  font-size: 0.6875rem;
}

.setup-step-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.setup-step-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--app-text);
}

.setup-step-done .setup-step-title {
  color: var(--app-text-secondary);
}

.setup-step-optional {
  margin-left: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--app-text-tertiary);
}

.setup-step-desc {
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.setup-step-arrow {
  flex-shrink: 0;
  font-size: 0.6875rem;
  color: var(--app-text-tertiary);
}
</style>

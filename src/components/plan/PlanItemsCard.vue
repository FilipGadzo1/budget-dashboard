<script setup lang="ts">
import { computed } from 'vue'

import MoneyFlow from '@/components/shared/MoneyFlow.vue'
import { categoryStyle, INCOME_HUE } from '@/data/categories'
import type { BudgetItem } from '@/models'
import { describeSchedule, isActiveIn } from '@/services/itemsService'

// One side of the plan — income or expenses — as a list on the page. Editing
// still happens in ItemsDialog (it keeps a draft until Save); this card shows
// what is there and opens it. A budget without items shows a single amount
// field instead, supplied through the default slot.

const props = defineProps<{
  kind: 'income' | 'expense'
  items: BudgetItem[]
  /** Typical monthly total in the display currency. */
  total: number
  /** Display currency code. */
  currency: string
  /** Currency of items that have none of their own. */
  fallbackCurrency: string
  locale: string
  /** First month of the forecast: items not live in it are dimmed. */
  startMonth: string
  readonly?: boolean
  formatMoney: (value: number, currency?: string | null) => string
  toDisplay: (amount: number, from?: string | null) => number
}>()

defineEmits<{
  /** Open the editor on the existing items. */
  edit: []
  /** Open the editor with a new empty row. */
  add: []
}>()

const text = computed(() =>
  props.kind === 'income'
    ? { title: 'Income', add: 'Add source', itemize: 'Split into sources', hint: 'One amount for everything that comes in each month.' }
    : { title: 'Expenses', add: 'Add expense', itemize: 'Split into items', hint: 'One amount for everything you spend each month.' },
)

const currencyOf = (item: BudgetItem): string => item.currency ?? props.fallbackCurrency

const rows = computed(() =>
  props.items.map((item) => ({
    item,
    detail: [item.category, describeSchedule(item, props.locale)].filter(Boolean).join(' · '),
    active: isActiveIn(item, props.startMonth),
    foreign: currencyOf(item) !== props.currency,
    // Income rows share one tile; an expense takes its category's
    tile: props.kind === 'income'
      ? { icon: 'pi pi-arrow-down-left', hue: INCOME_HUE, known: true }
      : categoryStyle(item.category),
  })),
)
</script>

<template>
  <section class="card plan-items" :aria-labelledby="`plan-${kind}-title`">
    <header class="plan-items-head">
      <div class="plan-items-head-row">
        <h2 :id="`plan-${kind}-title`" class="plan-items-title">{{ text.title }}</h2>
        <button
          v-if="items.length && !readonly"
          class="btn btn-secondary btn-sm"
          :aria-label="`Edit ${text.title.toLowerCase()}`"
          @click="$emit('edit')"
        >
          <i class="pi pi-pencil text-xs" aria-hidden="true" /> Edit
        </button>
      </div>
      <p class="plan-items-total">
        <MoneyFlow :value="total" suffix="/mo" />
        <span v-if="items.length" class="plan-items-avg">average</span>
      </p>
    </header>

    <!-- Itemised: the list -->
    <template v-if="items.length">
      <ul class="plan-items-list">
        <li v-for="row in rows" :key="row.item.id" class="plan-item" :class="{ 'plan-item-inactive': !row.active }">
          <span
            class="tile"
            :class="{ 'tile-neutral': !row.tile.known }"
            :style="{ '--h': row.tile.hue }"
            aria-hidden="true"
          >
            <i :class="row.tile.icon" />
          </span>
          <span class="plan-item-text">
            <span class="plan-item-name">{{ row.item.name }}</span>
            <span v-if="row.detail || !row.active" class="plan-item-detail">
              {{ row.detail }}<template v-if="!row.active">{{ row.detail ? ' · ' : '' }}not active at the start</template>
            </span>
          </span>
          <span class="plan-item-amounts">
            <span class="plan-item-amount">{{ formatMoney(row.item.amount, currencyOf(row.item)) }}</span>
            <span v-if="row.foreign" class="plan-item-detail">≈ {{ formatMoney(toDisplay(row.item.amount, currencyOf(row.item))) }}</span>
          </span>
        </li>
      </ul>
      <button v-if="!readonly" class="plan-items-add" @click="$emit('add')">
        <span class="plan-items-add-icon" aria-hidden="true"><i class="pi pi-plus" /></span> {{ text.add }}
      </button>
    </template>

    <!-- Not itemised: one amount -->
    <div v-else class="plan-items-plain">
      <slot />
      <p class="plan-items-hint">{{ text.hint }}</p>
      <button v-if="!readonly" class="plan-items-add plan-items-add-inline" @click="$emit('add')">
        <i class="pi pi-list text-xs" aria-hidden="true" /> {{ text.itemize }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.plan-items {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  padding: 0;
}

.plan-items-head {
  padding: 1rem 1.25rem 1rem;
}

/* The title and Edit share a line; the total below can then use the full width
   and never pushes the button out of the card */
.plan-items-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.25rem;
}

.plan-items-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--app-text-secondary);
}

.plan-items-total {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 0.4rem;
  margin: 0.125rem 0 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.035em;
  color: var(--app-text);
}

.plan-items-avg {
  font-size: 0.75rem;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--app-text-secondary);
}

/* ── List ────────────────────────────────────────────────────── */
/* A long list scrolls here, not the page */
.plan-items-list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0 0.5rem;
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* No rules between rows: the tiles and the spacing separate them */
.plan-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-panel);
  transition: background 0.12s ease;
}

.plan-item:hover {
  background: var(--app-surface-hover);
}

.plan-item-text {
  flex: 1;
}

.plan-item-inactive {
  opacity: 0.55;
}

.plan-item-text,
.plan-item-amounts {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.plan-item-amounts {
  align-items: flex-end;
  flex-shrink: 0;
}

.plan-item-name {
  font-size: 0.875rem;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plan-item-detail {
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.plan-item-amount {
  font-size: 0.875rem;
  font-weight: 550;
  color: var(--app-text);
}

/* ── Add / itemise ───────────────────────────────────────────── */
.plan-items-add-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px dashed var(--app-border-strong);
  border-radius: 0.75rem;
  font-size: 0.75rem;
}

.plan-items-add {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin: 0.125rem 0.5rem 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-panel);
  border: none;
  background: none;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--app-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.plan-items-add:hover {
  background: var(--app-surface-hover);
  color: var(--app-text);
}

.plan-items-plain {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0 1.25rem 1.125rem;
}

.plan-items-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.plan-items-add-inline {
  align-self: flex-start;
  gap: 0.4rem;
  margin: 0.25rem 0 0 -0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-control);
  font-size: 0.8125rem;
}
</style>

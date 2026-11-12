<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

import CurrencyInput from '@/components/shared/CurrencyInput.vue'
import DialogHeader from '@/components/shared/DialogHeader.vue'
import { currencyOptions, expenseCategories } from '@/data/defaults'
import type { BudgetItem } from '@/models'
import {
  describeSchedule,
  FREQUENCY_OPTIONS,
  hasSchedule,
  isActiveIn,
  monthlyEquivalent,
} from '@/services/itemsService'

// One dialog for both income sources and expense items — they are the same kind
// of thing (a recurring amount); only the wording and the category field differ.

const props = withDefaults(
  defineProps<{
    visible: boolean
    modelValue: BudgetItem[]
    kind: 'income' | 'expense'
    initialMode?: 'view' | 'edit'
    /** Display currency: totals are shown in it and new items default to it. */
    currency: string
    locale: string
    /** Currency of items that have none of their own (the budget's base currency). */
    fallbackCurrency: string
    /** Converts an amount entered in `from` to the display currency. */
    toDisplay: (amount: number, from?: string) => number
    /** First month of the projection (YYYY-MM): anchors new non-monthly items. */
    startMonth: string
  }>(),
  { initialMode: 'view' },
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:modelValue': [items: BudgetItem[]]
}>()

const text = computed(() =>
  props.kind === 'income'
    ? {
        label: 'Monthly income',
        viewTitle: 'Income breakdown',
        editTitle: 'Edit income sources',
        add: 'Add source',
        placeholder: 'Source name',
      }
    : {
        label: 'Monthly expenses',
        viewTitle: 'Expense breakdown',
        editTitle: 'Edit expenses',
        add: 'Add item',
        placeholder: 'Expense name',
      },
)

const mode = ref<'view' | 'edit'>(props.initialMode)
const draft = ref<BudgetItem[]>([])
// Ids of rows whose schedule/category panel is open in edit mode
const expanded = ref<Set<string>>(new Set())

const currencyOf = (item: BudgetItem): string => item.currency ?? props.fallbackCurrency

const hasDetails = (item: BudgetItem): boolean => hasSchedule(item) || !!item.category

const loadDraft = (): void => {
  draft.value = props.modelValue.map((i) => ({ ...i, currency: currencyOf(i), everyMonths: i.everyMonths ?? 1 }))
  expanded.value = new Set(draft.value.filter(hasDetails).map((i) => i.id))
}

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      mode.value = props.initialMode
      loadDraft()
    }
  },
)

const fmt = (amount: number, currency: string = props.currency): string =>
  new Intl.NumberFormat(props.locale, { style: 'currency', currency }).format(amount)

// Typical month: every live item's monthly equivalent, in the display currency.
const typicalMonth = (items: BudgetItem[]): number =>
  items.reduce(
    (sum, i) =>
      isActiveIn(i, props.startMonth) ? sum + props.toDisplay(monthlyEquivalent(i), currencyOf(i)) : sum,
    0,
  )

const total = computed(() => typicalMonth(props.modelValue))
const draftTotal = computed(() => typicalMonth(draft.value))

const close = (): void => emit('update:visible', false)

const enterEdit = (): void => {
  loadDraft()
  mode.value = 'edit'
}

const cancelEdit = (): void => {
  if (props.modelValue.length === 0) {
    close()
    return
  }
  mode.value = 'view'
}

const save = (): void => {
  const items = draft.value
    .filter((i) => i.name.trim())
    .map((i) => ({
      ...i,
      name: i.name.trim(),
      everyMonths: i.everyMonths && i.everyMonths > 1 ? i.everyMonths : undefined,
      startMonth: i.startMonth || undefined,
      endMonth: i.endMonth || undefined,
      category: i.category?.trim() || undefined,
    }))
  emit('update:modelValue', items)
  if (items.length === 0) {
    close()
    return
  }
  mode.value = 'view'
}

const addItem = (): void => {
  draft.value.push({ id: crypto.randomUUID(), name: '', amount: 0, currency: props.currency, everyMonths: 1 })
}

const removeItem = (index: number): void => {
  draft.value.splice(index, 1)
}

const toggleDetails = (id: string): void => {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

// A yearly or quarterly item needs a month to land on; default to the first
// month of the projection so the choice does not move when the horizon does.
const onFrequencyChange = (item: BudgetItem): void => {
  if ((item.everyMonths ?? 1) > 1 && !item.startMonth) item.startMonth = props.startMonth
}

const endBeforeStart = (item: BudgetItem): boolean =>
  !!item.startMonth && !!item.endMonth && item.endMonth < item.startMonth

const hasInvalidDates = computed(() => draft.value.some(endBeforeStart))
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    dismissable-mask
    :draggable="false"
    :style="{ width: 'min(94vw, 38rem)', height: 'min(88vh, 38rem)' }"
    :pt="{
      root: { style: 'display: flex; flex-direction: column;' },
      content: { style: 'flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; padding-bottom: 0;' },
    }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <DialogHeader :label="text.label" :title="mode === 'edit' ? text.editTitle : text.viewTitle" />
    </template>

    <!-- View mode -->
    <div v-if="mode === 'view'" class="items-body">
      <div class="items-list">
        <div
          v-for="item in modelValue"
          :key="item.id"
          class="flex items-center justify-between gap-3 rounded-lg border border-app px-4 py-3"
          :class="{ 'items-inactive': !isActiveIn(item, startMonth) }"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm text-primary">{{ item.name }}</span>
            <span v-if="item.category || describeSchedule(item, locale)" class="block text-xs text-secondary">
              {{ [item.category, describeSchedule(item, locale)].filter(Boolean).join(' · ') }}
            </span>
          </span>
          <span class="shrink-0 text-right">
            <span class="block text-sm font-semibold tabular-nums text-primary">{{ fmt(item.amount, currencyOf(item)) }}</span>
            <span v-if="currencyOf(item) !== currency" class="block text-xs tabular-nums text-secondary">
              ≈ {{ fmt(toDisplay(item.amount, currencyOf(item))) }}
            </span>
          </span>
        </div>
      </div>
      <div class="items-total-row">
        <span class="text-sm font-medium text-secondary">Average per month in {{ currency }}</span>
        <span class="text-sm font-bold tabular-nums text-primary">{{ fmt(total) }}</span>
      </div>
    </div>

    <!-- Edit mode -->
    <div v-else class="items-body">
      <div class="items-toolbar">
        <button class="btn btn-ghost btn-sm" @click="addItem">
          <i class="pi pi-plus text-xs" /> {{ text.add }}
        </button>
      </div>

      <div class="items-list items-list-edit">
        <div v-for="(item, index) in draft" :key="item.id" class="item-row">
          <div class="flex items-center gap-2">
            <InputText
              v-model="draft[index].name"
              :placeholder="text.placeholder"
              class="min-w-0 flex-1"
              fluid
            />
            <div class="item-amount shrink-0">
              <CurrencyInput
                v-model="draft[index].amount"
                :currency="currencyOf(item)"
                :locale="locale"
              />
            </div>
            <select
              v-model="draft[index].currency"
              class="form-select item-currency shrink-0"
              aria-label="Currency"
            >
              <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">{{ opt.value }}</option>
            </select>
            <button
              class="btn btn-ghost btn-icon shrink-0"
              :class="hasDetails(item) ? 'item-details-on' : 'text-secondary'"
              :title="expanded.has(item.id) ? 'Hide schedule' : 'Schedule and category'"
              :aria-expanded="expanded.has(item.id)"
              @click="toggleDetails(item.id)"
            >
              <i class="pi pi-calendar text-xs" />
            </button>
            <button
              class="btn btn-ghost btn-icon shrink-0 text-secondary hover:text-negative"
              title="Remove"
              @click="removeItem(index)"
            >
              <i class="pi pi-times text-xs" />
            </button>
          </div>

          <div v-if="expanded.has(item.id)" class="item-details">
            <label v-if="kind === 'expense'" class="item-detail">
              <span class="item-detail-label">Category</span>
              <select v-model="draft[index].category" class="form-select">
                <option :value="undefined">None</option>
                <option v-for="category in expenseCategories" :key="category" :value="category">{{ category }}</option>
                <option
                  v-if="item.category && !expenseCategories.includes(item.category)"
                  :value="item.category"
                >
                  {{ item.category }}
                </option>
              </select>
            </label>
            <label class="item-detail">
              <span class="item-detail-label">Repeats</span>
              <select v-model="draft[index].everyMonths" class="form-select" @change="onFrequencyChange(item)">
                <option v-for="opt in FREQUENCY_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </label>
            <label class="item-detail">
              <span class="item-detail-label">{{ (item.everyMonths ?? 1) > 1 ? 'First month' : 'From' }}</span>
              <input v-model="draft[index].startMonth" type="month" class="form-select" />
            </label>
            <label class="item-detail">
              <span class="item-detail-label">Until</span>
              <input
                v-model="draft[index].endMonth"
                type="month"
                class="form-select"
                :class="{ 'item-invalid': endBeforeStart(item) }"
              />
            </label>
            <p v-if="endBeforeStart(item)" class="form-error item-details-error">
              "Until" is before the first month, so this item would never apply.
            </p>
          </div>
        </div>
      </div>

      <div v-if="draft.length" class="items-total-row">
        <span class="text-sm font-medium text-secondary">Average per month in {{ currency }}</span>
        <span class="text-sm font-bold tabular-nums text-primary">{{ fmt(draftTotal) }}</span>
      </div>
    </div>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <template v-if="mode === 'view'">
          <button class="btn btn-secondary" @click="close">Close</button>
          <button class="btn btn-primary" @click="enterEdit">
            <i class="pi pi-pencil text-xs" /> Edit
          </button>
        </template>
        <template v-else>
          <button class="btn btn-secondary" @click="cancelEdit">Cancel</button>
          <button class="btn btn-primary" :disabled="hasInvalidDates" @click="save">Save</button>
        </template>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.items-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.items-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 0.5rem;
  min-height: 0;
}

.items-list-edit {
  padding-right: 2px;
}

/* An item outside its start/end window in the first projection month */
.items-inactive {
  opacity: 0.55;
}

.items-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

.items-total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--app-border);
  padding-top: 0.75rem;
  margin-top: 0.75rem;
  flex-shrink: 0;
}

.item-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.item-amount {
  width: 8.5rem;
}

.item-currency {
  width: 4.75rem;
  padding-left: 0.5rem;
  padding-right: 0.25rem;
}

.item-details-on {
  color: var(--app-accent);
}

.item-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
  gap: 0.5rem;
  padding: 0.625rem;
  border: 1px solid var(--app-border);
  border-radius: 0.5rem;
  background: var(--app-surface-hover);
}

.item-detail {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.item-detail-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--app-text-secondary);
}

.item-detail .form-select {
  width: 100%;
  min-width: 0;
}

.item-invalid {
  border-color: var(--app-negative);
}

.item-details-error {
  grid-column: 1 / -1;
  margin: 0;
}

@media (max-width: 480px) {
  .item-amount {
    width: 6.25rem;
  }
}
</style>

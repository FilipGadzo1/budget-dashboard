<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

import CurrencyInput from '@/components/shared/CurrencyInput.vue'
import DialogHeader from '@/components/shared/DialogHeader.vue'
import { currencyOptions } from '@/data/defaults'
import type { IncomeItem } from '@/models'

const props = withDefaults(
  defineProps<{
    visible: boolean
    modelValue: IncomeItem[]
    initialMode?: 'view' | 'edit'
    /** Display currency: totals are shown in it and new items default to it. */
    currency: string
    locale: string
    /** Currency of items that have none of their own (the budget's base currency). */
    fallbackCurrency: string
    /** Converts an amount entered in `from` to the display currency. */
    toDisplay: (amount: number, from?: string) => number
  }>(),
  { initialMode: 'view' },
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:modelValue': [items: IncomeItem[]]
}>()

const mode = ref<'view' | 'edit'>(props.initialMode)
const draft = ref<IncomeItem[]>([])

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      mode.value = props.initialMode
      draft.value = withCurrency(props.modelValue)
    }
  },
)

const currencyOf = (item: { currency?: string }): string => item.currency ?? props.fallbackCurrency

const withCurrency = <T extends { currency?: string }>(items: T[]): T[] =>
  items.map((i) => ({ ...i, currency: currencyOf(i) }))

const fmt = (amount: number, currency: string = props.currency): string =>
  new Intl.NumberFormat(props.locale, { style: 'currency', currency }).format(amount)

const sumInDisplay = (items: Array<{ amount: number; currency?: string }>): number =>
  items.reduce((s, i) => s + props.toDisplay(i.amount, currencyOf(i)), 0)

const total = computed(() => sumInDisplay(props.modelValue))
const draftTotal = computed(() => sumInDisplay(draft.value))

const close = (): void => emit('update:visible', false)

const enterEdit = (): void => {
  draft.value = withCurrency(props.modelValue)
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
    .map((i) => ({ ...i, name: i.name.trim() }))
  emit('update:modelValue', items)
  if (items.length === 0) {
    close()
    return
  }
  mode.value = 'view'
}

const addItem = (): void => {
  draft.value.push({ id: crypto.randomUUID(), name: '', amount: 0, currency: props.currency })
}

const removeItem = (index: number): void => {
  draft.value.splice(index, 1)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    dismissable-mask
    :draggable="false"
    :style="{ width: 'min(94vw, 36rem)', height: 'min(85vh, 34rem)' }"
    :pt="{
      root: { style: 'display: flex; flex-direction: column;' },
      content: { style: 'flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; padding-bottom: 0;' },
    }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <DialogHeader
        label="Monthly income"
        :title="mode === 'edit' ? 'Edit income sources' : 'Income breakdown'"
      />
    </template>

    <!-- View mode -->
    <div v-if="mode === 'view'" class="inc-body">
      <div class="inc-scroll-list">
        <div
          v-for="item in modelValue"
          :key="item.id"
          class="flex items-center justify-between rounded-lg border border-app px-4 py-3"
        >
          <span class="text-sm text-secondary">{{ item.name }}</span>
          <span class="text-right">
            <span class="block text-sm font-semibold tabular-nums text-primary">{{ fmt(item.amount, currencyOf(item)) }}</span>
            <span v-if="currencyOf(item) !== currency" class="block text-xs tabular-nums text-secondary">
              ≈ {{ fmt(toDisplay(item.amount, currencyOf(item))) }}
            </span>
          </span>
        </div>
      </div>
      <div class="inc-total-row">
        <span class="text-sm font-medium text-secondary">Total in {{ currency }}</span>
        <span class="text-sm font-bold tabular-nums text-primary">{{ fmt(total) }}</span>
      </div>
    </div>

    <!-- Edit mode -->
    <div v-else class="inc-body">
      <div class="inc-edit-toolbar">
        <button class="btn btn-ghost btn-sm" @click="addItem">
          <i class="pi pi-plus text-xs" /> Add source
        </button>
      </div>

      <div class="inc-scroll-list inc-scroll-list-edit">
        <div
          v-for="(item, index) in draft"
          :key="item.id"
          class="flex items-center gap-2"
        >
          <InputText
            v-model="draft[index].name"
            placeholder="Source name"
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
          <button class="btn btn-ghost btn-icon shrink-0 text-secondary hover:text-negative" @click="removeItem(index)">
            <i class="pi pi-times text-xs" />
          </button>
        </div>
      </div>

      <div v-if="draft.length" class="inc-total-row">
        <span class="text-sm font-medium text-secondary">Total in {{ currency }}</span>
        <span class="text-sm font-bold tabular-nums text-primary">{{ fmt(draftTotal) }}</span>
      </div>
    </div>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <!-- View mode footer -->
        <template v-if="mode === 'view'">
          <button class="btn btn-secondary" @click="close">Close</button>
          <button class="btn btn-primary" @click="enterEdit">
            <i class="pi pi-pencil text-xs" /> Edit
          </button>
        </template>
        <!-- Edit mode footer -->
        <template v-else>
          <button class="btn btn-secondary" @click="cancelEdit">Cancel</button>
          <button class="btn btn-primary" @click="save">Save</button>
        </template>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.item-amount {
  width: 8.5rem;
}

.item-currency {
  width: 4.75rem;
  padding-left: 0.5rem;
  padding-right: 0.25rem;
}

@media (max-width: 480px) {
  .item-amount {
    width: 6.75rem;
  }
}

.inc-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.inc-scroll-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 0.5rem;
  min-height: 0;
}

.inc-scroll-list-edit {
  padding-right: 2px;
}

.inc-edit-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

.inc-total-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--app-border);
  padding-top: 0.75rem;
  margin-top: 0.75rem;
  flex-shrink: 0;
}
</style>

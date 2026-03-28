<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'

import DialogHeader from '@/components/shared/DialogHeader.vue'
import type { ExpenseItem } from '@/models'

const props = withDefaults(
  defineProps<{
    visible: boolean
    modelValue: ExpenseItem[]
    initialMode?: 'view' | 'edit'
    currency: string
    locale: string
  }>(),
  { initialMode: 'view' },
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:modelValue': [items: ExpenseItem[]]
}>()

const mode = ref<'view' | 'edit'>(props.initialMode)
const draft = ref<ExpenseItem[]>([])

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      mode.value = props.initialMode
      draft.value = props.modelValue.map((i) => ({ ...i }))
    }
  },
)

const fmt = (amount: number): string =>
  new Intl.NumberFormat(props.locale, { style: 'currency', currency: props.currency }).format(amount)

const total = computed(() => props.modelValue.reduce((s, i) => s + i.amount, 0))
const draftTotal = computed(() => draft.value.reduce((s, i) => s + i.amount, 0))

const close = (): void => emit('update:visible', false)

const enterEdit = (): void => {
  draft.value = props.modelValue.map((i) => ({ ...i }))
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
    .map((i, index) => ({ ...i, name: i.name.trim(), sortOrder: index }))
  emit('update:modelValue', items)
  if (items.length === 0) {
    close()
    return
  }
  mode.value = 'view'
}

const addItem = (): void => {
  draft.value.push({ id: crypto.randomUUID(), name: '', amount: 0, sortOrder: draft.value.length })
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
    :style="{ width: 'min(92vw, 32rem)' }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <DialogHeader
        label="Monthly expenses"
        :title="mode === 'edit' ? 'Edit expenses' : 'Expense breakdown'"
      />
    </template>

    <!-- View mode -->
    <template v-if="mode === 'view'">
      <div class="flex flex-col gap-2">
        <div
          v-for="item in modelValue"
          :key="item.id"
          class="flex items-center justify-between rounded-lg border border-app px-4 py-3"
        >
          <span class="text-sm text-secondary">{{ item.name }}</span>
          <span class="text-sm font-semibold tabular-nums text-primary">{{ fmt(item.amount) }}</span>
        </div>
      </div>
      <div class="mt-3 flex items-center justify-between border-t border-app pt-3">
        <span class="text-sm font-medium text-secondary">Total</span>
        <span class="text-sm font-bold tabular-nums text-primary">{{ fmt(total) }}</span>
      </div>
    </template>

    <!-- Edit mode -->
    <template v-else>
      <div class="flex flex-col gap-2">
        <div
          v-for="(item, index) in draft"
          :key="item.id"
          class="flex items-center gap-2"
        >
          <InputText
            v-model="draft[index].name"
            placeholder="Expense name"
            class="min-w-0 flex-1"
          />
          <InputNumber
            v-model="draft[index].amount"
            mode="currency"
            :currency="currency"
            :locale="locale"
            :min="0"
            :use-grouping="true"
            class="w-36 flex-shrink-0"
          />
          <button class="btn btn-ghost btn-icon flex-shrink-0 text-secondary hover:text-negative" @click="removeItem(index)">
            <i class="pi pi-times text-xs" />
          </button>
        </div>
      </div>

      <button class="btn btn-ghost btn-sm mt-3 w-full" @click="addItem">
        <i class="pi pi-plus text-xs" /> Add item
      </button>

      <div v-if="draft.length" class="mt-3 flex items-center justify-between border-t border-app pt-3">
        <span class="text-sm font-medium text-secondary">Total</span>
        <span class="text-sm font-bold tabular-nums text-primary">{{ fmt(draftTotal) }}</span>
      </div>
    </template>

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

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import DialogHeader from './DialogHeader.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    message?: string
    confirmLabel?: string
  }>(),
  {
    title: 'Delete item',
    message: 'This action cannot be undone.',
    confirmLabel: 'Delete',
  },
)

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
}>()

const close = (): void => emit('update:visible', false)
const confirm = (): void => { emit('confirm'); close() }
</script>

<template>
  <Dialog
    :visible="props.visible"
    modal
    dismissable-mask
    :draggable="false"
    :style="{ width: 'min(92vw, 28rem)' }"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <DialogHeader label="Confirm action" :title="title" />
    </template>

    <p class="text-sm leading-6 text-secondary">{{ message }}</p>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button class="btn btn-secondary" @click="close">Cancel</button>
        <button class="btn btn-danger" @click="confirm">{{ confirmLabel }}</button>
      </div>
    </template>
  </Dialog>
</template>

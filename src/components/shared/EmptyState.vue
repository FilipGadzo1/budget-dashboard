<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description: string
    icon?: string
    actionLabel?: string
  }>(),
  {
    icon: 'pi pi-inbox',
    actionLabel: '',
  },
)

defineEmits<{ action: [] }>()
</script>

<template>
  <section class="card flex flex-col items-center justify-center px-6 py-14 text-center">
    <div class="flex h-14 w-14 items-center justify-center rounded-xl text-xl" style="background: var(--app-accent-soft); color: var(--app-accent);">
      <i :class="icon" />
    </div>
    <h3 class="mt-4 text-lg font-semibold text-primary">{{ title }}</h3>
    <p class="mt-1.5 max-w-md text-sm leading-6 text-secondary">{{ description }}</p>
    <button v-if="actionLabel" class="btn btn-primary mt-5" @click="$emit('action')">
      {{ actionLabel }}
    </button>
  </section>
</template>

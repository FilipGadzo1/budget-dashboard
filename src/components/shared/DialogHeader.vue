<script setup lang="ts">
defineProps<{
  label: string
  title: string
}>()
</script>

<template>
  <div>
    <p class="text-label">{{ label }}</p>
    <h3 class="mt-1 text-lg font-semibold text-primary">{{ title }}</h3>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string
  tone: 'neutral' | 'success' | 'error'
}>()
</script>

<template>
  <p
    v-if="message"
    class="text-sm"
    :class="{
      'text-positive': tone === 'success',
      'text-negative': tone === 'error',
      'text-secondary': tone === 'neutral',
    }"
  >
    {{ message }}
  </p>
</template>

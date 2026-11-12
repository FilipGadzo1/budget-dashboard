<script setup lang="ts">
import { useId } from 'vue'

// The app mark: a forecast line that dips, then climbs to a dot — the projection
// itself. Keep public/favicon.svg in sync with this drawing.

withDefaults(defineProps<{ size?: number }>(), { size: 36 })

// Gradient ids must be unique per instance or two logos on one page share (and
// can lose) the same paint server.
const gradientId = `logo-${useId()}`
</script>

<template>
  <svg
    class="app-logo"
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    role="img"
    aria-label="Budget Dashboard"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#059669" />
        <stop offset="1" stop-color="#34d399" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="8" :fill="`url(#${gradientId})`" />
    <path
      d="M7 20.5l5.5-5 4.5 3.5 7-8.5"
      fill="none"
      stroke="#fff"
      stroke-width="2.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle cx="24" cy="10.5" r="2.6" fill="#fff" />
  </svg>
</template>

<style scoped>
.app-logo {
  display: block;
  flex-shrink: 0;
}
</style>

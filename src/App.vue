<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAuth } from '@/composables/useAuth'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'

const { user, loading, initialize: initAuth } = useAuth()
const uiStore = useUiStore()
const projectionStore = useProjectionStore()
const router = useRouter()

const hydrateStores = async (): Promise<void> => {
  await Promise.all([uiStore.hydrate(), projectionStore.hydrate()])
}

watch(user, (u, oldU) => {
  if (u) {
    void hydrateStores()
  } else if (oldU && !u) {
    void router.push({ name: 'login' })
  }
})

onMounted(async () => {
  await initAuth()
  uiStore.initialize()
  if (user.value) {
    await hydrateStores()
  }
})
</script>

<template>
  <div v-if="loading" class="app-loading">
    <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; color: var(--app-accent);" />
  </div>
  <RouterView v-else />
</template>

<style scoped>
.app-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg);
}
</style>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAuth } from '@/composables/useAuth'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'
import { useSavingsStore } from '@/stores/savings'
import { useUiStore } from '@/stores/ui'

const { user, loading, initialize: initAuth } = useAuth()
const uiStore = useUiStore()
const projectionStore = useProjectionStore()
const savingsStore = useSavingsStore()
const collabStore = useCollaborationStore()
const router = useRouter()

const hydrateStores = async (): Promise<void> => {
  await Promise.all([uiStore.hydrate(), projectionStore.hydrate(), savingsStore.hydrate()])
  // Load collaboration data after core stores are ready
  void collabStore.hydrate()
}

watch(user, (u, prev) => {
  if (u && !prev) {
    // New login — hydrate from DB
    void hydrateStores()
  } else if (!u && prev) {
    // Logout — clear store state immediately
    uiStore.reset()
    projectionStore.resetStore()
    savingsStore.resetStore()
    collabStore.reset()
    void router.push({ name: 'login' })
  }
})

onMounted(async () => {
  uiStore.initialize()
  await initAuth()
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
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg);
}
</style>

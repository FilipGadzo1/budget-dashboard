<script setup lang="ts">
import { usePrimeVue } from 'primevue/config'
import Toast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAuth } from '@/composables/useAuth'
import { useExchangeRates } from '@/composables/useExchangeRates'
import { lastSaveError } from '@/lib/notify'
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
const toast = useToast()
const primevue = usePrimeVue()

// Calendars start the week on Monday, except for the US locale (Sunday)
watch(
  () => uiStore.locale,
  (locale) => {
    if (primevue.config.locale) primevue.config.locale.firstDayOfWeek = locale === 'en-US' ? 0 : 1
  },
  { immediate: true },
)
const { fetchRates } = useExchangeRates()

// Failed writes are reported by the service layer; show them instead of failing silently.
watch(lastSaveError, (err) => {
  if (!err) return
  toast.add({ severity: 'error', summary: 'Not saved', detail: err.message, life: 8000 })
})

const hydrateStores = async (): Promise<void> => {
  // Rates are needed to combine amounts entered in different currencies.
  void fetchRates()
  await Promise.all([uiStore.hydrate(), projectionStore.hydrate(), savingsStore.hydrate()])
  projectionStore.ensureCurrency(uiStore.currencyCode)
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
  <Toast position="top-right" />
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

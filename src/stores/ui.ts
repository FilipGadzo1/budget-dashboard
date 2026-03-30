import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { useAuth } from '@/composables/useAuth'
import { mockUiState } from '@/data/mockData'
import type { ThemeMode, UiStateSnapshot } from '@/models'
import { fetchProfile, saveProfile } from '@/services/database'

let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useUiStore = defineStore('ui', () => {
  const snapshot = ref<UiStateSnapshot>({ ...mockUiState })
  const isReady = ref(false)

  const selectedMonth = computed(() => snapshot.value.selectedMonth)
  const themeMode = computed(() => snapshot.value.themeMode)
  const currencyCode = computed(() => snapshot.value.currencyCode)
  const locale = computed(() => snapshot.value.locale)

  const debouncedSave = (): void => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const { user } = useAuth()
      if (user.value) {
        void saveProfile(user.value.id, snapshot.value)
      }
    }, 500)
  }

  watch(snapshot, () => {
    if (isReady.value) debouncedSave()
  }, { deep: true })

  const applyTheme = (mode: ThemeMode): void => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const isDark = mode === 'dark'
    root.classList.toggle('dark', isDark)
    root.classList.toggle('app-dark', isDark)
  }

  const setSelectedMonth = (month: string): void => {
    snapshot.value = { ...snapshot.value, selectedMonth: month }
  }

  const hydrate = async (): Promise<void> => {
    const { user } = useAuth()
    if (!user.value) return

    const profile = await fetchProfile(user.value.id)
    if (profile) {
      snapshot.value = { ...profile }
    }
    applyTheme(snapshot.value.themeMode)
    isReady.value = true
  }

  const initialize = (): void => {
    applyTheme(snapshot.value.themeMode)
  }

  const reset = (): void => {
    clearTimeout(saveTimer)
    isReady.value = false
    snapshot.value = { ...mockUiState }
    applyTheme(mockUiState.themeMode)
  }

  const setThemeMode = (mode: ThemeMode): void => {
    snapshot.value = { ...snapshot.value, themeMode: mode }
    applyTheme(mode)
  }

  const toggleTheme = (): void => {
    setThemeMode(snapshot.value.themeMode === 'dark' ? 'light' : 'dark')
  }

  const setPreferences = (preferences: Pick<UiStateSnapshot, 'currencyCode' | 'locale'>): void => {
    snapshot.value = { ...snapshot.value, ...preferences }
  }

  const clearAllData = async (): Promise<void> => {
    clearTimeout(saveTimer)
    snapshot.value = { ...mockUiState }
    applyTheme(snapshot.value.themeMode)
    const { user } = useAuth()
    if (user.value) await saveProfile(user.value.id, snapshot.value)
  }

  return {
    isReady,
    selectedMonth,
    themeMode,
    currencyCode,
    locale,
    initialize,
    hydrate,
    reset,
    setSelectedMonth,
    setThemeMode,
    toggleTheme,
    setPreferences,
    clearAllData,
  }
})

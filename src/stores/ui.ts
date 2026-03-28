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

  watch(snapshot, () => debouncedSave(), { deep: true })

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
    if (isReady.value) return
    applyTheme(snapshot.value.themeMode)
    isReady.value = true
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

  const clearAllData = (): void => {
    snapshot.value = { ...mockUiState }
    applyTheme(snapshot.value.themeMode)
  }

  return {
    isReady,
    selectedMonth,
    themeMode,
    currencyCode,
    locale,
    initialize,
    hydrate,
    setSelectedMonth,
    setThemeMode,
    toggleTheme,
    setPreferences,
    clearAllData,
  }
})

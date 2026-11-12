import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { useAuth } from '@/composables/useAuth'
import { defaultUiState } from '@/data/defaults'
import type { ThemeMode, UiStateSnapshot } from '@/models'
import { fetchProfile, saveProfile } from '@/services/database'

let saveTimer: ReturnType<typeof setTimeout> | undefined

export const useUiStore = defineStore('ui', () => {
  const snapshot = ref<UiStateSnapshot>({ ...defaultUiState })
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

  // The device's own preference, kept live so 'system' follows it as it changes
  const systemQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
  const systemPrefersDark = ref(systemQuery?.matches ?? false)

  const resolveDark = (mode: ThemeMode): boolean =>
    mode === 'dark' || (mode === 'system' && systemPrefersDark.value)

  /** True when the dark theme is the one actually showing. */
  const isDark = computed(() => resolveDark(snapshot.value.themeMode))

  const applyTheme = (mode: ThemeMode): void => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const dark = resolveDark(mode)
    root.classList.toggle('dark', dark)
    root.classList.toggle('app-dark', dark)
  }

  systemQuery?.addEventListener?.('change', (event) => {
    systemPrefersDark.value = event.matches
    if (snapshot.value.themeMode === 'system') applyTheme('system')
  })

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
    snapshot.value = { ...defaultUiState }
    applyTheme(defaultUiState.themeMode)
  }

  const setThemeMode = (mode: ThemeMode): void => {
    snapshot.value = { ...snapshot.value, themeMode: mode }
    applyTheme(mode)
  }

  const toggleTheme = (): void => {
    setThemeMode(isDark.value ? 'light' : 'dark')
  }

  const setPreferences = (preferences: Pick<UiStateSnapshot, 'currencyCode' | 'locale'>): void => {
    snapshot.value = { ...snapshot.value, ...preferences }
  }

  const clearAllData = async (): Promise<void> => {
    clearTimeout(saveTimer)
    snapshot.value = { ...defaultUiState }
    applyTheme(snapshot.value.themeMode)
    const { user } = useAuth()
    if (user.value) await saveProfile(user.value.id, snapshot.value)
  }

  return {
    isReady,
    selectedMonth,
    themeMode,
    isDark,
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

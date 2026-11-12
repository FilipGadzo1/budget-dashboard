// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useUiStore } from './ui'

describe('ui store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    setActivePinia(createPinia())
  })

  it('initializes theme state, toggles theme, and updates the selected month', () => {
    const uiStore = useUiStore()

    uiStore.initialize()
    expect(uiStore.themeMode).toBe('dark')
    expect(document.documentElement.classList.contains('app-dark')).toBe(true)

    uiStore.toggleTheme()
    expect(uiStore.themeMode).toBe('light')
    expect(document.documentElement.classList.contains('app-dark')).toBe(false)

    uiStore.setSelectedMonth('2026-09')
    expect(uiStore.selectedMonth).toBe('2026-09')
  })

  it('follows the device preference when the theme is set to system', () => {
    const listeners: Array<(event: { matches: boolean }) => void> = []
    const media = { matches: true, addEventListener: (_: string, fn: (event: { matches: boolean }) => void) => listeners.push(fn) }
    vi.stubGlobal('matchMedia', () => media)
    setActivePinia(createPinia())
    const uiStore = useUiStore()

    uiStore.setThemeMode('system')
    expect(uiStore.themeMode).toBe('system')
    expect(uiStore.isDark).toBe(true)
    expect(document.documentElement.classList.contains('app-dark')).toBe(true)

    // The device switches to light while the app is open
    listeners.forEach((fn) => fn({ matches: false }))
    expect(uiStore.isDark).toBe(false)
    expect(document.documentElement.classList.contains('app-dark')).toBe(false)

    // An explicit choice ignores the device
    uiStore.setThemeMode('dark')
    expect(uiStore.isDark).toBe(true)

    vi.unstubAllGlobals()
  })
})

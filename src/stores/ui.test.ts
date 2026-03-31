// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useUiStore } from './ui'

describe('ui store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    setActivePinia(createPinia())
  })

  it('initializes theme state, cycles through all three themes, and updates the selected month', () => {
    const uiStore = useUiStore()

    uiStore.initialize()
    expect(uiStore.themeMode).toBe('dark')
    expect(document.documentElement.classList.contains('app-dark')).toBe(true)
    expect(document.documentElement.classList.contains('app-unicorn')).toBe(false)

    // dark → unicorn
    uiStore.toggleTheme()
    expect(uiStore.themeMode).toBe('unicorn')
    expect(document.documentElement.classList.contains('app-dark')).toBe(false)
    expect(document.documentElement.classList.contains('app-unicorn')).toBe(true)

    // unicorn → light
    uiStore.toggleTheme()
    expect(uiStore.themeMode).toBe('light')
    expect(document.documentElement.classList.contains('app-unicorn')).toBe(false)

    // light → dark
    uiStore.toggleTheme()
    expect(uiStore.themeMode).toBe('dark')
    expect(document.documentElement.classList.contains('app-dark')).toBe(true)

    uiStore.setSelectedMonth('2026-09')
    expect(uiStore.selectedMonth).toBe('2026-09')
  })
})

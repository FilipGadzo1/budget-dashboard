// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useUiStore } from '@/stores/ui'

import { useCurrency } from './useCurrency'

describe('useCurrency', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setActivePinia(createPinia())
  })

  it('reads and applies store-backed currency and locale preferences', () => {
    const uiStore = useUiStore()
    uiStore.setPreferences({
      currencyCode: 'USD',
      locale: 'en-US',
    })

    const { currencyCode, locale, formatCurrency, formatCompactCurrency } = useCurrency()

    expect(currencyCode.value).toBe('USD')
    expect(locale.value).toBe('en-US')
    expect(formatCurrency(1234.56)).toContain('$')
    expect(formatCompactCurrency(1200)).toContain('$')
  })
})

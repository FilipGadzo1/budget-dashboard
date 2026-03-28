import { computed } from 'vue'

import { useUiStore } from '@/stores/ui'

export const useCurrency = () => {
  const uiStore = useUiStore()
  const currencyCode = computed(() => uiStore.currencyCode)
  const locale = computed(() => uiStore.locale)

  const formatCurrency = (value: number): string =>
    new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: currencyCode.value,
      maximumFractionDigits: 2,
    }).format(value)

  const formatCompactCurrency = (value: number): string =>
    new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: currencyCode.value,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)

  return {
    currencyCode,
    locale,
    formatCurrency,
    formatCompactCurrency,
  }
}

import { computed } from 'vue'

import { useCollaborationStore } from '@/stores/collaboration'
import { useUiStore } from '@/stores/ui'

export const useCurrency = () => {
  const uiStore = useUiStore()
  const collabStore = useCollaborationStore()

  // When viewing someone else's budget, use their currency/locale/month so the
  // projection is shown exactly as the owner configured it.
  const currencyCode = computed(
    () => collabStore.activeBudgetContext?.ownerCurrencyCode ?? uiStore.currencyCode,
  )
  const locale = computed(
    () => collabStore.activeBudgetContext?.ownerLocale ?? uiStore.locale,
  )
  const selectedMonth = computed(
    () => collabStore.activeBudgetContext?.ownerSelectedMonth ?? uiStore.selectedMonth,
  )

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
    selectedMonth,
    formatCurrency,
    formatCompactCurrency,
  }
}

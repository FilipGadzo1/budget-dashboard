import { computed } from 'vue'

import { useExchangeRates } from '@/composables/useExchangeRates'
import { useCollaborationStore } from '@/stores/collaboration'
import { useUiStore } from '@/stores/ui'

export const useCurrency = () => {
  const uiStore = useUiStore()
  const collabStore = useCollaborationStore()
  const { convert, canConvert } = useExchangeRates()

  // When viewing someone else's budget, use their currency/locale/month so the
  // projection is shown exactly as the owner configured it.
  // `currencyCode` is the DISPLAY currency: stored amounts keep the currency they
  // were entered in and are converted to this one on the way to the screen.
  const currencyCode = computed(
    () => collabStore.activeBudgetContext?.ownerCurrencyCode ?? uiStore.currencyCode,
  )
  const locale = computed(
    () => collabStore.activeBudgetContext?.ownerLocale ?? uiStore.locale,
  )
  const selectedMonth = computed(
    () => collabStore.activeBudgetContext?.ownerSelectedMonth ?? uiStore.selectedMonth,
  )

  /** Formats `value` in the given currency (default: the display currency). */
  const formatMoney = (value: number, currency?: string | null): string =>
    new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: currency || currencyCode.value,
      maximumFractionDigits: 2,
    }).format(value)

  const formatCurrency = (value: number): string => formatMoney(value)

  /** Compact form (€5.9K) in the given currency (default: the display currency). */
  const formatCompactMoney = (value: number, currency?: string | null): string =>
    new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: currency || currencyCode.value,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)

  const formatCompactCurrency = (value: number): string => formatCompactMoney(value)

  /** Converts an amount entered in `from` (default: display currency) to the display currency. */
  const toDisplay = (amount: number, from?: string | null): number =>
    convert(amount, from || currencyCode.value, currencyCode.value)

  /** False when `from` cannot be converted to the display currency (rates missing). */
  const canShow = (from?: string | null): boolean =>
    canConvert(from || currencyCode.value, currencyCode.value)

  return {
    currencyCode,
    locale,
    selectedMonth,
    formatMoney,
    formatCurrency,
    formatCompactCurrency,
    formatCompactMoney,
    toDisplay,
    canShow,
    convert,
  }
}

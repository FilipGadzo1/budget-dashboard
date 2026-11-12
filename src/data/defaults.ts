import type { ProjectionInputs, UiStateSnapshot } from '@/models'

const now = new Date()
const currentMonth = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`

export const DEFAULT_CURRENCY_CODE = 'EUR'
export const DEFAULT_LOCALE = 'en-US'

// Single source for the currencies and locales the app offers.
export const currencyOptions = [
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'SEK', label: 'Swedish Krona (SEK)' },
  { value: 'AED', label: 'UAE Dirham (AED)' },
]

export const localeOptions = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-IE', label: 'English (Ireland)' },
  { value: 'sv-SE', label: 'Swedish (Sweden)' },
  { value: 'hr-HR', label: 'Croatian (Croatia)' },
]

// Suggested expense categories. An item's category is free text in the database,
// so this list can change without a migration.
export const expenseCategories = [
  'Housing',
  'Utilities',
  'Food',
  'Transport',
  'Insurance',
  'Health',
  'Debt',
  'Kids',
  'Subscriptions',
  'Entertainment',
  'Other',
]

// State used before a user's data has loaded, and after a reset.
export const defaultProjectionInputs: ProjectionInputs = {
  monthlyIncome: 0,
  monthlyExpenses: 0,
  months: 12,
  incomeItems: [],
  expenseItems: [],
  monthlyAdjustments: [],
}

export const defaultUiState: UiStateSnapshot = {
  selectedMonth: currentMonth,
  themeMode: 'dark',
  currencyCode: DEFAULT_CURRENCY_CODE,
  locale: DEFAULT_LOCALE,
}

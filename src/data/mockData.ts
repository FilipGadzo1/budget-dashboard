import type { ProjectionInputs, ProjectionStateSnapshot, UiStateSnapshot } from '@/models'

const now = new Date()
const currentMonth = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`

export const mockProjectionInputs: ProjectionInputs = {
  monthlyIncome: 4200,
  monthlyExpenses: 2850,
  months: 12,
  expenseItems: [],
}

export const mockProjectionState: ProjectionStateSnapshot = {
  inputs: mockProjectionInputs,
  savedScenarios: [],
  activeScenarioId: null,
}

export const mockUiState: UiStateSnapshot = {
  selectedMonth: currentMonth,
  themeMode: 'dark',
  currencyCode: 'SEK',
  locale: 'sv-SE',
}

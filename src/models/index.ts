export type ThemeMode = 'light' | 'dark'

export interface ProjectionInputs {
  monthlyIncome: number
  monthlyExpenses: number
  months: number
}

export interface ProjectionScenario {
  id: string
  name: string
  inputs: ProjectionInputs
  updatedAt: string
}

export interface ProjectionStateSnapshot {
  inputs: ProjectionInputs
  savedScenarios: ProjectionScenario[]
  activeScenarioId: string | null
}

export interface ProjectionRow {
  monthKey: string
  monthLabel: string
  income: number
  expenses: number
  net: number
  cumulativeBalance: number
}

export interface UiStateSnapshot {
  selectedMonth: string
  themeMode: ThemeMode
  currencyCode: string
  locale: string
}

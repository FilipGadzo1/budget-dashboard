export type ThemeMode = 'light' | 'dark'

// Multi-currency: an amount keeps the currency it was entered in. A missing
// `currency` on an item or adjustment means "the budget's base currency"
// (`ProjectionInputs.currency`). See src/services/currencyService.ts.

// A recurring income or expense line. See src/services/itemsService.ts.
export interface BudgetItem {
  id: string
  name: string
  amount: number
  currency?: string
  everyMonths?: number   // 1/undefined = monthly, 3 = quarterly, 12 = yearly
  startMonth?: string    // YYYY-MM, first month it applies (anchor when not monthly)
  endMonth?: string      // YYYY-MM, last month it applies (inclusive)
  category?: string      // expenses only
}

export interface ExpenseItem extends BudgetItem {
  sortOrder: number
}

export type IncomeItem = BudgetItem

export interface MonthAdjustment {
  id: string
  monthKey: string
  incomeAdjustment: number
  expenseAdjustment: number
  note?: string
  currency?: string
}

export interface ProjectionInputs {
  monthlyIncome: number
  monthlyExpenses: number
  months: number
  currency?: string                        // base currency: plain fields + untagged items
  incomeItems: IncomeItem[]
  expenseItems: ExpenseItem[]
  monthlyAdjustments: MonthAdjustment[]
  startingBalance?: number                 // cash on hand when the projection begins
  startingBalanceCurrency?: string         // currency it was entered in (default: base)
  savingsAdjustments?: MonthAdjustment[]   // system-generated: planned transfers into savings
  savingsStartingBalance?: number          // system-generated: already saved across all goals
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
  expenses: number               // spending only — savings transfers are not expenses
  net: number                    // income - expenses
  savingsContribution: number    // moved from cash into savings this month
  cashChange: number             // net - savingsContribution
  cumulativeBalance: number      // cash balance at the end of the month
  savingsBalance: number         // savings balance at the end of the month
  netWorth: number               // cumulativeBalance + savingsBalance
  incomeAdjustment: number       // user one-time adjustment only
  expenseAdjustment: number      // user one-time adjustment only
  adjustmentNote?: string
}

export interface UiStateSnapshot {
  selectedMonth: string
  themeMode: ThemeMode
  currencyCode: string
  locale: string
}

// ─── Savings ──────────────────────────────────────────────────────────────────

export type SavingsGoalStatus = 'active' | 'paused' | 'completed'

export interface SavingsGoal {
  id: string
  userId: string
  name: string
  emoji: string
  currency?: string            // currency of this goal's amounts and deposits
  targetAmount: number
  currentAmount: number        // maintained by DB trigger on deposits
  monthlyContribution: number  // included in projections as expense
  targetDate: string | null    // ISO date YYYY-MM-DD
  status: SavingsGoalStatus
  note: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface SavingsDeposit {
  id: string
  goalId: string
  userId: string   // actor (owner or editor collaborator)
  amount: number   // positive = deposit, negative = withdrawal
  note: string | null
  depositDate: string  // ISO date YYYY-MM-DD
  createdAt: string
}

// ─── Collaboration ────────────────────────────────────────────────────────────

export type CollaborationRole = 'viewer' | 'editor'
export type CollaborationStatus = 'pending' | 'accepted' | 'declined'

export interface Collaboration {
  id: string
  ownerId: string
  ownerEmail: string
  ownerName: string
  collaboratorEmail: string
  collaboratorId: string | null
  collaboratorName: string | null
  role: CollaborationRole
  status: CollaborationStatus
  inviteToken: string
  createdAt: string
  updatedAt: string
}

export interface SharedBudget {
  collaborationId: string
  ownerId: string
  ownerEmail: string
  ownerName: string
  collaboratorEmail: string
  role: CollaborationRole
  status: CollaborationStatus
  inviteToken: string
  ownerCurrencyCode: string
  ownerLocale: string
}

export interface ActivityEntry {
  id: string
  budgetOwnerId: string
  actorId: string
  actorEmail: string
  actorName: string
  action: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface BudgetContext {
  ownerId: string
  ownerName: string
  ownerEmail: string
  role: CollaborationRole
  ownerCurrencyCode: string
  ownerLocale: string
  ownerSelectedMonth?: string
}

export interface InviteInfo {
  id: string
  ownerId: string
  ownerEmail: string
  ownerName: string
  collaboratorEmail: string
  role: CollaborationRole
  status: CollaborationStatus
}

export interface OnlineUser {
  userId: string
  userName: string
  userEmail: string
  avatarUrl: string | null
}

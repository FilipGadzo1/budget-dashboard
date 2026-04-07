export type ThemeMode = 'light' | 'dark'

export interface ExpenseItem {
  id: string
  name: string
  amount: number
  sortOrder: number
}

export interface MonthAdjustment {
  id: string
  monthKey: string
  incomeAdjustment: number
  expenseAdjustment: number
  note?: string
}

export interface ProjectionInputs {
  monthlyIncome: number
  monthlyExpenses: number
  months: number
  expenseItems: ExpenseItem[]
  monthlyAdjustments: MonthAdjustment[]
  savingsAdjustments?: MonthAdjustment[]   // system-generated, separate from user adjustments
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
  incomeAdjustment: number       // user one-time adjustment only
  expenseAdjustment: number      // user one-time adjustment only
  savingsContribution: number    // savings goals contribution this month
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

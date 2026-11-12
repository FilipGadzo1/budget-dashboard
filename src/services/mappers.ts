import type {
  ExpenseItem,
  IncomeItem,
  MonthAdjustment,
  ProjectionScenario,
  SavingsDeposit,
  SavingsGoal,
} from '@/models'

// Converts raw database rows and JSON columns into domain models. Every reader —
// fetches, Realtime payloads, broadcasts — goes through here so a column is only
// ever interpreted in one place.

type Row = Record<string, any>

const asArray = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : [])

// Schedule and category of an item. Accepts both spellings: snake_case from the
// expense_items table, camelCase from JSONB columns and broadcasts.
const itemDetails = (i: Row) => {
  const every = Number(i.everyMonths ?? i.every_months ?? 1)
  return {
    currency: i.currency ?? undefined,
    everyMonths: every > 1 ? every : undefined,
    startMonth: i.startMonth ?? i.start_month ?? undefined,
    endMonth: i.endMonth ?? i.end_month ?? undefined,
    category: i.category ?? undefined,
  }
}

export const mapIncomeItems = (raw: unknown): IncomeItem[] =>
  asArray(raw).map((i) => ({
    id: i.id ?? crypto.randomUUID(),
    name: i.name ?? '',
    amount: Number(i.amount ?? 0),
    ...itemDetails(i),
  }))

export const mapExpenseItems = (raw: unknown): ExpenseItem[] =>
  asArray(raw).map((i) => ({
    id: i.id ?? crypto.randomUUID(),
    name: i.name ?? '',
    amount: Number(i.amount ?? 0),
    sortOrder: i.sort_order ?? i.sortOrder ?? 0,
    ...itemDetails(i),
  }))

export const mapMonthAdjustments = (raw: unknown): MonthAdjustment[] =>
  asArray(raw).map((a) => ({
    id: a.id ?? crypto.randomUUID(),
    monthKey: a.monthKey ?? '',
    incomeAdjustment: Number(a.incomeAdjustment ?? 0),
    expenseAdjustment: Number(a.expenseAdjustment ?? 0),
    note: a.note ?? undefined,
    currency: a.currency ?? undefined,
  }))

export const mapScenarioRow = (row: Row): ProjectionScenario => ({
  id: row.id,
  name: row.name,
  inputs: {
    monthlyIncome: Number(row.monthly_income),
    monthlyExpenses: Number(row.monthly_expenses),
    months: row.months,
    currency: row.currency ?? undefined,
    incomeItems: mapIncomeItems(row.income_items),
    expenseItems: mapExpenseItems(row.expense_items),
    monthlyAdjustments: mapMonthAdjustments(row.monthly_adjustments),
  },
  updatedAt: row.updated_at,
})

export const mapSavingsGoalRow = (row: Row): SavingsGoal => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  emoji: row.emoji ?? '🎯',
  currency: row.currency ?? undefined,
  targetAmount: Number(row.target_amount ?? 0),
  currentAmount: Number(row.current_amount ?? 0),
  monthlyContribution: Number(row.monthly_contribution ?? 0),
  targetDate: row.target_date ?? null,
  status: row.status ?? 'active',
  note: row.note ?? null,
  sortOrder: Number(row.sort_order ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const mapSavingsDepositRow = (row: Row): SavingsDeposit => ({
  id: row.id,
  goalId: row.goal_id,
  userId: row.user_id,
  amount: Number(row.amount ?? 0),
  note: row.note ?? null,
  depositDate: row.deposit_date,
  createdAt: row.created_at,
})

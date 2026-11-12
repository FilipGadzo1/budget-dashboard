import { supabase } from '@/lib/supabase'
import {
  mapExpenseItems,
  mapIncomeItems,
  mapMonthAdjustments,
  mapSavingsDepositRow,
  mapSavingsGoalRow,
  mapScenarioRow,
} from '@/services/mappers'
import { reportSaveError } from '@/lib/notify'
import type { ExpenseItem, IncomeItem, MonthAdjustment, ProjectionInputs, ProjectionScenario, SavingsDeposit, SavingsGoal, UiStateSnapshot } from '@/models'

type ScenarioUpdates = Partial<{
  name: string
  monthly_income: number
  monthly_expenses: number
  months: number
  income_items: IncomeItem[]
  expense_items: ExpenseItem[]
  monthly_adjustments: MonthAdjustment[]
  currency: string | null
  is_active: boolean
}>

// --- Profile (UI preferences) ---

export async function fetchProfile(userId: string): Promise<UiStateSnapshot | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('theme_mode, currency_code, locale, selected_month')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') console.warn('[db] fetchProfile error:', error.message)
    return null
  }

  return {
    themeMode: data.theme_mode as UiStateSnapshot['themeMode'],
    currencyCode: data.currency_code,
    locale: data.locale,
    selectedMonth: data.selected_month,
  }
}

export async function saveProfile(userId: string, prefs: UiStateSnapshot): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      theme_mode: prefs.themeMode,
      currency_code: prefs.currencyCode,
      locale: prefs.locale,
      selected_month: prefs.selectedMonth,
    })
    .eq('id', userId)

  if (error) reportSaveError('save your preferences', error.message)
}

// --- Projection inputs ---

export async function fetchProjectionInputs(userId: string): Promise<ProjectionInputs | null> {
  const [inputsResult, itemsResult] = await Promise.all([
    supabase
      .from('projection_inputs')
      .select('monthly_income, monthly_expenses, months, monthly_adjustments, income_items, currency, starting_balance, starting_balance_currency')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('expense_items')
      .select('id, name, amount, sort_order, currency')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
  ])

  if (inputsResult.error) {
    if (inputsResult.error.code !== 'PGRST116') console.warn('[db] fetchProjectionInputs error:', inputsResult.error.message)
    return null
  }

  return {
    monthlyIncome: Number(inputsResult.data.monthly_income),
    monthlyExpenses: Number(inputsResult.data.monthly_expenses),
    months: inputsResult.data.months,
    currency: inputsResult.data.currency ?? undefined,
    startingBalance: Number(inputsResult.data.starting_balance ?? 0),
    startingBalanceCurrency: inputsResult.data.starting_balance_currency ?? undefined,
    incomeItems: mapIncomeItems(inputsResult.data.income_items),
    expenseItems: mapExpenseItems(itemsResult.data),
    monthlyAdjustments: mapMonthAdjustments(inputsResult.data.monthly_adjustments),
  }
}

// Writes the new list first and only then removes rows that are no longer in it,
// so a failed write can never leave the user with an empty expense list.
export async function syncExpenseItems(userId: string, items: ExpenseItem[]): Promise<void> {
  if (items.length) {
    const { error } = await supabase.from('expense_items').upsert(
      items.map((item, index) => ({
        id: item.id,
        user_id: userId,
        name: item.name,
        amount: item.amount,
        sort_order: index,
        currency: item.currency ?? null,
      })),
      { onConflict: 'id' },
    )

    if (error) {
      reportSaveError('save your expense items', error.message)
      return
    }
  }

  let removal = supabase.from('expense_items').delete().eq('user_id', userId)
  if (items.length) {
    removal = removal.not('id', 'in', `(${items.map((item) => item.id).join(',')})`)
  }
  const { error: delError } = await removal

  if (delError) reportSaveError('save your expense items', delError.message)
}

export async function saveProjectionInputs(userId: string, inputs: ProjectionInputs): Promise<void> {
  const { error } = await supabase
    .from('projection_inputs')
    .update({
      monthly_income: inputs.monthlyIncome,
      monthly_expenses: inputs.monthlyExpenses,
      months: inputs.months,
      income_items: inputs.incomeItems ?? [],
      monthly_adjustments: inputs.monthlyAdjustments ?? [],
      currency: inputs.currency ?? null,
      starting_balance: inputs.startingBalance ?? 0,
      starting_balance_currency: inputs.startingBalanceCurrency ?? null,
    })
    .eq('user_id', userId)

  if (error) reportSaveError('save your budget inputs', error.message)
}

// --- Scenarios ---

export async function fetchScenarios(userId: string): Promise<{ scenarios: ProjectionScenario[]; activeScenarioId: string | null }> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, monthly_income, monthly_expenses, months, is_active, updated_at, income_items, expense_items, monthly_adjustments, currency')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[db] fetchScenarios error:', error.message)
    return { scenarios: [], activeScenarioId: null }
  }

  const rows = data ?? []
  return {
    scenarios: rows.map(mapScenarioRow),
    activeScenarioId: rows.find((row) => row.is_active)?.id ?? null,
  }
}

export async function insertScenario(userId: string, scenario: ProjectionScenario, isActive: boolean): Promise<void> {
  if (isActive) {
    await supabase.from('scenarios').update({ is_active: false }).eq('user_id', userId)
  }

  const { error } = await supabase.from('scenarios').insert({
    id: scenario.id,
    user_id: userId,
    name: scenario.name,
    monthly_income: scenario.inputs.monthlyIncome,
    monthly_expenses: scenario.inputs.monthlyExpenses,
    months: scenario.inputs.months,
    income_items: scenario.inputs.incomeItems ?? [],
    expense_items: scenario.inputs.expenseItems ?? [],
    monthly_adjustments: scenario.inputs.monthlyAdjustments ?? [],
    currency: scenario.inputs.currency ?? null,
    is_active: isActive,
  })

  if (error) reportSaveError('save the scenario', error.message)
}

export async function updateScenario(scenarioId: string, updates: ScenarioUpdates): Promise<void> {
  const { error } = await supabase.from('scenarios').update(updates).eq('id', scenarioId)
  if (error) reportSaveError('update the scenario', error.message)
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  const { error } = await supabase.from('scenarios').delete().eq('id', scenarioId)
  if (error) reportSaveError('delete the scenario', error.message)
}

export async function deleteAllScenarios(userId: string): Promise<void> {
  const { error } = await supabase.from('scenarios').delete().eq('user_id', userId)
  if (error) reportSaveError('delete your scenarios', error.message)
}

export async function setActiveScenario(userId: string, scenarioId: string | null): Promise<void> {
  const { error: clearError } = await supabase
    .from('scenarios')
    .update({ is_active: false })
    .eq('user_id', userId)

  if (clearError) {
    reportSaveError('switch the active scenario', clearError.message)
    return
  }

  if (scenarioId) {
    const { error } = await supabase
      .from('scenarios')
      .update({ is_active: true })
      .eq('id', scenarioId)
    if (error) reportSaveError('switch the active scenario', error.message)
  }
}

// --- Savings Goals ---

export async function fetchSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('id, user_id, name, emoji, target_amount, current_amount, monthly_contribution, target_date, status, note, sort_order, currency, created_at, updated_at')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.warn('[db] fetchSavingsGoals error:', error.message)
    return []
  }

  return (data ?? []).map(mapSavingsGoalRow)
}

export async function insertSavingsGoal(userId: string, goal: SavingsGoal): Promise<void> {
  const { error } = await supabase.from('savings_goals').insert({
    id: goal.id,
    user_id: userId,
    name: goal.name,
    emoji: goal.emoji,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    monthly_contribution: goal.monthlyContribution,
    target_date: goal.targetDate ?? null,
    status: goal.status,
    note: goal.note ?? null,
    sort_order: goal.sortOrder,
    currency: goal.currency ?? null,
  })

  if (error) reportSaveError('save the savings goal', error.message)
}

export async function updateSavingsGoal(
  goalId: string,
  updates: Partial<{
    name: string
    emoji: string
    target_amount: number
    monthly_contribution: number
    target_date: string | null
    status: string
    note: string | null
    currency: string | null
    sort_order: number
    updated_at: string
  }>,
): Promise<void> {
  const { error } = await supabase
    .from('savings_goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', goalId)

  if (error) reportSaveError('update the savings goal', error.message)
}

/**
 * Converts a goal — target, monthly contribution, saved amount and all deposits —
 * into another currency in one transaction. `rate` = new-currency units per 1 old.
 * Returns false when the change did not go through.
 */
export async function changeSavingsGoalCurrency(goalId: string, currency: string, rate: number): Promise<boolean> {
  const { error } = await supabase.rpc('change_goal_currency', {
    p_goal_id: goalId,
    p_currency: currency,
    p_rate: rate,
  })

  if (error) {
    reportSaveError("change the goal's currency", error.message)
    return false
  }
  return true
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('savings_goals').delete().eq('id', goalId)
  if (error) reportSaveError('delete the savings goal', error.message)
}

// --- Savings Deposits ---

export async function fetchDepositsForGoal(goalId: string): Promise<SavingsDeposit[]> {
  const { data, error } = await supabase
    .from('savings_deposits')
    .select('id, goal_id, user_id, amount, note, deposit_date, created_at')
    .eq('goal_id', goalId)
    .order('deposit_date', { ascending: false })

  if (error) {
    console.warn('[db] fetchDepositsForGoal error:', error.message)
    return []
  }

  return (data ?? []).map(mapSavingsDepositRow)
}

// Deposits are looked up by goal, not by depositor: `user_id` on a deposit is the
// actor (owner or editor collaborator), so filtering on it would hide deposits
// made by anyone other than the budget owner.
export async function fetchDepositsForGoals(goalIds: string[]): Promise<SavingsDeposit[]> {
  if (!goalIds.length) return []

  const { data, error } = await supabase
    .from('savings_deposits')
    .select('id, goal_id, user_id, amount, note, deposit_date, created_at')
    .in('goal_id', goalIds)
    .order('deposit_date', { ascending: false })

  if (error) {
    console.warn('[db] fetchDepositsForGoals error:', error.message)
    return []
  }

  return (data ?? []).map(mapSavingsDepositRow)
}

export async function insertSavingsDeposit(deposit: SavingsDeposit): Promise<void> {
  const { error } = await supabase.from('savings_deposits').insert({
    id: deposit.id,
    goal_id: deposit.goalId,
    user_id: deposit.userId,
    amount: deposit.amount,
    note: deposit.note ?? null,
    deposit_date: deposit.depositDate,
  })

  if (error) reportSaveError('save the deposit', error.message)
}

export async function deleteSavingsDeposit(depositId: string): Promise<void> {
  const { error } = await supabase.from('savings_deposits').delete().eq('id', depositId)
  if (error) reportSaveError('delete the deposit', error.message)
}

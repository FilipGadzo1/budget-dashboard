import { supabase } from '@/lib/supabase'
import type { ExpenseItem, MonthAdjustment, ProjectionInputs, ProjectionScenario, SavingsDeposit, SavingsGoal, UiStateSnapshot } from '@/models'

type ScenarioUpdates = Partial<{
  name: string
  monthly_income: number
  monthly_expenses: number
  months: number
  expense_items: string
  monthly_adjustments: string
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

  if (error) console.warn('[db] saveProfile error:', error.message)
}

// --- Projection inputs ---

export async function fetchProjectionInputs(userId: string): Promise<ProjectionInputs | null> {
  const [inputsResult, itemsResult] = await Promise.all([
    supabase
      .from('projection_inputs')
      .select('monthly_income, monthly_expenses, months, monthly_adjustments')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('expense_items')
      .select('id, name, amount, sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true }),
  ])

  if (inputsResult.error) {
    if (inputsResult.error.code !== 'PGRST116') console.warn('[db] fetchProjectionInputs error:', inputsResult.error.message)
    return null
  }

  const expenseItems: ExpenseItem[] = (itemsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    sortOrder: row.sort_order,
  }))

  const rawAdj: unknown[] = Array.isArray(inputsResult.data.monthly_adjustments)
    ? inputsResult.data.monthly_adjustments
    : []
  const monthlyAdjustments: MonthAdjustment[] = rawAdj.map((a: any) => ({
    id: a.id ?? crypto.randomUUID(),
    monthKey: a.monthKey ?? '',
    incomeAdjustment: Number(a.incomeAdjustment ?? 0),
    expenseAdjustment: Number(a.expenseAdjustment ?? 0),
    note: a.note ?? undefined,
  }))

  return {
    monthlyIncome: Number(inputsResult.data.monthly_income),
    monthlyExpenses: Number(inputsResult.data.monthly_expenses),
    months: inputsResult.data.months,
    expenseItems,
    monthlyAdjustments,
  }
}

export async function syncExpenseItems(userId: string, items: ExpenseItem[]): Promise<void> {
  const { error: delError } = await supabase
    .from('expense_items')
    .delete()
    .eq('user_id', userId)

  if (delError) {
    console.warn('[db] syncExpenseItems delete error:', delError.message)
    return
  }

  if (!items.length) return

  const { error } = await supabase.from('expense_items').insert(
    items.map((item, index) => ({
      id: item.id,
      user_id: userId,
      name: item.name,
      amount: item.amount,
      sort_order: index,
    })),
  )

  if (error) console.warn('[db] syncExpenseItems insert error:', error.message)
}

export async function saveProjectionInputs(userId: string, inputs: ProjectionInputs): Promise<void> {
  const { error } = await supabase
    .from('projection_inputs')
    .update({
      monthly_income: inputs.monthlyIncome,
      monthly_expenses: inputs.monthlyExpenses,
      months: inputs.months,
      monthly_adjustments: JSON.stringify(inputs.monthlyAdjustments ?? []),
    })
    .eq('user_id', userId)

  if (error) console.warn('[db] saveProjectionInputs error:', error.message)
}

// --- Scenarios ---

export async function fetchScenarios(userId: string): Promise<{ scenarios: ProjectionScenario[]; activeScenarioId: string | null }> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, monthly_income, monthly_expenses, months, is_active, updated_at, expense_items, monthly_adjustments')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[db] fetchScenarios error:', error.message)
    return { scenarios: [], activeScenarioId: null }
  }

  let activeScenarioId: string | null = null
  const scenarios: ProjectionScenario[] = (data ?? []).map((row) => {
    if (row.is_active) activeScenarioId = row.id
    const rawItems: unknown[] = Array.isArray(row.expense_items) ? row.expense_items : []
    const expenseItems: ExpenseItem[] = rawItems.map((i: any) => ({
      id: i.id ?? crypto.randomUUID(),
      name: i.name ?? '',
      amount: Number(i.amount ?? 0),
      sortOrder: i.sort_order ?? i.sortOrder ?? 0,
    }))
    const rawAdj: unknown[] = Array.isArray(row.monthly_adjustments) ? row.monthly_adjustments : []
    const monthlyAdjustments: MonthAdjustment[] = rawAdj.map((a: any) => ({
      id: a.id ?? crypto.randomUUID(),
      monthKey: a.monthKey ?? '',
      incomeAdjustment: Number(a.incomeAdjustment ?? 0),
      expenseAdjustment: Number(a.expenseAdjustment ?? 0),
      note: a.note ?? undefined,
    }))
    return {
      id: row.id,
      name: row.name,
      inputs: {
        monthlyIncome: Number(row.monthly_income),
        monthlyExpenses: Number(row.monthly_expenses),
        months: row.months,
        expenseItems,
        monthlyAdjustments,
      },
      updatedAt: row.updated_at,
    }
  })

  return { scenarios, activeScenarioId }
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
    expense_items: JSON.stringify(scenario.inputs.expenseItems ?? []),
    monthly_adjustments: JSON.stringify(scenario.inputs.monthlyAdjustments ?? []),
    is_active: isActive,
  })

  if (error) console.warn('[db] insertScenario error:', error.message)
}

export async function updateScenario(scenarioId: string, updates: ScenarioUpdates): Promise<void> {
  const { error } = await supabase.from('scenarios').update(updates).eq('id', scenarioId)
  if (error) console.warn('[db] updateScenario error:', error.message)
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  const { error } = await supabase.from('scenarios').delete().eq('id', scenarioId)
  if (error) console.warn('[db] deleteScenario error:', error.message)
}

export async function deleteAllScenarios(userId: string): Promise<void> {
  const { error } = await supabase.from('scenarios').delete().eq('user_id', userId)
  if (error) console.warn('[db] deleteAllScenarios error:', error.message)
}

export async function setActiveScenario(userId: string, scenarioId: string | null): Promise<void> {
  const { error: clearError } = await supabase
    .from('scenarios')
    .update({ is_active: false })
    .eq('user_id', userId)

  if (clearError) {
    console.warn('[db] setActiveScenario clear error:', clearError.message)
    return
  }

  if (scenarioId) {
    const { error } = await supabase
      .from('scenarios')
      .update({ is_active: true })
      .eq('id', scenarioId)
    if (error) console.warn('[db] setActiveScenario activate error:', error.message)
  }
}

// --- Savings Goals ---

export async function fetchSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const { data, error } = await supabase
    .from('savings_goals')
    .select('id, user_id, name, emoji, target_amount, current_amount, monthly_contribution, target_date, status, note, sort_order, created_at, updated_at')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.warn('[db] fetchSavingsGoals error:', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    emoji: row.emoji,
    targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    monthlyContribution: Number(row.monthly_contribution),
    targetDate: row.target_date ?? null,
    status: row.status as SavingsGoal['status'],
    note: row.note ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
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
  })

  if (error) console.warn('[db] insertSavingsGoal error:', error.message)
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
    sort_order: number
    updated_at: string
  }>,
): Promise<void> {
  const { error } = await supabase
    .from('savings_goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', goalId)

  if (error) console.warn('[db] updateSavingsGoal error:', error.message)
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('savings_goals').delete().eq('id', goalId)
  if (error) console.warn('[db] deleteSavingsGoal error:', error.message)
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

  return (data ?? []).map((row) => ({
    id: row.id,
    goalId: row.goal_id,
    userId: row.user_id,
    amount: Number(row.amount),
    note: row.note ?? null,
    depositDate: row.deposit_date,
    createdAt: row.created_at,
  }))
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

  if (error) console.warn('[db] insertSavingsDeposit error:', error.message)
}

export async function deleteSavingsDeposit(depositId: string): Promise<void> {
  const { error } = await supabase.from('savings_deposits').delete().eq('id', depositId)
  if (error) console.warn('[db] deleteSavingsDeposit error:', error.message)
}

import { supabase } from '@/lib/supabase'
import type { ExpenseItem, ProjectionInputs, ProjectionScenario, UiStateSnapshot } from '@/models'

type ScenarioUpdates = Partial<{
  name: string
  monthly_income: number
  monthly_expenses: number
  months: number
  expense_items: string
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
      .select('monthly_income, monthly_expenses, months')
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

  return {
    monthlyIncome: Number(inputsResult.data.monthly_income),
    monthlyExpenses: Number(inputsResult.data.monthly_expenses),
    months: inputsResult.data.months,
    expenseItems,
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
    })
    .eq('user_id', userId)

  if (error) console.warn('[db] saveProjectionInputs error:', error.message)
}

// --- Scenarios ---

export async function fetchScenarios(userId: string): Promise<{ scenarios: ProjectionScenario[]; activeScenarioId: string | null }> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, monthly_income, monthly_expenses, months, is_active, updated_at, expense_items')
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
    return {
      id: row.id,
      name: row.name,
      inputs: {
        monthlyIncome: Number(row.monthly_income),
        monthlyExpenses: Number(row.monthly_expenses),
        months: row.months,
        expenseItems,
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

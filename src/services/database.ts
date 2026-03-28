import { supabase } from '@/lib/supabase'
import type { ProjectionInputs, ProjectionScenario, UiStateSnapshot } from '@/models'

// --- Profile (UI preferences) ---

export async function fetchProfile(userId: string): Promise<UiStateSnapshot | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('theme_mode, currency_code, locale, selected_month')
    .eq('id', userId)
    .single()

  if (error || !data) return null

  return {
    themeMode: data.theme_mode as UiStateSnapshot['themeMode'],
    currencyCode: data.currency_code,
    locale: data.locale,
    selectedMonth: data.selected_month,
  }
}

export async function saveProfile(userId: string, prefs: UiStateSnapshot): Promise<void> {
  await supabase
    .from('profiles')
    .update({
      theme_mode: prefs.themeMode,
      currency_code: prefs.currencyCode,
      locale: prefs.locale,
      selected_month: prefs.selectedMonth,
    })
    .eq('id', userId)
}

// --- Projection inputs ---

export async function fetchProjectionInputs(userId: string): Promise<ProjectionInputs | null> {
  const { data, error } = await supabase
    .from('projection_inputs')
    .select('monthly_income, monthly_expenses, months')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  return {
    monthlyIncome: Number(data.monthly_income),
    monthlyExpenses: Number(data.monthly_expenses),
    months: data.months,
  }
}

export async function saveProjectionInputs(userId: string, inputs: ProjectionInputs): Promise<void> {
  await supabase
    .from('projection_inputs')
    .update({
      monthly_income: inputs.monthlyIncome,
      monthly_expenses: inputs.monthlyExpenses,
      months: inputs.months,
    })
    .eq('user_id', userId)
}

// --- Scenarios ---

export async function fetchScenarios(userId: string): Promise<{ scenarios: ProjectionScenario[]; activeScenarioId: string | null }> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('id, name, monthly_income, monthly_expenses, months, is_active, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !data) return { scenarios: [], activeScenarioId: null }

  let activeScenarioId: string | null = null
  const scenarios: ProjectionScenario[] = data.map((row) => {
    if (row.is_active) activeScenarioId = row.id
    return {
      id: row.id,
      name: row.name,
      inputs: {
        monthlyIncome: Number(row.monthly_income),
        monthlyExpenses: Number(row.monthly_expenses),
        months: row.months,
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

  await supabase.from('scenarios').insert({
    id: scenario.id,
    user_id: userId,
    name: scenario.name,
    monthly_income: scenario.inputs.monthlyIncome,
    monthly_expenses: scenario.inputs.monthlyExpenses,
    months: scenario.inputs.months,
    is_active: isActive,
  })
}

export async function updateScenario(scenarioId: string, updates: Partial<{ name: string; monthly_income: number; monthly_expenses: number; months: number; is_active: boolean }>): Promise<void> {
  await supabase.from('scenarios').update(updates).eq('id', scenarioId)
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  await supabase.from('scenarios').delete().eq('id', scenarioId)
}

export async function setActiveScenario(userId: string, scenarioId: string | null): Promise<void> {
  await supabase.from('scenarios').update({ is_active: false }).eq('user_id', userId)
  if (scenarioId) {
    await supabase.from('scenarios').update({ is_active: true }).eq('id', scenarioId)
  }
}

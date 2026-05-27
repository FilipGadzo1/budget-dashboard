-- Add income_items JSONB column to projection_inputs.
-- Stores named income sources (e.g. Salary, Freelance) that sum to monthly income.
-- When present, replaces the plain monthly_income value in projections.
-- Shape of each element: { id, name, amount }
alter table public.projection_inputs
  add column income_items jsonb not null default '[]';

-- Mirror the column in scenarios so each saved scenario captures the income
-- breakdown at the time it was saved, consistent with expense_items and
-- monthly_adjustments.
alter table public.scenarios
  add column income_items jsonb not null default '[]';

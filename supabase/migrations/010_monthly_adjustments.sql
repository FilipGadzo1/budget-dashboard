-- Add monthly_adjustments JSONB column to projection_inputs.
-- Stores per-month one-time income/expense deltas on top of the base monthly values.
-- Shape of each element: { id, monthKey, incomeAdjustment, expenseAdjustment, note? }
alter table public.projection_inputs
  add column monthly_adjustments jsonb not null default '[]';

-- Add monthly_adjustments snapshot column to scenarios so each saved scenario
-- captures adjustments at the time it was saved, mirroring how expense_items work.
alter table public.scenarios
  add column monthly_adjustments jsonb not null default '[]';

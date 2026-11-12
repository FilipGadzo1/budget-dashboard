-- Recurring items and expense categories.
--
-- An item can now repeat less often than monthly and can start or stop:
--   every_months  1 = monthly (default), 3 = quarterly, 6, 12 = yearly
--   start_month   first month it applies (YYYY-MM); also the anchor month for
--                 anything that is not monthly. NULL = from the beginning
--   end_month     last month it applies (YYYY-MM), inclusive. NULL = no end
--   category      free-text expense category. NULL = uncategorised
--
-- Income items live in the projection_inputs.income_items JSONB column and carry
-- the same keys per element (everyMonths, startMonth, endMonth) — no schema change.
-- Scenario snapshots (JSONB) pick the new keys up automatically.
--
-- IMPORTANT: run this before deploying the app version that reads these columns.

alter table public.expense_items
  add column if not exists every_months integer not null default 1,
  add column if not exists start_month text,
  add column if not exists end_month text,
  add column if not exists category text;

alter table public.expense_items
  drop constraint if exists expense_items_every_months_check;

alter table public.expense_items
  add constraint expense_items_every_months_check check (every_months >= 1);

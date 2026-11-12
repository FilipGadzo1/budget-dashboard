-- Multi-currency: every amount keeps the currency it was entered in.
--
--   projection_inputs.currency / scenarios.currency
--       currency of the plain monthly_income / monthly_expenses fields, and the
--       fallback for any item or adjustment that has none of its own
--   expense_items.currency
--       per-item currency; NULL = the budget's base currency (see above)
--   savings_goals.currency
--       currency of the goal's amounts; its deposits are in the same currency
--
-- Income items and monthly adjustments live in JSONB columns and carry an
-- optional "currency" key per element — no schema change needed for those.
--
-- profiles.currency_code remains the DISPLAY currency. Existing data is stamped
-- with the owner's current display currency, which is what it was entered in.
--
-- IMPORTANT: run this before deploying the app version that reads these columns.

alter table public.projection_inputs add column if not exists currency text;
alter table public.scenarios         add column if not exists currency text;
alter table public.expense_items     add column if not exists currency text;
alter table public.savings_goals     add column if not exists currency text;

update public.projection_inputs pi
set currency = p.currency_code
from public.profiles p
where p.id = pi.user_id and pi.currency is null;

update public.scenarios s
set currency = p.currency_code
from public.profiles p
where p.id = s.user_id and s.currency is null;

update public.savings_goals g
set currency = p.currency_code
from public.profiles p
where p.id = g.user_id and g.currency is null;

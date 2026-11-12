-- Starting balance: the cash the user has when the projection begins.
-- Without it the "balance" column was only cumulative net, starting from zero.
--
--   starting_balance           amount (may be negative, e.g. an overdraft)
--   starting_balance_currency  currency it was entered in; NULL = the budget's
--                              base currency (projection_inputs.currency)
--
-- It is a fact about today, not part of a plan, so it lives only on
-- projection_inputs and is NOT snapshotted into scenarios: loading a scenario
-- keeps the current starting balance.
--
-- IMPORTANT: run this before deploying the app version that reads these columns.

alter table public.projection_inputs
  add column if not exists starting_balance numeric not null default 0,
  add column if not exists starting_balance_currency text;

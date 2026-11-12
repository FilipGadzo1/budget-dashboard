-- Changing a savings goal's currency with conversion.
--
-- A goal's deposits are recorded in the goal's currency, so converting the goal
-- means converting its target, monthly contribution, saved amount and every
-- deposit together. Doing that from the client would take several requests (and
-- deposits have no UPDATE policy), so it is one atomic function instead.
--
-- p_rate is "1 unit of the old currency = p_rate units of the new currency".
-- Allowed for the goal's owner and for accepted editors of the owner's budget —
-- the same people who may already edit the goal.
--
-- (Changing the currency WITHOUT converting is a plain update of
-- savings_goals.currency and needs nothing from this migration.)

create or replace function public.change_goal_currency(
  p_goal_id uuid,
  p_currency text,
  p_rate numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if p_rate is null or p_rate <= 0 then
    raise exception 'Exchange rate must be positive';
  end if;

  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Invalid currency code';
  end if;

  select user_id into v_owner from public.savings_goals where id = p_goal_id;

  if v_owner is null then
    raise exception 'Savings goal not found';
  end if;

  if v_owner <> auth.uid() and not exists (
    select 1 from public.collaborations c
    where c.owner_id = v_owner
      and c.collaborator_id = auth.uid()
      and c.status = 'accepted'
      and c.role = 'editor'
  ) then
    raise exception 'Not allowed to change this savings goal' using errcode = '42501';
  end if;

  -- The deposit trigger only fires on insert/delete, so current_amount is
  -- converted explicitly below rather than recalculated by it.
  update public.savings_deposits
  set amount = round(amount * p_rate, 2)
  where goal_id = p_goal_id;

  update public.savings_goals
  set
    currency = p_currency,
    target_amount = round(target_amount * p_rate, 2),
    monthly_contribution = round(monthly_contribution * p_rate, 2),
    current_amount = round(current_amount * p_rate, 2),
    updated_at = now()
  where id = p_goal_id;
end;
$$;

revoke all on function public.change_goal_currency(uuid, text, numeric) from public;
grant execute on function public.change_goal_currency(uuid, text, numeric) to authenticated;

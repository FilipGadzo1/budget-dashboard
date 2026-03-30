-- ── Savings Goals ────────────────────────────────────────────────────────────
-- Stores named savings goals (e.g. wedding, car, trip) with optional target
-- date and monthly contribution amounts that feed into projections.

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  emoji text not null default '🎯',
  target_amount numeric(15,2) not null default 0,
  current_amount numeric(15,2) not null default 0,
  monthly_contribution numeric(15,2) not null default 0,
  target_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.savings_goals enable row level security;
-- Required so Supabase Realtime can evaluate cross-table RLS policies
-- (e.g. checking public.collaborations) for each subscriber.
alter table public.savings_goals replica identity full;

-- Owner has full access to their own goals
create policy "savings_goals_owner_all" on public.savings_goals
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Accepted collaborators can read the owner's goals
create policy "savings_goals_collab_select" on public.savings_goals
  for select
  using (
    exists (
      select 1 from public.collaborations c
      where c.owner_id = savings_goals.user_id
        and c.collaborator_id = auth.uid()
        and c.status = 'accepted'
    )
  );

-- Editor collaborators can update goals (but not insert/delete — only owner can)
create policy "savings_goals_editor_update" on public.savings_goals
  for update
  using (
    exists (
      select 1 from public.collaborations c
      where c.owner_id = savings_goals.user_id
        and c.collaborator_id = auth.uid()
        and c.status = 'accepted'
        and c.role = 'editor'
    )
  );

-- ── Savings Deposits ──────────────────────────────────────────────────────────
-- Individual deposit / withdrawal transactions per goal.
-- current_amount on savings_goals is maintained automatically by the trigger below.

create table public.savings_deposits (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(15,2) not null,
  note text,
  deposit_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.savings_deposits enable row level security;
alter table public.savings_deposits replica identity full;

-- Any user who can see the goal can also see its deposits
create policy "savings_deposits_select" on public.savings_deposits
  for select
  using (
    exists (
      select 1 from public.savings_goals sg
      where sg.id = savings_deposits.goal_id
        and (
          sg.user_id = auth.uid()
          or exists (
            select 1 from public.collaborations c
            where c.owner_id = sg.user_id
              and c.collaborator_id = auth.uid()
              and c.status = 'accepted'
          )
        )
    )
  );

-- Goal owner or editor collaborator can log deposits
create policy "savings_deposits_insert" on public.savings_deposits
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.savings_goals sg
      where sg.id = savings_deposits.goal_id
        and (
          sg.user_id = auth.uid()
          or exists (
            select 1 from public.collaborations c
            where c.owner_id = sg.user_id
              and c.collaborator_id = auth.uid()
              and c.status = 'accepted'
              and c.role = 'editor'
          )
        )
    )
  );

-- Depositor can delete their own entries; goal owner can delete any entry
create policy "savings_deposits_delete" on public.savings_deposits
  for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.savings_goals sg
      where sg.id = savings_deposits.goal_id
        and sg.user_id = auth.uid()
    )
  );

-- ── Trigger: keep current_amount in sync ─────────────────────────────────────
-- Automatically adjusts savings_goals.current_amount whenever a deposit is
-- inserted or deleted.  Also auto-completes an active goal when the target is hit.

create or replace function public.update_goal_current_amount()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'INSERT') then
    update public.savings_goals
    set
      current_amount = current_amount + new.amount,
      status = case
        when current_amount + new.amount >= target_amount and status = 'active'
          then 'completed'
        else status
      end,
      updated_at = now()
    where id = new.goal_id;

  elsif (TG_OP = 'DELETE') then
    update public.savings_goals
    set
      current_amount = greatest(current_amount - old.amount, 0),
      updated_at = now()
    where id = old.goal_id;
  end if;

  return null;
end;
$$;

create trigger savings_deposits_sync_goal
  after insert or delete on public.savings_deposits
  for each row execute function public.update_goal_current_amount();

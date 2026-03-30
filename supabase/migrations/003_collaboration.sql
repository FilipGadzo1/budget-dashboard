-- ─── Collaborations ──────────────────────────────────────────────────────────
-- Tracks who has been invited to collaborate on whose budget.

create table public.collaborations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  owner_name text,
  collaborator_email text not null,
  collaborator_id uuid references auth.users(id) on delete set null,
  collaborator_name text,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  invite_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, collaborator_email)
);

create index collaborations_owner_id_idx on public.collaborations(owner_id);
create index collaborations_collaborator_id_idx on public.collaborations(collaborator_id);
create index collaborations_collaborator_email_idx on public.collaborations(collaborator_email);
create index collaborations_invite_token_idx on public.collaborations(invite_token);

create trigger collaborations_updated_at before update on public.collaborations
  for each row execute function public.update_updated_at();

alter table public.collaborations enable row level security;

-- Owners can do anything with their own collaborations
create policy "Owners can manage their collaborations"
  on public.collaborations for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Collaborators can view their pending/accepted invitations (matched by email or id)
create policy "Collaborators can view invitations"
  on public.collaborations for select
  using (
    auth.uid() = collaborator_id
    or lower(collaborator_email) = lower(auth.email())
  );

-- Collaborators can respond (accept / decline) to their invitations
create policy "Collaborators can respond to invitations"
  on public.collaborations for update
  using (
    auth.uid() = collaborator_id
    or lower(collaborator_email) = lower(auth.email())
  )
  with check (
    auth.uid() = collaborator_id
    or lower(collaborator_email) = lower(auth.email())
  );

-- ─── Activity Log ────────────────────────────────────────────────────────────
-- Tracks key user actions taken on a shared budget.

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  budget_owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_email text not null default '',
  actor_name text not null default '',
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_log_budget_owner_id_idx on public.activity_log(budget_owner_id);
create index activity_log_created_at_idx on public.activity_log(created_at desc);

alter table public.activity_log enable row level security;

-- Budget owners can read all activity on their budget
create policy "Budget owners can read activity"
  on public.activity_log for select
  using (auth.uid() = budget_owner_id);

-- Accepted collaborators can also read activity on the shared budget
create policy "Accepted collaborators can read activity"
  on public.activity_log for select
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = activity_log.budget_owner_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
    )
  );

-- Any authenticated user can insert logs for their own actions
create policy "Authenticated users can log their own activity"
  on public.activity_log for insert
  with check (auth.uid() = actor_id);

-- ─── Extend existing RLS to allow accepted collaborators access ───────────────

-- projection_inputs: accepted collaborators can read
create policy "Accepted collaborators can read projection inputs"
  on public.projection_inputs for select
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = projection_inputs.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
    )
  );

-- projection_inputs: accepted editors can update
create policy "Accepted editors can update projection inputs"
  on public.projection_inputs for update
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = projection_inputs.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
        and role = 'editor'
    )
  );

-- scenarios: accepted collaborators can read
create policy "Accepted collaborators can read scenarios"
  on public.scenarios for select
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = scenarios.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
    )
  );

-- scenarios: accepted editors can insert
create policy "Accepted editors can insert scenarios"
  on public.scenarios for insert
  with check (
    exists (
      select 1 from public.collaborations
      where owner_id = scenarios.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
        and role = 'editor'
    )
  );

-- scenarios: accepted editors can update
create policy "Accepted editors can update scenarios"
  on public.scenarios for update
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = scenarios.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
        and role = 'editor'
    )
  );

-- scenarios: accepted editors can delete
create policy "Accepted editors can delete scenarios"
  on public.scenarios for delete
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = scenarios.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
        and role = 'editor'
    )
  );

-- expense_items: accepted collaborators can read
create policy "Accepted collaborators can read expense items"
  on public.expense_items for select
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = expense_items.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
    )
  );

-- expense_items: accepted editors can insert/update/delete
create policy "Accepted editors can insert expense items"
  on public.expense_items for insert
  with check (
    exists (
      select 1 from public.collaborations
      where owner_id = expense_items.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
        and role = 'editor'
    )
  );

create policy "Accepted editors can update expense items"
  on public.expense_items for update
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = expense_items.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
        and role = 'editor'
    )
  );

create policy "Accepted editors can delete expense items"
  on public.expense_items for delete
  using (
    exists (
      select 1 from public.collaborations
      where owner_id = expense_items.user_id
        and collaborator_id = auth.uid()
        and status = 'accepted'
        and role = 'editor'
    )
  );

-- ─── Helper function: fetch invite details by token ───────────────────────────
-- Allows reading invite metadata without RLS auth, used by the invite accept page.

create or replace function public.get_invite_by_token(p_token uuid)
returns table (
  id uuid,
  owner_id uuid,
  owner_email text,
  owner_name text,
  collaborator_email text,
  role text,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select
    c.id,
    c.owner_id,
    c.owner_email,
    c.owner_name,
    c.collaborator_email,
    c.role::text,
    c.status::text
  from public.collaborations c
  where c.invite_token = p_token;
end;
$$;

grant execute on function public.get_invite_by_token(uuid) to authenticated, anon;

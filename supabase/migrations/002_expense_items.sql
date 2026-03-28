-- Expense items: per-user list of named expense line items
create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expense_items_user_id_idx on public.expense_items(user_id);

create trigger expense_items_updated_at before update on public.expense_items
  for each row execute function public.update_updated_at();

-- RLS
alter table public.expense_items enable row level security;

create policy "Users can read own expense items"
  on public.expense_items for select using (auth.uid() = user_id);
create policy "Users can insert own expense items"
  on public.expense_items for insert with check (auth.uid() = user_id);
create policy "Users can update own expense items"
  on public.expense_items for update using (auth.uid() = user_id);
create policy "Users can delete own expense items"
  on public.expense_items for delete using (auth.uid() = user_id);

-- Add expense_items snapshot column to scenarios
alter table public.scenarios
  add column expense_items jsonb not null default '[]';

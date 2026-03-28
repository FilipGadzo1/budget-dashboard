-- Profiles: stores per-user UI preferences
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  theme_mode text not null default 'light' check (theme_mode in ('light', 'dark')),
  currency_code text not null default 'SEK',
  locale text not null default 'sv-SE',
  selected_month text not null default to_char(now(), 'YYYY-MM'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projection inputs: one row per user
create table public.projection_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  monthly_income numeric not null default 0,
  monthly_expenses numeric not null default 0,
  months integer not null default 12,
  updated_at timestamptz not null default now()
);

-- Scenarios: multiple per user
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  monthly_income numeric not null,
  monthly_expenses numeric not null,
  months integer not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scenarios_user_id_idx on public.scenarios(user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);

  insert into public.projection_inputs (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();
create trigger projection_inputs_updated_at before update on public.projection_inputs
  for each row execute function public.update_updated_at();
create trigger scenarios_updated_at before update on public.scenarios
  for each row execute function public.update_updated_at();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.projection_inputs enable row level security;
alter table public.scenarios enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can read own inputs"
  on public.projection_inputs for select using (auth.uid() = user_id);
create policy "Users can update own inputs"
  on public.projection_inputs for update using (auth.uid() = user_id);

create policy "Users can read own scenarios"
  on public.scenarios for select using (auth.uid() = user_id);
create policy "Users can insert own scenarios"
  on public.scenarios for insert with check (auth.uid() = user_id);
create policy "Users can update own scenarios"
  on public.scenarios for update using (auth.uid() = user_id);
create policy "Users can delete own scenarios"
  on public.scenarios for delete using (auth.uid() = user_id);

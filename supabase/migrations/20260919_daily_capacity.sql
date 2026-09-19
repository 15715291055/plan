alter table public.user_preferences
  add column if not exists break_minutes smallint not null default 10 check (break_minutes in (5, 10, 15)),
  add column if not exists min_block_minutes smallint not null default 20 check (min_block_minutes in (15, 20, 25)),
  add column if not exists peak_start_hour smallint not null default 9 check (peak_start_hour between 0 and 23),
  add column if not exists peak_end_hour smallint not null default 12 check (peak_end_hour between 1 and 24),
  add column if not exists base_daily_minutes smallint not null default 240 check (base_daily_minutes between 0 and 1440),
  add column if not exists load_sun smallint not null default 100 check (load_sun between 0 and 200),
  add column if not exists load_mon smallint not null default 100 check (load_mon between 0 and 200),
  add column if not exists load_tue smallint not null default 100 check (load_tue between 0 and 200),
  add column if not exists load_wed smallint not null default 100 check (load_wed between 0 and 200),
  add column if not exists load_thu smallint not null default 100 check (load_thu between 0 and 200),
  add column if not exists load_fri smallint not null default 100 check (load_fri between 0 and 200),
  add column if not exists load_sat smallint not null default 100 check (load_sat between 0 and 200);

create table if not exists public.capacity_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  start_date date not null,
  end_date date not null,
  base_daily_minutes smallint check (base_daily_minutes between 0 and 1440),
  load_sun smallint check (load_sun between 0 and 200),
  load_mon smallint check (load_mon between 0 and 200),
  load_tue smallint check (load_tue between 0 and 200),
  load_wed smallint check (load_wed between 0 and 200),
  load_thu smallint check (load_thu between 0 and 200),
  load_fri smallint check (load_fri between 0 and 200),
  load_sat smallint check (load_sat between 0 and 200),
  priority smallint not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create table if not exists public.daily_capacity_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  override_date date not null,
  load_percent smallint check (load_percent between 0 and 200),
  capacity_minutes smallint check (capacity_minutes between 0 and 1440),
  reason text check (reason is null or char_length(reason) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, override_date),
  check ((load_percent is not null and capacity_minutes is null) or (load_percent is null and capacity_minutes is not null))
);

create index if not exists capacity_profiles_user_dates_idx on public.capacity_profiles(user_id, start_date, end_date);
create index if not exists daily_capacity_overrides_user_date_idx on public.daily_capacity_overrides(user_id, override_date);

alter table public.capacity_profiles enable row level security;
alter table public.daily_capacity_overrides enable row level security;
grant select, insert, update, delete on public.capacity_profiles to authenticated;
grant select, insert, update, delete on public.daily_capacity_overrides to authenticated;

do $$
begin
  execute 'drop policy if exists "owner_select_capacity_profiles" on public.capacity_profiles';
  execute 'drop policy if exists "owner_insert_capacity_profiles" on public.capacity_profiles';
  execute 'drop policy if exists "owner_update_capacity_profiles" on public.capacity_profiles';
  execute 'drop policy if exists "owner_delete_capacity_profiles" on public.capacity_profiles';
  execute 'create policy "owner_select_capacity_profiles" on public.capacity_profiles for select using (auth.uid() = user_id)';
  execute 'create policy "owner_insert_capacity_profiles" on public.capacity_profiles for insert with check (auth.uid() = user_id)';
  execute 'create policy "owner_update_capacity_profiles" on public.capacity_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'create policy "owner_delete_capacity_profiles" on public.capacity_profiles for delete using (auth.uid() = user_id)';
  execute 'drop policy if exists "owner_select_daily_capacity_overrides" on public.daily_capacity_overrides';
  execute 'drop policy if exists "owner_insert_daily_capacity_overrides" on public.daily_capacity_overrides';
  execute 'drop policy if exists "owner_update_daily_capacity_overrides" on public.daily_capacity_overrides';
  execute 'drop policy if exists "owner_delete_daily_capacity_overrides" on public.daily_capacity_overrides';
  execute 'create policy "owner_select_daily_capacity_overrides" on public.daily_capacity_overrides for select using (auth.uid() = user_id)';
  execute 'create policy "owner_insert_daily_capacity_overrides" on public.daily_capacity_overrides for insert with check (auth.uid() = user_id)';
  execute 'create policy "owner_update_daily_capacity_overrides" on public.daily_capacity_overrides for update using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  execute 'create policy "owner_delete_daily_capacity_overrides" on public.daily_capacity_overrides for delete using (auth.uid() = user_id)';
end $$;

-- Handoff V3: capacity persistence, manual scheduling and completion cleanup.
-- Safe to run on databases that have not applied the earlier daily-capacity migration.
create extension if not exists pgcrypto;

alter table public.user_preferences
  add column if not exists break_minutes smallint not null default 10,
  add column if not exists min_block_minutes smallint not null default 20,
  add column if not exists peak_start_hour smallint not null default 9,
  add column if not exists peak_end_hour smallint not null default 12,
  add column if not exists base_daily_minutes smallint not null default 240,
  add column if not exists load_sun smallint not null default 100,
  add column if not exists load_mon smallint not null default 100,
  add column if not exists load_tue smallint not null default 100,
  add column if not exists load_wed smallint not null default 100,
  add column if not exists load_thu smallint not null default 100,
  add column if not exists load_fri smallint not null default 100,
  add column if not exists load_sat smallint not null default 100,
  add column if not exists habit_learning_enabled boolean not null default true;

create table if not exists public.capacity_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null, start_date date not null, end_date date not null, base_daily_minutes smallint,
  load_sun smallint, load_mon smallint, load_tue smallint, load_wed smallint, load_thu smallint, load_fri smallint, load_sat smallint,
  priority smallint not null default 0, enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.daily_capacity_overrides (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  override_date date not null, load_percent smallint, capacity_minutes smallint, reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id, override_date)
);
alter table public.capacity_profiles enable row level security;
alter table public.daily_capacity_overrides enable row level security;
grant select, insert, update, delete on public.capacity_profiles to authenticated;
grant select, insert, update, delete on public.daily_capacity_overrides to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'capacity_profiles' and policyname = 'capacity_profiles_owner') then
    create policy capacity_profiles_owner on public.capacity_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'daily_capacity_overrides' and policyname = 'daily_capacity_overrides_owner') then
    create policy daily_capacity_overrides_owner on public.daily_capacity_overrides for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.schedule_items add column if not exists source text not null default 'auto';
alter table public.schedule_items add column if not exists manually_adjusted_at timestamptz;

-- Add checks only when the column exists and the named constraint is absent.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_base_daily_minutes_check') then alter table public.user_preferences add constraint user_preferences_base_daily_minutes_check check (base_daily_minutes between 0 and 960); end if;
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_weekly_load_check') then alter table public.user_preferences add constraint user_preferences_weekly_load_check check (load_sun between 0 and 200 and load_mon between 0 and 200 and load_tue between 0 and 200 and load_wed between 0 and 200 and load_thu between 0 and 200 and load_fri between 0 and 200 and load_sat between 0 and 200); end if;
  if not exists (select 1 from pg_constraint where conname = 'schedule_items_source_check') then alter table public.schedule_items add constraint schedule_items_source_check check (source in ('auto','manual','imported')); end if;
end $$;

create table if not exists public.schedule_adjustment_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  schedule_item_id uuid references public.schedule_items(id) on delete set null, task_id uuid references public.tasks(id) on delete set null,
  category text not null default '', event_type text not null check (event_type in ('move','resize','split','delete_auto_block','lock','unlock')),
  from_start timestamptz, from_end timestamptz, to_start timestamptz, to_end timestamptz, created_at timestamptz not null default now()
);
create index if not exists schedule_adjustments_user_created_idx on public.schedule_adjustment_events(user_id, created_at);
alter table public.schedule_adjustment_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'schedule_adjustment_events' and policyname = 'adjustments_owner') then
    create policy adjustments_owner on public.schedule_adjustment_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
grant select, insert, delete on public.schedule_adjustment_events to authenticated;

create or replace function public.complete_task_and_cleanup_schedule(p_task_id uuid, p_completed_at timestamptz default now()) returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.tasks set status = 'completed', completed_at = p_completed_at, updated_at = now() where id = p_task_id and user_id = auth.uid();
  if not found then raise exception 'task not found or permission denied'; end if;
  delete from public.schedule_items where task_id = p_task_id and start_time > p_completed_at and exists (select 1 from public.tasks where id = p_task_id and user_id = auth.uid());
end; $$;
create or replace function public.restore_completed_task(p_task_id uuid) returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.tasks set status = 'todo', completed_at = null, updated_at = now(), evidence = jsonb_set(coalesce(evidence, '{}'::jsonb), '{completedMinutes}', '0'::jsonb) where id = p_task_id and user_id = auth.uid();
  if not found then raise exception 'task not found or permission denied'; end if;
end; $$;
create or replace function public.adjust_schedule_item(p_item_id uuid, p_start timestamptz, p_end timestamptz, p_locked boolean) returns void language plpgsql security invoker set search_path = public as $$
declare previous public.schedule_items; task_category text; learning boolean;
begin
  if p_start is null or p_end is null or p_start >= p_end then raise exception 'invalid schedule interval'; end if;
  select si.* into previous from public.schedule_items si join public.tasks t on t.id = si.task_id where si.id = p_item_id and t.user_id = auth.uid() for update of si;
  if not found then raise exception 'schedule item not found or permission denied'; end if;
  select task_type into task_category from public.tasks where id = previous.task_id;
  select habit_learning_enabled into learning from public.user_preferences where user_id = auth.uid();
  update public.schedule_items set start_time = p_start, end_time = p_end, locked = p_locked, source = 'manual', manually_adjusted_at = now() where id = p_item_id;
  if coalesce(learning, true) and (previous.start_time <> p_start or previous.end_time <> p_end or previous.locked <> p_locked) then
    insert into public.schedule_adjustment_events(schedule_item_id, task_id, category, event_type, from_start, from_end, to_start, to_end) values (p_item_id, previous.task_id, task_category, case when previous.start_time <> p_start then 'move' when previous.end_time <> p_end then 'resize' when p_locked then 'lock' else 'unlock' end, previous.start_time, previous.end_time, p_start, p_end);
  end if;
end; $$;
grant execute on function public.complete_task_and_cleanup_schedule(uuid,timestamptz), public.restore_completed_task(uuid), public.adjust_schedule_item(uuid,timestamptz,timestamptz,boolean) to authenticated;

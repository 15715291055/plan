create extension if not exists pgcrypto;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  code text,
  color text not null default '#2673e8',
  semester text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  course_id uuid references public.courses(id) on delete set null,
  parent_id uuid references public.tasks(id) on delete set null,
  title text not null,
  description text,
  task_type text not null default 'study',
  deadline timestamptz,
  grade_weight numeric(5,2),
  difficulty smallint check (difficulty between 1 and 5),
  priority smallint not null default 0 check (priority between 0 and 100),
  estimated_minutes integer not null default 30 check (estimated_minutes > 0),
  confidence numeric(4,3),
  status text not null default 'todo' check (status in ('todo','in_progress','completed','archived')),
  source text not null default 'manual' check (source in ('manual','weekly_input','material','temporary')),
  evidence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.fixed_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  recurrence_rule text,
  created_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  version integer not null default 1,
  reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  locked boolean not null default false,
  status text not null default 'planned' check (status in ('planned','in_progress','completed','skipped')),
  check (start_time < end_time)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  course_id uuid references public.courses(id) on delete set null,
  file_name text not null,
  file_type text not null,
  file_size bigint,
  storage_path text,
  status text not null default 'queued' check (status in ('queued','processing','ready','needs_review','failed')),
  analysis_result jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  planned_minutes integer,
  actual_minutes integer,
  quality smallint check (quality between 1 and 5),
  delay_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  course_id uuid references public.courses(id) on delete set null,
  week_start date not null,
  raw_text text not null,
  material_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  default_block_minutes smallint not null default 50 check (default_block_minutes in (25, 50, 90)),
  buffer_ratio numeric(4,3) not null default 0.15 check (buffer_ratio between 0 and 0.3),
  auto_log boolean not null default true,
  updated_at timestamptz not null default now()
);

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

create table if not exists public.capacity_profiles (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade default auth.uid(), name text not null check (char_length(trim(name)) between 1 and 40), start_date date not null, end_date date not null, base_daily_minutes smallint check (base_daily_minutes between 0 and 1440), load_sun smallint check (load_sun between 0 and 200), load_mon smallint check (load_mon between 0 and 200), load_tue smallint check (load_tue between 0 and 200), load_wed smallint check (load_wed between 0 and 200), load_thu smallint check (load_thu between 0 and 200), load_fri smallint check (load_fri between 0 and 200), load_sat smallint check (load_sat between 0 and 200), priority smallint not null default 0, enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (start_date <= end_date));
create table if not exists public.daily_capacity_overrides (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade default auth.uid(), override_date date not null, load_percent smallint check (load_percent between 0 and 200), capacity_minutes smallint check (capacity_minutes between 0 and 1440), reason text check (reason is null or char_length(reason) <= 120), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, override_date), check ((load_percent is not null and capacity_minutes is null) or (load_percent is null and capacity_minutes is not null)));

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null default '学习者' check (char_length(trim(display_name)) between 1 and 32),
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- API keys are encrypted by the Vercel server before they reach this table.
-- No client-side RLS policy is created for this table; it is only accessed with
-- the Supabase service-role key after the server verifies the user's JWT.
create table if not exists public.user_api_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz not null default now()
);

alter table public.courses enable row level security;
alter table public.tasks enable row level security;
alter table public.availability_rules enable row level security;
alter table public.fixed_events enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_items enable row level security;
alter table public.materials enable row level security;
alter table public.study_logs enable row level security;
alter table public.weekly_inputs enable row level security;
alter table public.user_preferences enable row level security;
alter table public.capacity_profiles enable row level security;
alter table public.daily_capacity_overrides enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_api_credentials enable row level security;

grant all on table public.user_api_credentials to service_role;

grant select, insert, update, delete on public.user_profiles to authenticated;

do $$
declare t text;
begin
  foreach t in array array['courses','tasks','availability_rules','fixed_events','schedules','materials','study_logs','weekly_inputs','user_preferences','user_profiles','capacity_profiles','daily_capacity_overrides'] loop
    execute format('drop policy if exists "owner_select_%1$s" on public.%1$s', t);
    execute format('drop policy if exists "owner_insert_%1$s" on public.%1$s', t);
    execute format('drop policy if exists "owner_update_%1$s" on public.%1$s', t);
    execute format('drop policy if exists "owner_delete_%1$s" on public.%1$s', t);
    execute format('create policy "owner_select_%1$s" on public.%1$s for select using (auth.uid() = user_id)', t);
    execute format('create policy "owner_insert_%1$s" on public.%1$s for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "owner_update_%1$s" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "owner_delete_%1$s" on public.%1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

drop policy if exists "owner_select_schedule_items" on public.schedule_items;
drop policy if exists "owner_insert_schedule_items" on public.schedule_items;
drop policy if exists "owner_update_schedule_items" on public.schedule_items;
drop policy if exists "owner_delete_schedule_items" on public.schedule_items;
create policy "owner_select_schedule_items" on public.schedule_items for select using (exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid()));
create policy "owner_insert_schedule_items" on public.schedule_items for insert with check (exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid()));
create policy "owner_update_schedule_items" on public.schedule_items for update using (exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid())) with check (exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid()));
create policy "owner_delete_schedule_items" on public.schedule_items for delete using (exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid()));

create index if not exists tasks_user_deadline_idx on public.tasks(user_id, deadline);
create index if not exists schedule_items_task_idx on public.schedule_items(task_id);
create index if not exists study_logs_task_idx on public.study_logs(task_id);

-- Private material bucket. Files are stored under <auth.uid()>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owner_select_material_objects" on storage.objects;
drop policy if exists "owner_insert_material_objects" on storage.objects;
drop policy if exists "owner_update_material_objects" on storage.objects;
drop policy if exists "owner_delete_material_objects" on storage.objects;
create policy "owner_select_material_objects" on storage.objects for select to authenticated
using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner_insert_material_objects" on storage.objects for insert to authenticated
with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner_update_material_objects" on storage.objects for update to authenticated
using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner_delete_material_objects" on storage.objects for delete to authenticated
using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

-- Keep the existing locked column as the single source of truth.
alter table public.user_preferences add column if not exists habit_learning_enabled boolean not null default true;
alter table public.user_preferences drop constraint if exists user_preferences_base_daily_minutes_check;
alter table public.user_preferences add constraint user_preferences_base_daily_minutes_check check (base_daily_minutes between 0 and 960) not valid;
alter table public.capacity_profiles drop constraint if exists capacity_profiles_base_daily_minutes_check;
alter table public.capacity_profiles add constraint capacity_profiles_base_daily_minutes_check check (base_daily_minutes between 0 and 960) not valid;
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.schedule_items
  add column if not exists source text not null default 'auto' check (source in ('auto', 'manual', 'imported')),
  add column if not exists manually_adjusted_at timestamptz;

create table if not exists public.schedule_adjustment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  schedule_item_id uuid references public.schedule_items(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  category text not null default '',
  event_type text not null check (event_type in ('move','resize','split','delete_auto_block','lock','unlock')),
  from_start timestamptz, from_end timestamptz, to_start timestamptz, to_end timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists schedule_adjustments_user_created_idx on public.schedule_adjustment_events(user_id, created_at);
alter table public.schedule_adjustment_events enable row level security;
drop policy if exists adjustments_owner on public.schedule_adjustment_events;
create policy adjustments_owner on public.schedule_adjustment_events for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.schedule_adjustment_events to authenticated;

create or replace function public.complete_task_and_cleanup_schedule(p_task_id uuid, p_completed_at timestamptz default now())
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.tasks set status = 'completed', completed_at = p_completed_at, updated_at = now()
    where id = p_task_id and user_id = auth.uid();
  if not found then raise exception 'task not found or permission denied'; end if;
  delete from public.schedule_items where task_id = p_task_id and start_time > p_completed_at
    and exists (select 1 from public.tasks where id = p_task_id and user_id = auth.uid());
end; $$;

create or replace function public.restore_completed_task(p_task_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.tasks set status = 'todo', completed_at = null, updated_at = now(),
    evidence = jsonb_set(coalesce(evidence, '{}'::jsonb), '{completedMinutes}', '0'::jsonb)
    where id = p_task_id and user_id = auth.uid();
  if not found then raise exception 'task not found or permission denied'; end if;
end; $$;

create or replace function public.adjust_schedule_item(p_item_id uuid, p_start timestamptz, p_end timestamptz, p_locked boolean)
returns void language plpgsql security invoker set search_path = public as $$
declare previous public.schedule_items; task_category text; learning boolean;
begin
  if p_start is null or p_end is null or p_start >= p_end then raise exception 'invalid schedule interval'; end if;
  select si.* into previous from public.schedule_items si join public.tasks t on t.id = si.task_id
    where si.id = p_item_id and t.user_id = auth.uid() for update of si;
  if not found then raise exception 'schedule item not found or permission denied'; end if;
  select task_type into task_category from public.tasks where id = previous.task_id;
  select habit_learning_enabled into learning from public.user_preferences where user_id = auth.uid();
  update public.schedule_items set start_time = p_start, end_time = p_end, locked = p_locked,
    source = 'manual', manually_adjusted_at = now() where id = p_item_id;
  if coalesce(learning, true) and (previous.start_time <> p_start or previous.end_time <> p_end or previous.locked <> p_locked) then
    insert into public.schedule_adjustment_events(schedule_item_id, task_id, category, event_type, from_start, from_end, to_start, to_end)
    values (p_item_id, previous.task_id, task_category,
      case when previous.start_time <> p_start then 'move' when previous.end_time <> p_end then 'resize' when p_locked then 'lock' else 'unlock' end,
      previous.start_time, previous.end_time, p_start, p_end);
  end if;
end; $$;
revoke all on function public.complete_task_and_cleanup_schedule(uuid,timestamptz), public.restore_completed_task(uuid), public.adjust_schedule_item(uuid,timestamptz,timestamptz,boolean) from public;
grant execute on function public.complete_task_and_cleanup_schedule(uuid,timestamptz), public.restore_completed_task(uuid), public.adjust_schedule_item(uuid,timestamptz,timestamptz,boolean) to authenticated;


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

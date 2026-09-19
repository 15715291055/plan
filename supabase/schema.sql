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

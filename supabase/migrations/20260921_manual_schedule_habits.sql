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

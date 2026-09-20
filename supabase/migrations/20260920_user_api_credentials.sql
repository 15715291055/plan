-- Required by the Vercel API routes that store encrypted DeepSeek keys.
-- Run this migration in Supabase SQL Editor if the table is missing.
create table if not exists public.user_api_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_api_credentials enable row level security;
grant all on table public.user_api_credentials to service_role;

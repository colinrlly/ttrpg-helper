-- Scriptorium — sessions schema + RLS (anonymous-auth ready).
-- Paste this into the Supabase SQL editor and run it.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Untitled session',
  readiness int not null default 0,
  content jsonb not null default '{}'::jsonb, -- { doc, tools, messages }
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists sessions_owner_idx on public.sessions (owner);

-- Row-Level Security: a user can only touch their own sessions.
alter table public.sessions enable row level security;

create policy "owner can read own sessions"
  on public.sessions for select
  using (auth.uid() = owner);

create policy "owner can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = owner);

create policy "owner can update own sessions"
  on public.sessions for update
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

create policy "owner can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = owner);

-- Keep updated_at fresh on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sessions_touch_updated_at on public.sessions;
create trigger sessions_touch_updated_at
  before update on public.sessions
  for each row execute function public.touch_updated_at();

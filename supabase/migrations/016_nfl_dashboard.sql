-- Stjórnborðið: one row per account with the layout, the fantasy team and the
-- tracked slips, readable and writable by its owner only. Screenshot reads of
-- a fantasy team are logged so each account gets ten a day.

create table public.nfl_dashboard (
  user_id uuid primary key references auth.users (id) on delete cascade,
  layout jsonb not null default '[]',
  fantasy jsonb not null default '{}',
  bets jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  check (pg_column_size(layout) + pg_column_size(fantasy) + pg_column_size(bets) < 100000)
);
alter table public.nfl_dashboard enable row level security;
create policy "own dashboard" on public.nfl_dashboard for select using (auth.uid() = user_id);
create policy "create own dashboard" on public.nfl_dashboard for insert with check (auth.uid() = user_id);
create policy "change own dashboard" on public.nfl_dashboard for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "drop own dashboard" on public.nfl_dashboard for delete using (auth.uid() = user_id);

create table public.nfl_fantasy_shot (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index nfl_fantasy_shot_user_idx on public.nfl_fantasy_shot (user_id, created_at);

-- ten a day per account: the read costs money
create or replace function public.nfl_fantasy_shot_quota_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.nfl_fantasy_shot s where s.user_id = auth.uid() and s.created_at > now() - interval '1 day') < 10
$$;

alter table public.nfl_fantasy_shot enable row level security;
create policy "own reads" on public.nfl_fantasy_shot for select using (auth.uid() = user_id);
create policy "log a read" on public.nfl_fantasy_shot for insert with check (auth.uid() = user_id and public.nfl_fantasy_shot_quota_ok());

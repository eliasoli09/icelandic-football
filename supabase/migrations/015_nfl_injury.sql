-- Meiðslalistinn: each week's injury report (Out, Doubtful, Questionable) and
-- the players the weekly roster has on reserve (IR, PUP and the rest) or cut,
-- from nflverse. One row per player and week; the cron replaces a week whole,
-- so a player who is cleared drops off.

create table public.nfl_injury (
  season int not null,
  week int not null,
  game_type text not null,
  team text not null,
  player_id text not null,
  name text not null,
  position text,
  status text not null check (status in ('Out', 'Doubtful', 'Questionable', 'IR', 'PUP', 'Reserve', 'Cut')),
  injury text,
  practice text,
  source text not null check (source in ('report', 'roster')),
  updated_at timestamptz not null default now(),
  primary key (season, week, player_id)
);
create index nfl_injury_team_idx on public.nfl_injury (season, week, team);
alter table public.nfl_injury enable row level security;
create policy "injuries are public" on public.nfl_injury for select using (true);
-- writes only through the function below

create or replace function public.rpc_replace_nfl_injuries(p_secret text, p_season int, p_week int, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  delete from public.nfl_injury where season = p_season and week = p_week;
  insert into public.nfl_injury (season, week, game_type, team, player_id, name, position, status, injury, practice, source)
  select p_season, p_week, r->>'game_type', r->>'team', r->>'player_id', r->>'name', nullif(r->>'position', ''),
         r->>'status', nullif(r->>'injury', ''), nullif(r->>'practice', ''), r->>'source'
  from jsonb_array_elements(p_rows) r
  on conflict (season, week, player_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

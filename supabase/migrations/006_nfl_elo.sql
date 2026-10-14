-- NFL Elo history: one row per club per played game. Rebuilt from the full
-- game history by the NFL cron; written with an upsert so a reader never sees
-- a half-filled table.

create table if not exists public.nfl_elo (
  game_id text not null references public.nfl_games (game_id),
  team text not null references public.nfl_teams (abbr),
  season int not null,
  week int not null,
  elo_before numeric not null,
  elo_after numeric not null,
  p_win numeric not null,
  primary key (game_id, team)
);
create index if not exists nfl_elo_team_season on public.nfl_elo (team, season);
create index if not exists nfl_elo_season on public.nfl_elo (season);

alter table public.nfl_elo enable row level security;
create policy "public read" on public.nfl_elo for select using (true);

create or replace function public.rpc_upsert_nfl_elo(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_elo (game_id, team, season, week, elo_before, elo_after, p_win)
  select r->>'game_id', r->>'team', (r->>'season')::int, (r->>'week')::int,
         (r->>'elo_before')::numeric, (r->>'elo_after')::numeric, (r->>'p_win')::numeric
  from jsonb_array_elements(p_rows) r
  on conflict (game_id, team) do update set
    season = excluded.season, week = excluded.week, elo_before = excluded.elo_before,
    elo_after = excluded.elo_after, p_win = excluded.p_win;
  get diagnostics n = row_count;
  return n;
end $$;

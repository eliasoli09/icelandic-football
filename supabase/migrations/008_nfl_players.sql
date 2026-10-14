-- NFL player stats: the register, one row per player per game, and season
-- totals as a view. About 19,400 weekly rows a season, 1999 on.

create table if not exists public.nfl_players (
  player_id text primary key,
  name text not null,
  position text,
  position_group text,
  team text,
  jersey int,
  rookie_season int,
  draft_year int,
  draft_round int,
  draft_pick int,
  draft_team text,
  college text,
  birth_date date,
  headshot text
);

create table if not exists public.nfl_player_weeks (
  player_id text not null references public.nfl_players (player_id),
  season int not null,
  week int not null,
  season_type text not null check (season_type in ('REG', 'POST')),
  game_id text,
  team text,
  opponent text,
  completions int not null default 0,
  attempts int not null default 0,
  passing_yards int not null default 0,
  passing_tds int not null default 0,
  interceptions int not null default 0,
  sacks_taken int not null default 0,
  passing_epa real not null default 0,
  carries int not null default 0,
  rushing_yards int not null default 0,
  rushing_tds int not null default 0,
  rushing_epa real not null default 0,
  receptions int not null default 0,
  targets int not null default 0,
  receiving_yards int not null default 0,
  receiving_tds int not null default 0,
  receiving_epa real not null default 0,
  fumbles_lost int not null default 0,
  tackles_solo int not null default 0,
  tackle_assists int not null default 0,
  tackles_for_loss real not null default 0,
  def_sacks real not null default 0,
  qb_hits int not null default 0,
  def_interceptions int not null default 0,
  passes_defended int not null default 0,
  forced_fumbles int not null default 0,
  def_tds int not null default 0,
  special_teams_tds int not null default 0,
  primary key (player_id, season, week, season_type)
);
create index if not exists nfl_player_weeks_season on public.nfl_player_weeks (season, season_type);

alter table public.nfl_players enable row level security;
alter table public.nfl_player_weeks enable row level security;
create policy "public read" on public.nfl_players for select using (true);
create policy "public read" on public.nfl_player_weeks for select using (true);

-- security_invoker: the view reads with the caller's rights, so RLS applies as usual
create or replace view public.nfl_player_season with (security_invoker = true) as
select w.player_id, w.season, w.season_type,
  count(*)::int as games,
  (array_agg(w.team order by w.week desc))[1] as team,
  p.name, p.position, p.headshot, p.rookie_season,
  sum(w.completions) as completions,
  sum(w.attempts) as attempts,
  sum(w.passing_yards) as passing_yards,
  sum(w.passing_tds) as passing_tds,
  sum(w.interceptions) as interceptions,
  sum(w.sacks_taken) as sacks_taken,
  sum(w.passing_epa) as passing_epa,
  sum(w.carries) as carries,
  sum(w.rushing_yards) as rushing_yards,
  sum(w.rushing_tds) as rushing_tds,
  sum(w.rushing_epa) as rushing_epa,
  sum(w.receptions) as receptions,
  sum(w.targets) as targets,
  sum(w.receiving_yards) as receiving_yards,
  sum(w.receiving_tds) as receiving_tds,
  sum(w.receiving_epa) as receiving_epa,
  sum(w.fumbles_lost) as fumbles_lost,
  sum(w.tackles_solo) as tackles_solo,
  sum(w.tackle_assists) as tackle_assists,
  sum(w.tackles_for_loss) as tackles_for_loss,
  sum(w.def_sacks) as def_sacks,
  sum(w.qb_hits) as qb_hits,
  sum(w.def_interceptions) as def_interceptions,
  sum(w.passes_defended) as passes_defended,
  sum(w.forced_fumbles) as forced_fumbles,
  sum(w.def_tds) as def_tds,
  sum(w.special_teams_tds) as special_teams_tds
from public.nfl_player_weeks w
join public.nfl_players p using (player_id)
group by w.player_id, w.season, w.season_type, p.name, p.position, p.headshot, p.rookie_season;

create or replace function public.rpc_upsert_nfl_players(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_players (player_id, name, position, position_group, team, jersey, rookie_season, draft_year, draft_round, draft_pick, draft_team, college, birth_date, headshot)
  select r->>'player_id', r->>'name', r->>'position', r->>'position_group', r->>'team', (r->>'jersey')::int,
         (r->>'rookie_season')::int, (r->>'draft_year')::int, (r->>'draft_round')::int, (r->>'draft_pick')::int,
         r->>'draft_team', r->>'college', (r->>'birth_date')::date, r->>'headshot'
  from jsonb_array_elements(p_rows) r
  on conflict (player_id) do update set
    name = excluded.name, position = excluded.position, position_group = excluded.position_group, team = excluded.team,
    jersey = excluded.jersey, rookie_season = excluded.rookie_season, draft_year = excluded.draft_year,
    draft_round = excluded.draft_round, draft_pick = excluded.draft_pick, draft_team = excluded.draft_team,
    college = excluded.college, birth_date = excluded.birth_date, headshot = excluded.headshot;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.rpc_upsert_nfl_player_weeks(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_player_weeks (player_id, season, week, season_type, game_id, team, opponent, completions, attempts, passing_yards, passing_tds, interceptions, sacks_taken, passing_epa, carries, rushing_yards, rushing_tds, rushing_epa, receptions, targets, receiving_yards, receiving_tds, receiving_epa, fumbles_lost, tackles_solo, tackle_assists, tackles_for_loss, def_sacks, qb_hits, def_interceptions, passes_defended, forced_fumbles, def_tds, special_teams_tds)
  select r->>'player_id', (r->>'season')::int, (r->>'week')::int, r->>'season_type', r->>'game_id', r->>'team', r->>'opponent',
         (r->>'completions')::int, (r->>'attempts')::int, (r->>'passing_yards')::int, (r->>'passing_tds')::int, (r->>'interceptions')::int, (r->>'sacks_taken')::int, (r->>'passing_epa')::real, (r->>'carries')::int, (r->>'rushing_yards')::int, (r->>'rushing_tds')::int, (r->>'rushing_epa')::real, (r->>'receptions')::int, (r->>'targets')::int, (r->>'receiving_yards')::int, (r->>'receiving_tds')::int, (r->>'receiving_epa')::real, (r->>'fumbles_lost')::int, (r->>'tackles_solo')::int, (r->>'tackle_assists')::int, (r->>'tackles_for_loss')::real, (r->>'def_sacks')::real, (r->>'qb_hits')::int, (r->>'def_interceptions')::int, (r->>'passes_defended')::int, (r->>'forced_fumbles')::int, (r->>'def_tds')::int, (r->>'special_teams_tds')::int
  from jsonb_array_elements(p_rows) r
  on conflict (player_id, season, week, season_type) do update set
    game_id = excluded.game_id, team = excluded.team, opponent = excluded.opponent, completions = excluded.completions, attempts = excluded.attempts, passing_yards = excluded.passing_yards, passing_tds = excluded.passing_tds, interceptions = excluded.interceptions, sacks_taken = excluded.sacks_taken, passing_epa = excluded.passing_epa, carries = excluded.carries, rushing_yards = excluded.rushing_yards, rushing_tds = excluded.rushing_tds, rushing_epa = excluded.rushing_epa, receptions = excluded.receptions, targets = excluded.targets, receiving_yards = excluded.receiving_yards, receiving_tds = excluded.receiving_tds, receiving_epa = excluded.receiving_epa, fumbles_lost = excluded.fumbles_lost, tackles_solo = excluded.tackles_solo, tackle_assists = excluded.tackle_assists, tackles_for_loss = excluded.tackles_for_loss, def_sacks = excluded.def_sacks, qb_hits = excluded.qb_hits, def_interceptions = excluded.def_interceptions, passes_defended = excluded.passes_defended, forced_fumbles = excluded.forced_fumbles, def_tds = excluded.def_tds, special_teams_tds = excluded.special_teams_tds;
  get diagnostics n = row_count;
  return n;
end $$;

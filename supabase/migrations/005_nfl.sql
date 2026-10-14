-- NFL corner, part 1. Separate tables: the football pipeline (matches, Elo
-- pools, 1X2) does not fit American football and must not be mixed with it.

create table if not exists public.nfl_teams (
  abbr text primary key,
  franchise text not null,
  name text not null,
  conference text not null check (conference in ('AFC', 'NFC')),
  division text not null check (division in ('East', 'North', 'South', 'West')),
  color text,
  color2 text,
  logo text
);

create table if not exists public.nfl_games (
  game_id text primary key,
  season int not null,
  game_type text not null check (game_type in ('REG', 'WC', 'DIV', 'CON', 'SB')),
  week int not null,
  kickoff timestamptz not null,
  time_tbd boolean not null default false,
  away text not null references public.nfl_teams (abbr),
  home text not null references public.nfl_teams (abbr),
  away_score int,
  home_score int,
  overtime boolean not null default false,
  neutral boolean not null default false,
  spread_line numeric,
  total_line numeric,
  away_ml int,
  home_ml int,
  div_game boolean not null default false,
  stadium text,
  roof text,
  away_qb text,
  home_qb text,
  updated_at timestamptz not null default now()
);
create index if not exists nfl_games_season_week on public.nfl_games (season, week);

alter table public.nfl_teams enable row level security;
alter table public.nfl_games enable row level security;
create policy "public read" on public.nfl_teams for select using (true);
create policy "public read" on public.nfl_games for select using (true);

create or replace function public.rpc_upsert_nfl_teams(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_teams (abbr, franchise, name, conference, division, color, color2, logo)
  select r->>'abbr', r->>'franchise', r->>'name', r->>'conference', r->>'division',
         r->>'color', r->>'color2', r->>'logo'
  from jsonb_array_elements(p_rows) r
  on conflict (abbr) do update set
    franchise = excluded.franchise, name = excluded.name, conference = excluded.conference,
    division = excluded.division, color = excluded.color, color2 = excluded.color2, logo = excluded.logo;
  get diagnostics n = row_count;
  return n;
end $$;

-- A score once recorded is never blanked by a later feed row (Gildrur 5);
-- closing lines likewise survive a feed that drops them after kickoff.
create or replace function public.rpc_upsert_nfl_games(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_games as g (
    game_id, season, game_type, week, kickoff, time_tbd, away, home, away_score, home_score,
    overtime, neutral, spread_line, total_line, away_ml, home_ml, div_game, stadium, roof,
    away_qb, home_qb, updated_at)
  select r->>'game_id', (r->>'season')::int, r->>'game_type', (r->>'week')::int,
         (r->>'kickoff')::timestamptz, (r->>'time_tbd')::boolean, r->>'away', r->>'home',
         (r->>'away_score')::int, (r->>'home_score')::int, (r->>'overtime')::boolean,
         (r->>'neutral')::boolean, (r->>'spread_line')::numeric, (r->>'total_line')::numeric,
         (r->>'away_ml')::int, (r->>'home_ml')::int, (r->>'div_game')::boolean,
         r->>'stadium', r->>'roof', r->>'away_qb', r->>'home_qb', now()
  from jsonb_array_elements(p_rows) r
  on conflict (game_id) do update set
    season = excluded.season, game_type = excluded.game_type, week = excluded.week,
    kickoff = excluded.kickoff, time_tbd = excluded.time_tbd,
    away = excluded.away, home = excluded.home,
    away_score = coalesce(excluded.away_score, g.away_score),
    home_score = coalesce(excluded.home_score, g.home_score),
    overtime = excluded.overtime or g.overtime, neutral = excluded.neutral,
    spread_line = coalesce(excluded.spread_line, g.spread_line),
    total_line = coalesce(excluded.total_line, g.total_line),
    away_ml = coalesce(excluded.away_ml, g.away_ml),
    home_ml = coalesce(excluded.home_ml, g.home_ml),
    div_game = excluded.div_game, stadium = excluded.stadium, roof = excluded.roof,
    away_qb = coalesce(excluded.away_qb, g.away_qb), home_qb = coalesce(excluded.home_qb, g.home_qb),
    updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

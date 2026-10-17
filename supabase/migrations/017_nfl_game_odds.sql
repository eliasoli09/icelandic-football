-- Over/under and spread prices, so slips can carry game totals at the
-- bookmaker's own price. Older callers that do not send them keep what is stored.

alter table public.nfl_games
  add column over_odds int,
  add column under_odds int,
  add column home_spread_odds int,
  add column away_spread_odds int;

create or replace function public.rpc_upsert_nfl_games(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_games as g (
    game_id, season, game_type, week, kickoff, time_tbd, away, home, away_score, home_score,
    overtime, neutral, spread_line, total_line, away_ml, home_ml, div_game, stadium, roof,
    away_qb, home_qb, over_odds, under_odds, home_spread_odds, away_spread_odds, updated_at)
  select r->>'game_id', (r->>'season')::int, r->>'game_type', (r->>'week')::int,
         (r->>'kickoff')::timestamptz, (r->>'time_tbd')::boolean, r->>'away', r->>'home',
         (r->>'away_score')::int, (r->>'home_score')::int, (r->>'overtime')::boolean,
         (r->>'neutral')::boolean, (r->>'spread_line')::numeric, (r->>'total_line')::numeric,
         (r->>'away_ml')::int, (r->>'home_ml')::int, (r->>'div_game')::boolean,
         r->>'stadium', r->>'roof', r->>'away_qb', r->>'home_qb',
         (r->>'over_odds')::int, (r->>'under_odds')::int, (r->>'home_spread_odds')::int, (r->>'away_spread_odds')::int, now()
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
    over_odds = coalesce(excluded.over_odds, g.over_odds),
    under_odds = coalesce(excluded.under_odds, g.under_odds),
    home_spread_odds = coalesce(excluded.home_spread_odds, g.home_spread_odds),
    away_spread_odds = coalesce(excluded.away_spread_odds, g.away_spread_odds),
    div_game = excluded.div_game, stadium = excluded.stadium, roof = excluded.roof,
    away_qb = coalesce(excluded.away_qb, g.away_qb), home_qb = coalesce(excluded.home_qb, g.home_qb),
    updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

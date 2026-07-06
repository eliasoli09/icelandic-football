-- Write-access RPCs (security definer), guarded by a secret stored in
-- private.config under key 'cron_secret'. The web app calls these with the
-- anon key + CRON_SECRET — no service role key needed anywhere.
-- After applying, set the secret (NOT committed to the repo):
--   insert into private.config (key, value) values ('cron_secret', '<CRON_SECRET>')
--   on conflict (key) do update set value = excluded.value;

create schema if not exists private;
create table if not exists private.config (key text primary key, value text not null);

create or replace function public.assert_secret(p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.config where key = 'cron_secret' and value = p_secret) then
    raise exception 'unauthorized';
  end if;
end $$;

create or replace function public.rpc_ensure_team(p_secret text, p_name text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_id int;
begin
  perform public.assert_secret(p_secret);
  select id into v_id from public.teams where name = p_name;
  if v_id is null then
    insert into public.teams (name) values (p_name) returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.rpc_upsert_matches(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.matches (id, season, league, phase, date, venue, home_team, away_team, home_goals, away_goals, status, updated_at)
  select (r->>'id')::bigint, (r->>'season')::int, r->>'league', r->>'phase',
         nullif(r->>'date','')::timestamptz, r->>'venue',
         (r->>'home_team')::int, (r->>'away_team')::int,
         (r->>'home_goals')::int, (r->>'away_goals')::int, r->>'status', now()
  from jsonb_array_elements(p_rows) r
  on conflict (id) do update set
    date = excluded.date, venue = excluded.venue,
    home_goals = excluded.home_goals, away_goals = excluded.away_goals,
    status = excluded.status, updated_at = now();
  get diagnostics n = row_count;
  -- drop synthetic fixture rows once the real KSÍ match row exists
  delete from public.predictions p where p.match_id in (
    select m.id from public.matches m
    where m.id < 0 and exists (
      select 1 from public.matches r
      where r.id > 0 and r.season = m.season and r.league = m.league
        and r.phase = m.phase and r.home_team = m.home_team and r.away_team = m.away_team
    )
  );
  delete from public.matches m
  where m.id < 0 and exists (
    select 1 from public.matches r
    where r.id > 0 and r.season = m.season and r.league = m.league
      and r.phase = m.phase and r.home_team = m.home_team and r.away_team = m.away_team
  );
  return n;
end $$;

create or replace function public.rpc_upsert_events(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.match_events (event_id, match_id, minute, type, player_ksi_id, player_name, side)
  select (r->>'event_id')::bigint, (r->>'match_id')::bigint, (r->>'minute')::int,
         r->>'type', (r->>'player_ksi_id')::bigint, r->>'player_name', r->>'side'
  from jsonb_array_elements(p_rows) r
  on conflict (event_id, type, player_name) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.rpc_upsert_players(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.players (ksi_id, name)
  select (r->>'ksi_id')::bigint, r->>'name'
  from jsonb_array_elements(p_rows) r
  on conflict (ksi_id) do update set name = excluded.name;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.rpc_replace(p_secret text, p_table text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0;
begin
  perform public.assert_secret(p_secret);
  if p_table not in ('team_elo','player_elo','predictions','season_sim','scorer_sim') then
    raise exception 'table not allowed';
  end if;
  execute format('delete from public.%I where true', p_table);
  if p_table = 'team_elo' then
    insert into public.team_elo (team_id, match_id, date, elo_before, elo_after)
    select (r->>'team_id')::int, (r->>'match_id')::bigint, nullif(r->>'date','')::timestamptz,
           (r->>'elo_before')::real, (r->>'elo_after')::real
    from jsonb_array_elements(p_rows) r;
  elsif p_table = 'player_elo' then
    insert into public.player_elo (player_ksi_id, match_id, elo_before, elo_after)
    select (r->>'player_ksi_id')::bigint, (r->>'match_id')::bigint,
           (r->>'elo_before')::real, (r->>'elo_after')::real
    from jsonb_array_elements(p_rows) r;
  elsif p_table = 'predictions' then
    insert into public.predictions (match_id, p_home, p_draw, p_away, lambda_home, lambda_away, factors, computed_at)
    select (r->>'match_id')::bigint, (r->>'p_home')::real, (r->>'p_draw')::real, (r->>'p_away')::real,
           (r->>'lambda_home')::real, (r->>'lambda_away')::real, r->'factors', now()
    from jsonb_array_elements(p_rows) r;
  elsif p_table = 'season_sim' then
    insert into public.season_sim (season, league, team_id, pos_probs, p_title, p_europe, p_relegation, run_at)
    select (r->>'season')::int, r->>'league', (r->>'team_id')::int, r->'pos_probs',
           (r->>'p_title')::real, (r->>'p_europe')::real, (r->>'p_relegation')::real, now()
    from jsonb_array_elements(p_rows) r;
  elsif p_table = 'scorer_sim' then
    insert into public.scorer_sim (season, name, kind, current, projected, p_win, run_at)
    select (r->>'season')::int, r->>'name', r->>'kind', (r->>'current')::int,
           (r->>'projected')::real, (r->>'p_win')::real, now()
    from jsonb_array_elements(p_rows) r;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.rpc_log_ingest(p_secret text, p_new_matches int, p_new_events int, p_warnings jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_secret(p_secret);
  insert into public.ingest_log (new_matches, new_events, warnings)
  values (p_new_matches, p_new_events, p_warnings);
end $$;

revoke all on all functions in schema public from public;
grant execute on function public.rpc_ensure_team(text, text) to anon, authenticated;
grant execute on function public.rpc_upsert_matches(text, jsonb) to anon, authenticated;
grant execute on function public.rpc_upsert_events(text, jsonb) to anon, authenticated;
grant execute on function public.rpc_upsert_players(text, jsonb) to anon, authenticated;
grant execute on function public.rpc_replace(text, text, jsonb) to anon, authenticated;
grant execute on function public.rpc_log_ingest(text, int, int, jsonb) to anon, authenticated;

-- Markaðurinn: one ranked snapshot of every fantasy offence player after each
-- completed regular-season round. Written whole per round by the NFL cron.

create table public.nfl_market (
  season int not null,
  week int not null,
  player_id text not null references public.nfl_players (player_id),
  position text not null check (position in ('QB', 'RB', 'WR', 'TE')),
  team text not null,
  games int not null,
  proj real not null,
  games_left int not null,
  value real not null,
  rank int not null,
  pos_rank int not null,
  primary key (season, week, player_id)
);
create index nfl_market_rank_idx on public.nfl_market (season, week, rank);
alter table public.nfl_market enable row level security;
create policy "market is public" on public.nfl_market for select using (true);
-- writes only through the function below

create or replace function public.rpc_replace_nfl_market(p_secret text, p_season int, p_week int, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  delete from public.nfl_market where season = p_season and week = p_week;
  insert into public.nfl_market (season, week, player_id, position, team, games, proj, games_left, value, rank, pos_rank)
  select p_season, p_week, r->>'player_id', r->>'position', r->>'team', (r->>'games')::int, (r->>'proj')::real,
         (r->>'games_left')::int, (r->>'value')::real, (r->>'rank')::int, (r->>'pos_rank')::int
  from jsonb_array_elements(p_rows) r
  where exists (select 1 from public.nfl_players p where p.player_id = r->>'player_id');
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.rpc_replace_nfl_market(text, int, int, jsonb) from public;
grant execute on function public.rpc_replace_nfl_market(text, int, int, jsonb) to anon, authenticated;

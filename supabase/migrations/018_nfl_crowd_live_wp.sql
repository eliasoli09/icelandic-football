-- 1. Hvað velja Íslendingar? How many chose each side of a game, from the pick'em
-- and the per-game polls together. Counts only: no one's pick is shown, before
-- or after kickoff, and the tables keep their own row level security.
create or replace function public.rpc_nfl_crowd(p_games text[]) returns table (game_id text, home int, away int)
language sql stable security definer set search_path = '' as $$
  select g.game_id,
         (count(*) filter (where x.pick = g.home))::int,
         (count(*) filter (where x.pick = g.away))::int
  from public.nfl_games g
  join (select p.game_id, p.pick from public.nfl_pick p where p.game_id = any (p_games)
        union all
        select v.game_id, v.pick from public.nfl_poll_vote v where v.game_id = any (p_games)) x on x.game_id = g.game_id
  where g.game_id = any (p_games)
  group by g.game_id
  -- before kickoff only once five have chosen, so a count never gives one person's pick away
  having count(*) >= 5 or not public.nfl_game_open(g.game_id)
$$;
grant execute on function public.rpc_nfl_crowd(text[]) to anon, authenticated;

-- 2. Sigurlíkur í beinni: one point per game per poll of the live feed, written by
-- the live route with the cron secret, read by anyone.
create table public.nfl_live_wp (
  game_id text not null references public.nfl_games (game_id) on delete cascade,
  at timestamptz not null default now(),
  -- 0 at kickoff, 1 at the end of regulation (overtime stays near 1)
  progress real not null check (progress between 0 and 1),
  home_score int not null,
  away_score int not null,
  status text not null,
  p_home real not null check (p_home between 0 and 1),
  primary key (game_id, at)
);
alter table public.nfl_live_wp enable row level security;
create policy "anyone reads live win chances" on public.nfl_live_wp for select using (true);

create or replace function public.rpc_nfl_live_wp_add(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  -- a point only when something moved: the same score, status and chance as the last point is skipped
  insert into public.nfl_live_wp (game_id, progress, home_score, away_score, status, p_home)
  select r->>'game_id', (r->>'progress')::real, (r->>'home_score')::int, (r->>'away_score')::int, r->>'status', (r->>'p_home')::real
  from jsonb_array_elements(p_rows) r
  where not exists (
    select 1 from (select w.* from public.nfl_live_wp w where w.game_id = r->>'game_id' order by w.at desc limit 1) last
    where last.home_score = (r->>'home_score')::int and last.away_score = (r->>'away_score')::int
      and last.status = r->>'status' and abs(last.p_home - (r->>'p_home')::real) < 0.005 and abs(last.progress - (r->>'progress')::real) < 0.01);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.rpc_nfl_live_wp_add(text, jsonb) from public;
grant execute on function public.rpc_nfl_live_wp_add(text, jsonb) to anon, authenticated;

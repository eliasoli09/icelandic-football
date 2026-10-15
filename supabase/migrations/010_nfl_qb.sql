-- Quarterback adjustment to NFL Elo: each side's starter and the Elo points
-- the model adds for him (lib/nfl/qbElo.ts). The current season only,
-- replaced whole by the NFL cron after the Elo rebuild.

create table if not exists public.nfl_game_qb (
  season int not null,
  game_id text not null,
  team text not null,
  qb_id text not null,
  qb text,
  adj real not null,
  primary key (game_id, team)
);
create index if not exists nfl_game_qb_season on public.nfl_game_qb (season);

alter table public.nfl_game_qb enable row level security;
create policy "public read" on public.nfl_game_qb for select using (true);

-- Delete and insert in one call: a reader sees the old rows or the new ones.
create or replace function public.rpc_replace_nfl_game_qb(p_secret text, p_season int, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  delete from public.nfl_game_qb where season = p_season;
  insert into public.nfl_game_qb (season, game_id, team, qb_id, qb, adj)
  select p_season, r->>'game_id', r->>'team', r->>'qb_id', r->>'qb', (r->>'adj')::real
  from jsonb_array_elements(p_rows) r;
  get diagnostics n = row_count;
  return n;
end $$;

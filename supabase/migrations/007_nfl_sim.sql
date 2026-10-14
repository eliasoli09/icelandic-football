-- NFL season simulation: one row per club for the current season, replaced
-- whole by the NFL cron after the Elo rebuild.

create table if not exists public.nfl_sim (
  season int not null,
  team text not null references public.nfl_teams (abbr),
  p_div numeric not null,
  p_playoffs numeric not null,
  p_bye numeric not null,
  p_seed numeric[] not null,
  p_round2 numeric not null,
  p_round3 numeric not null,
  p_sb numeric not null,
  p_title numeric not null,
  sims int not null,
  run_at timestamptz not null default now(),
  primary key (season, team)
);

alter table public.nfl_sim enable row level security;
create policy "public read" on public.nfl_sim for select using (true);

-- Delete and insert in one function call, i.e. one transaction: a reader sees
-- the old simulation or the new one, never half of each.
create or replace function public.rpc_replace_nfl_sim(p_secret text, p_season int, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  delete from public.nfl_sim where season = p_season;
  insert into public.nfl_sim (season, team, p_div, p_playoffs, p_bye, p_seed, p_round2, p_round3, p_sb, p_title, sims, run_at)
  select p_season, r->>'team', (r->>'p_div')::numeric, (r->>'p_playoffs')::numeric, (r->>'p_bye')::numeric,
         array(select jsonb_array_elements_text(r->'p_seed')::numeric),
         (r->>'p_round2')::numeric, (r->>'p_round3')::numeric, (r->>'p_sb')::numeric, (r->>'p_title')::numeric,
         (r->>'sims')::int, now()
  from jsonb_array_elements(p_rows) r;
  get diagnostics n = row_count;
  return n;
end $$;

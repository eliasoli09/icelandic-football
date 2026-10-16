-- NFL pick'em (/nfl/spa): picks, tiebreaks and private leagues. Writes come
-- from the browser as the signed-in person, like game_result: row level
-- security lets each person write only their own rows, and only before the
-- game starts. Leagues go through security-definer functions.

create table public.nfl_pick (
  player uuid not null references public.game_user (id) on delete cascade,
  game_id text not null references public.nfl_games (game_id) on delete cascade,
  pick text not null,
  updated_at timestamptz not null default now(),
  primary key (player, game_id)
);
create index nfl_pick_game_idx on public.nfl_pick (game_id);

create table public.nfl_tiebreak (
  player uuid not null references public.game_user (id) on delete cascade,
  season int not null,
  week int not null,
  total int not null check (total between 0 and 150),
  updated_at timestamptz not null default now(),
  primary key (player, season, week)
);

create table public.nfl_league (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  owner uuid not null references public.game_user (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.nfl_league_member (
  league uuid not null references public.nfl_league (id) on delete cascade,
  player uuid not null references public.game_user (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league, player)
);
create index nfl_league_member_player_idx on public.nfl_league_member (player);

alter table public.nfl_pick enable row level security;
alter table public.nfl_tiebreak enable row level security;
alter table public.nfl_league enable row level security;
alter table public.nfl_league_member enable row level security;

-- A game is open while it has not started and has no result.
create or replace function public.nfl_game_open(p_game text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nfl_games g
                 where g.game_id = p_game and g.kickoff > now() and g.home_score is null and g.away_score is null)
$$;

-- The round's last game (by kickoff) has not started: its total is the tiebreak.
create or replace function public.nfl_tiebreak_open(p_season int, p_week int) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select max(g.kickoff) > now() from public.nfl_games g where g.season = p_season and g.week = p_week), false)
$$;

create or replace function public.nfl_pick_valid(p_game text, p_pick text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nfl_games g where g.game_id = p_game and p_pick in (g.home, g.away))
$$;

-- picks: your own always, everyone's once the game has started
create policy "own picks, others after kickoff" on public.nfl_pick for select
  using (auth.uid() = player or not public.nfl_game_open(game_id));
create policy "pick before kickoff" on public.nfl_pick for insert
  with check (auth.uid() = player and public.nfl_game_open(game_id) and public.nfl_pick_valid(game_id, pick));
create policy "change a pick before kickoff" on public.nfl_pick for update
  using (auth.uid() = player and public.nfl_game_open(game_id))
  with check (auth.uid() = player and public.nfl_game_open(game_id) and public.nfl_pick_valid(game_id, pick));
create policy "drop a pick before kickoff" on public.nfl_pick for delete
  using (auth.uid() = player and public.nfl_game_open(game_id));

create policy "own tiebreaks, others after the last kickoff" on public.nfl_tiebreak for select
  using (auth.uid() = player or not public.nfl_tiebreak_open(season, week));
create policy "tiebreak before the last kickoff" on public.nfl_tiebreak for insert
  with check (auth.uid() = player and public.nfl_tiebreak_open(season, week));
create policy "change a tiebreak before the last kickoff" on public.nfl_tiebreak for update
  using (auth.uid() = player and public.nfl_tiebreak_open(season, week))
  with check (auth.uid() = player and public.nfl_tiebreak_open(season, week));

-- A policy that reads its own table recurses, so membership is checked here.
create or replace function public.is_nfl_league_member(p_league uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nfl_league_member m where m.league = p_league and m.player = auth.uid())
$$;

create policy "members see their league" on public.nfl_league for select
  using (public.is_nfl_league_member(id));
create policy "members see each other" on public.nfl_league_member for select
  using (public.is_nfl_league_member(league));
create policy "leave a league" on public.nfl_league_member for delete
  using (auth.uid() = player);
-- no insert policies: leagues are created and joined through the functions below

create or replace function public.rpc_create_nfl_league(p_name text) returns table (id uuid, code text)
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); l public.nfl_league;
begin
  if me is null then raise exception 'Skráðu þig inn fyrst'; end if;
  if not exists (select 1 from public.game_user u where u.id = me) then raise exception 'Veldu nafn fyrst'; end if;
  if (select count(*) from public.nfl_league x where x.owner = me) >= 10 then raise exception 'Þú getur stofnað mest 10 deildir'; end if;
  insert into public.nfl_league (name, owner) values (btrim(p_name), me) returning * into l;
  insert into public.nfl_league_member (league, player) values (l.id, me);
  return query select l.id, l.code;
end $$;

create or replace function public.rpc_join_nfl_league(p_code text) returns table (id uuid, name text)
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); l public.nfl_league;
begin
  if me is null then raise exception 'Skráðu þig inn fyrst'; end if;
  if not exists (select 1 from public.game_user u where u.id = me) then raise exception 'Veldu nafn fyrst'; end if;
  select * into l from public.nfl_league x where x.code = lower(btrim(p_code));
  if l.id is null then raise exception 'Boðstengillinn er ógildur'; end if;
  if (select count(*) from public.nfl_league_member m where m.league = l.id) >= 500 then raise exception 'Deildin er full'; end if;
  insert into public.nfl_league_member (league, player) values (l.id, me) on conflict do nothing;
  return query select l.id, l.name;
end $$;

revoke all on function public.rpc_create_nfl_league(text) from public, anon;
revoke all on function public.rpc_join_nfl_league(text) from public, anon;
grant execute on function public.rpc_create_nfl_league(text) to authenticated;
grant execute on function public.rpc_join_nfl_league(text) to authenticated;

-- One row per pick in a played game. RLS on nfl_pick applies: every pick in a
-- played game is visible, since the game has started.
create view public.nfl_pick_points with (security_invoker = true) as
select p.player, p.game_id, p.pick, g.season, g.week,
  case when g.home_score = g.away_score then 0.5
       when p.pick = case when g.home_score > g.away_score then g.home else g.away end then 1
       else 0 end::numeric as points
from public.nfl_pick p
join public.nfl_games g using (game_id)
where g.home_score is not null and g.away_score is not null;

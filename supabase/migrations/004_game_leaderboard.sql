-- The leaderboard for the games: real people, their names and what they finished.
-- Applied 19 September 2026. Writes come from the browser as the signed-in
-- person; row level security lets each person write only their own rows, so no
-- secret and no service key is involved.

create table public.game_user (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 24),
  created_at timestamptz not null default now()
);
create unique index game_user_name_key on public.game_user (lower(btrim(name)));

-- One finished puzzle per person. The first result stands: a puzzle cannot be
-- replayed onto the board, so neither the wins nor the percentage can be farmed.
create table public.game_result (
  id bigint generated always as identity primary key,
  player uuid not null references public.game_user(id) on delete cascade,
  game text not null check (game in ('tenaball', 'hver', 'byrjunarlid', 'bikar')),
  puzzle text not null check (char_length(puzzle) between 1 and 80),
  won boolean not null,
  detail jsonb,
  created_at timestamptz not null default now(),
  unique (player, game, puzzle)
);
create index game_result_player_idx on public.game_result (player);

alter table public.game_user enable row level security;
alter table public.game_result enable row level security;

-- the board shows names and results, so both are readable by anyone
create policy "names are public" on public.game_user for select using (true);
create policy "a person writes their own name" on public.game_user for insert with check (auth.uid() = id);
create policy "a person changes their own name" on public.game_user for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "results are public" on public.game_result for select using (true);
create policy "a person records their own result" on public.game_result for insert with check (auth.uid() = player);
-- deliberately no update or delete policy: a recorded result stands

create view public.leaderboard with (security_invoker = true) as
select u.id,
       u.name,
       count(*)::int as played,
       count(*) filter (where r.won)::int as won,
       round(100.0 * count(*) filter (where r.won) / count(*))::int as win_pct,
       max(r.created_at) as last_played
from public.game_user u
join public.game_result r on r.player = u.id
group by u.id, u.name;

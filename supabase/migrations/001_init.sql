-- Icelandic football analytics schema
create table teams (
  id serial primary key,
  name text unique not null,            -- KSÍ canonical, e.g. 'Víkingur R.'
  sofascore_name text
);

create table matches (
  id bigint primary key,                -- KSÍ leikur id
  season int not null,
  league text not null check (league in ('besta','lengjudeild')),
  phase text not null default 'main' check (phase in ('main','efri','nedri','umspil')),
  date timestamptz,
  venue text,
  home_team int references teams(id) not null,
  away_team int references teams(id) not null,
  home_goals int,
  away_goals int,
  status text not null default 'played' check (status in ('played','upcoming')),
  corrected boolean not null default false,
  updated_at timestamptz not null default now()
);
create index matches_season_idx on matches (season, league, status);

create table players (
  ksi_id bigint primary key,
  name text not null,
  team_id int references teams(id)
);

create table match_events (
  event_id bigint not null,
  match_id bigint references matches(id) not null,
  minute int not null,
  type text not null check (type in ('goal','owngoal','penalty','yellow','red','sub_in','sub_out')),
  player_ksi_id bigint,
  player_name text not null,
  side text not null check (side in ('home','away')),
  primary key (event_id, type, player_name)
);
create index match_events_match_idx on match_events (match_id);

create table team_elo (
  team_id int references teams(id) not null,
  match_id bigint references matches(id) not null,
  date timestamptz,
  elo_before real not null,
  elo_after real not null,
  primary key (team_id, match_id)
);

create table player_elo (
  player_ksi_id bigint not null,
  match_id bigint references matches(id) not null,
  elo_before real not null,
  elo_after real not null,
  primary key (player_ksi_id, match_id)
);

create table sofascore_team_stats (
  team_id int references teams(id),
  season int,
  stats jsonb not null,
  loaded_at timestamptz default now(),
  primary key (team_id, season)
);

create table sofascore_players (
  season int not null,
  rank int,
  name text not null,
  team text,
  rating real,
  appearances int,
  goals int,
  assists int,
  extra jsonb,
  loaded_at timestamptz default now(),
  primary key (season, name)
);

create table predictions (
  match_id bigint primary key references matches(id),
  p_home real, p_draw real, p_away real,
  lambda_home real, lambda_away real,
  factors jsonb,
  computed_at timestamptz default now()
);

create table season_sim (
  season int not null,
  league text not null,
  team_id int references teams(id) not null,
  pos_probs jsonb not null,
  p_title real not null,
  p_europe real not null,
  p_relegation real not null,
  run_at timestamptz default now(),
  primary key (season, league, team_id)
);

create table scorer_sim (
  season int not null,
  name text not null,
  kind text not null check (kind in ('goals','assists')),
  current int not null,
  projected real not null,
  p_win real not null,
  run_at timestamptz default now(),
  primary key (season, name, kind)
);

create table ingest_log (
  id bigserial primary key,
  run_at timestamptz default now(),
  new_matches int not null default 0,
  new_events int not null default 0,
  warnings jsonb
);

-- RLS: public read, writes only via service role
do $$
declare t text;
begin
  foreach t in array array['teams','matches','players','match_events','team_elo',
    'player_elo','sofascore_team_stats','sofascore_players','predictions',
    'season_sim','scorer_sim','ingest_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
end $$;

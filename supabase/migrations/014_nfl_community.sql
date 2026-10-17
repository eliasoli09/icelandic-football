-- Phase 4: the Icelandic angle and the community. TV listings (editors),
-- a favourite team per account and fan counts, polls on games (anonymous,
-- through a function), and comments with reports and moderation.

-- 1. Í sjónvarpinu
create table public.nfl_broadcast (
  game_id text primary key references public.nfl_games (game_id) on delete cascade,
  channel text not null check (char_length(btrim(channel)) between 2 and 40),
  note text not null default '' check (char_length(note) <= 120),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.nfl_broadcast enable row level security;
create policy "listings are public" on public.nfl_broadcast for select using (true);
create policy "editors list games" on public.nfl_broadcast for insert with check (public.is_nfl_editor());
create policy "editors change listings" on public.nfl_broadcast for update using (public.is_nfl_editor()) with check (public.is_nfl_editor());
create policy "editors remove listings" on public.nfl_broadcast for delete using (public.is_nfl_editor());

-- 2. Liðið mitt: one club per account; who backs whom stays private, the totals are public
create table public.nfl_fan (
  user_id uuid primary key references public.game_user (id) on delete cascade,
  team text not null check (team ~ '^[A-Z]{2,3}$'),
  updated_at timestamptz not null default now()
);
alter table public.nfl_fan enable row level security;
create policy "own club" on public.nfl_fan for select using (auth.uid() = user_id);
create policy "choose a club" on public.nfl_fan for insert with check (auth.uid() = user_id);
create policy "change club" on public.nfl_fan for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "drop club" on public.nfl_fan for delete using (auth.uid() = user_id);

create or replace function public.rpc_nfl_fan_counts() returns table (team text, fans int)
language sql stable security definer set search_path = '' as $$
  select f.team, count(*)::int from public.nfl_fan f group by f.team order by 2 desc, 1
$$;

-- 3. Kannanir: one vote per device per game, changeable until kickoff, only through the function
create table public.nfl_poll_vote (
  game_id text not null references public.nfl_games (game_id) on delete cascade,
  device uuid not null,
  pick text not null,
  ip_hash text,
  voted_at timestamptz not null default now(),
  primary key (game_id, device)
);
create index nfl_poll_vote_ip_idx on public.nfl_poll_vote (game_id, ip_hash);
alter table public.nfl_poll_vote enable row level security;
-- no policies: votes are cast and counted through the functions below

create or replace function public.rpc_nfl_poll_counts(p_games text[]) returns table (game_id text, home int, away int)
language sql stable security definer set search_path = '' as $$
  select v.game_id,
         count(*) filter (where v.pick = g.home)::int,
         count(*) filter (where v.pick = g.away)::int
  from public.nfl_poll_vote v join public.nfl_games g using (game_id)
  where v.game_id = any (p_games)
  group by v.game_id
$$;

create or replace function public.rpc_nfl_poll_vote(p_game text, p_pick text, p_device uuid) returns table (home int, away int)
language plpgsql security definer set search_path = '' as $$
declare
  h json := nullif(current_setting('request.headers', true), '')::json;
  ip text := btrim(split_part(coalesce(h->>'cf-connecting-ip', h->>'x-real-ip', h->>'x-forwarded-for', ''), ',', 1));
  v_hash text := case when ip = '' then null else md5(ip || ':' || p_game || ':nfl-poll') end;
begin
  if not public.nfl_game_open(p_game) then raise exception 'Leikurinn er hafinn'; end if;
  if not public.nfl_pick_valid(p_game, p_pick) then raise exception 'Ógilt lið'; end if;
  -- a handful of devices per network (a home, an office); a script making new devices hits the wall
  if v_hash is not null and (select count(*) from public.nfl_poll_vote v where v.game_id = p_game and v.ip_hash = v_hash and v.device <> p_device) >= 8 then
    raise exception 'Of mörg atkvæði frá sama neti';
  end if;
  insert into public.nfl_poll_vote (game_id, device, pick, ip_hash) values (p_game, p_device, p_pick, v_hash)
  on conflict (game_id, device) do update set pick = excluded.pick, voted_at = now();
  return query select c.home, c.away from public.rpc_nfl_poll_counts(array[p_game]) c;
end $$;

-- 4. Athugasemdir
create table public.nfl_comment (
  id bigint generated always as identity primary key,
  target text not null check (target ~ '^(grein|leikur):[A-Za-z0-9_-]{1,100}$'),
  author uuid not null references public.game_user (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  hidden boolean not null default false,
  reports int not null default 0,
  created_at timestamptz not null default now()
);
create index nfl_comment_target_idx on public.nfl_comment (target, created_at);
create index nfl_comment_author_idx on public.nfl_comment (author, created_at);

create table public.nfl_comment_report (
  comment_id bigint not null references public.nfl_comment (id) on delete cascade,
  reporter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, reporter)
);

-- ten an hour per person: enough to talk, too few to flood
create or replace function public.nfl_comment_quota_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.nfl_comment c where c.author = auth.uid() and c.created_at > now() - interval '1 hour') < 10
$$;

alter table public.nfl_comment enable row level security;
alter table public.nfl_comment_report enable row level security;
create policy "visible comments" on public.nfl_comment for select
  using (not hidden or author = auth.uid() or public.is_nfl_editor());
create policy "comment as yourself" on public.nfl_comment for insert
  with check (auth.uid() = author and not hidden and reports = 0 and public.nfl_comment_quota_ok());
create policy "delete own or moderate" on public.nfl_comment for delete
  using (auth.uid() = author or public.is_nfl_editor());
create policy "editors moderate" on public.nfl_comment for update
  using (public.is_nfl_editor()) with check (public.is_nfl_editor());
-- reports only through the function below

create or replace function public.rpc_report_nfl_comment(p_id bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null then raise exception 'Skráðu þig inn fyrst'; end if;
  insert into public.nfl_comment_report (comment_id, reporter) values (p_id, me) on conflict do nothing;
  select count(*) into n from public.nfl_comment_report r where r.comment_id = p_id;
  -- three reports hide it until an editor looks
  update public.nfl_comment set reports = n, hidden = hidden or n >= 3 where id = p_id;
  return true;
end $$;

revoke all on function public.rpc_report_nfl_comment(bigint) from public, anon;
grant execute on function public.rpc_report_nfl_comment(bigint) to authenticated;

-- NFL articles: drafts written from the data, edited and published on
-- /ritstjorn. Readers see published articles only. Editors (nfl_editor) read
-- and write everything as themselves; the cron adds drafts and fills in text
-- through secret-guarded functions that never touch an edited or published one.

create table public.nfl_editor (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.nfl_editor enable row level security;
-- no policies: the table is read only through is_nfl_editor()

create or replace function public.is_nfl_editor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.nfl_editor e where e.user_id = auth.uid())
$$;

create table public.nfl_article (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,100}$'),
  kind text not null check (kind in ('upphitun', 'umfjollun', 'vikan', 'grein')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  title text not null default '',
  lede text not null default '',
  body text not null default '',
  season int,
  week int,
  game_id text references public.nfl_games (game_id) on delete set null,
  teams text[] not null default '{}',
  facts jsonb,
  model text,
  edited boolean not null default false,
  author uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index nfl_article_published_idx on public.nfl_article (status, published_at desc);
create index nfl_article_game_idx on public.nfl_article (game_id);

alter table public.nfl_article enable row level security;
create policy "published articles are public" on public.nfl_article for select
  using (status = 'published' or public.is_nfl_editor());
create policy "editors write" on public.nfl_article for insert with check (public.is_nfl_editor());
create policy "editors edit" on public.nfl_article for update using (public.is_nfl_editor()) with check (public.is_nfl_editor());
create policy "editors delete" on public.nfl_article for delete using (public.is_nfl_editor());

-- New drafts, and fresh facts for drafts no editor has touched.
create or replace function public.rpc_upsert_nfl_article_drafts(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_article (slug, kind, season, week, game_id, teams, facts)
  select r->>'slug', r->>'kind', (r->>'season')::int, (r->>'week')::int, r->>'game_id',
         array(select jsonb_array_elements_text(r->'teams')), r->'facts'
  from jsonb_array_elements(p_rows) r
  on conflict (slug) do update set facts = excluded.facts, teams = excluded.teams, updated_at = now()
    where public.nfl_article.status = 'draft' and not public.nfl_article.edited;
  get diagnostics n = row_count;
  return n;
end $$;

-- Machine text for a draft no editor has touched; never for a published one.
create or replace function public.rpc_set_nfl_article_text(p_secret text, p_slug text, p_title text, p_lede text, p_body text, p_model text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  update public.nfl_article set title = p_title, lede = p_lede, body = p_body, model = p_model, updated_at = now()
  where slug = p_slug and status = 'draft' and not edited;
  get diagnostics n = row_count;
  return n;
end $$;

-- Which drafts still wait for machine text: the cron reads with the anon key and
-- cannot see drafts itself.
create or replace function public.rpc_nfl_articles_needing_text(p_secret text) returns table (slug text, kind text, facts jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_secret(p_secret);
  return query select a.slug, a.kind, a.facts from public.nfl_article a
    where a.status = 'draft' and not a.edited and a.body = '' and a.kind <> 'grein' and a.facts is not null
    order by a.created_at limit 40;
end $$;

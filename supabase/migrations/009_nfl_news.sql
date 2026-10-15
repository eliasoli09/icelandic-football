-- NFL news: headline, link and the publisher's short description from RSS,
-- plus our own Icelandic headline and summary. The description is input for
-- the summariser only and is never shown on the site.

create table if not exists public.nfl_news (
  url text primary key,
  source text not null,
  title text not null,
  description text not null default '',
  published_at timestamptz not null,
  teams text[] not null default '{}',
  title_is text,
  summary_is text,
  model text,
  summarized_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists nfl_news_published on public.nfl_news (published_at desc);

alter table public.nfl_news enable row level security;
create policy "public read" on public.nfl_news for select using (true);

-- New items only: an item already stored, summary and all, is left alone.
create or replace function public.rpc_insert_nfl_news(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_news (url, source, title, description, published_at, teams)
  select r->>'url', r->>'source', r->>'title', coalesce(r->>'description', ''), (r->>'published_at')::timestamptz,
         coalesce(array(select jsonb_array_elements_text(r->'teams')), '{}')
  from jsonb_array_elements(p_rows) r
  on conflict (url) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.rpc_set_nfl_news_summary(p_secret text, p_url text, p_title_is text, p_summary_is text, p_model text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  update public.nfl_news set title_is = p_title_is, summary_is = p_summary_is, model = p_model, summarized_at = now()
  where url = p_url;
  get diagnostics n = row_count;
  return n;
end $$;

-- The rumour mill: news items flagged as trade talk (lib/nfl/rumours.ts decides
-- at ingest), a heat an editor can set, and confirmed trades an editor records.

alter table public.nfl_news add column if not exists rumour boolean not null default false;
alter table public.nfl_news add column if not exists heat text check (heat in ('heitt', 'volgt', 'kalt'));
create index if not exists nfl_news_rumour_idx on public.nfl_news (rumour, published_at desc) where rumour;

-- the same rule as isRumour(), for items stored before this column existed
update public.nfl_news set rumour = true
where (title || ' ' || description) ~* '\mtrad(e|es|ed|ing)\M(?!\s+deadline)|\mtrade\s+(talks?|market|block|request|interest|target|candidates?|offers?|chatter|rumou?rs?)\M|\macquir(e|es|ed|ing)\M|\mdeal\s+(for|to\s+acquire|sending)\M|\mshopping\M|\mon\s+the\s+(trading\s+)?block\M|\mswap\M|\min\s+exchange\s+for\M|\mdraft\s+pick\s+compensation\M'
  and (title || ' ' || description) !~* '\mfantasy\M';

create or replace function public.rpc_insert_nfl_news(p_secret text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  insert into public.nfl_news (url, source, title, description, published_at, teams, rumour)
  select r->>'url', r->>'source', r->>'title', coalesce(r->>'description', ''), (r->>'published_at')::timestamptz,
         coalesce(array(select jsonb_array_elements_text(r->'teams')), '{}'), coalesce((r->>'rumour')::boolean, false)
  from jsonb_array_elements(p_rows) r
  on conflict (url) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create policy "editors flag rumours" on public.nfl_news for update
  using (public.is_nfl_editor()) with check (public.is_nfl_editor());

create table public.nfl_trade (
  id uuid primary key default gen_random_uuid(),
  traded_on date not null default current_date,
  moves jsonb not null check (jsonb_typeof(moves) = 'array' and jsonb_array_length(moves) > 0),
  compensation text not null default '',
  source_url text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index nfl_trade_day_idx on public.nfl_trade (traded_on desc);

alter table public.nfl_trade enable row level security;
create policy "trades are public" on public.nfl_trade for select using (true);
create policy "editors record trades" on public.nfl_trade for insert with check (public.is_nfl_editor());
create policy "editors correct trades" on public.nfl_trade for update using (public.is_nfl_editor()) with check (public.is_nfl_editor());
create policy "editors remove trades" on public.nfl_trade for delete using (public.is_nfl_editor());

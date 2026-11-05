-- UTM-merktar heimsóknir á báðar síður. Vercel Analytics sýnir ekki UTM á Hobby,
-- svo /api/utm á hvorri síðu skrifar hér eina röð þegar gestur lendir með merktan hlekk.
-- Engin lesheimild: tölurnar eru lesnar með SQL, ekki á síðunni.

create table public.utm_visit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  site text not null check (site in ('fotbolti', 'snertimark')),
  source text not null check (length(source) between 1 and 100),
  medium text check (length(medium) <= 100),
  campaign text check (length(campaign) <= 100),
  content text check (length(content) <= 100),
  term text check (length(term) <= 100),
  path text check (length(path) <= 300),
  referrer_host text check (length(referrer_host) <= 200),
  country text check (length(country) <= 8)
);
alter table public.utm_visit enable row level security;
create index utm_visit_site_at on public.utm_visit (site, at desc);

create or replace function public.rpc_utm_visit_add(p_secret text, p_row jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_secret(p_secret);
  insert into public.utm_visit (site, source, medium, campaign, content, term, path, referrer_host, country)
  values (p_row->>'site', p_row->>'source', p_row->>'medium', p_row->>'campaign', p_row->>'content',
          p_row->>'term', p_row->>'path', p_row->>'referrer_host', p_row->>'country');
end $$;
revoke all on function public.rpc_utm_visit_add(text, jsonb) from public;
grant execute on function public.rpc_utm_visit_add(text, jsonb) to anon, authenticated;

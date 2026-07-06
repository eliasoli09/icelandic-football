-- History features: belt lineage (Konungur kastalans), all-time H2H and table caches.
create table belt_history (
  match_id bigint primary key references matches(id),
  season int not null,
  date timestamptz,
  holder_before int not null references teams(id),
  challenger int not null references teams(id),
  holder_after int not null references teams(id),
  taken boolean not null
);
create index belt_history_season_idx on belt_history (season);

create table h2h_cache (
  team_a int not null references teams(id),
  team_b int not null references teams(id),
  stats jsonb not null,
  primary key (team_a, team_b)
);

create table alltime_cache (
  team_id int primary key references teams(id),
  stats jsonb not null
);

alter table belt_history enable row level security;
alter table h2h_cache enable row level security;
alter table alltime_cache enable row level security;
create policy "public read" on belt_history for select using (true);
create policy "public read" on h2h_cache for select using (true);
create policy "public read" on alltime_cache for select using (true);

create or replace function public.rpc_replace_history(p_secret text, p_table text, p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0;
begin
  perform public.assert_secret(p_secret);
  if p_table not in ('belt_history','h2h_cache','alltime_cache') then
    raise exception 'table not allowed';
  end if;
  execute format('delete from public.%I where true', p_table);
  if p_table = 'belt_history' then
    insert into public.belt_history (match_id, season, date, holder_before, challenger, holder_after, taken)
    select (r->>'match_id')::bigint, (r->>'season')::int, nullif(r->>'date','')::timestamptz,
           (r->>'holder_before')::int, (r->>'challenger')::int, (r->>'holder_after')::int, (r->>'taken')::boolean
    from jsonb_array_elements(p_rows) r;
  elsif p_table = 'h2h_cache' then
    insert into public.h2h_cache (team_a, team_b, stats)
    select (r->>'team_a')::int, (r->>'team_b')::int, r->'stats'
    from jsonb_array_elements(p_rows) r;
  elsif p_table = 'alltime_cache' then
    insert into public.alltime_cache (team_id, stats)
    select (r->>'team_id')::int, r->'stats'
    from jsonb_array_elements(p_rows) r;
  end if;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.rpc_replace_history(text, text, jsonb) to anon, authenticated;

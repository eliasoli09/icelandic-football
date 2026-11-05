-- Re-read a match's events: rpc_upsert_events does nothing on conflict, so a
-- corrected scrape (minutes, own goals, events KSÍ re-created with a new id)
-- can only land by replacing every event of the match. Rows outside
-- p_match_ids are ignored so one call cannot touch other matches.
create or replace function public.rpc_replace_events(p_secret text, p_match_ids bigint[], p_rows jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.assert_secret(p_secret);
  delete from public.match_events where match_id = any(p_match_ids);
  insert into public.match_events (event_id, match_id, minute, type, player_ksi_id, player_name, side)
  select (r->>'event_id')::bigint, (r->>'match_id')::bigint, (r->>'minute')::int,
         r->>'type', (r->>'player_ksi_id')::bigint, r->>'player_name', r->>'side'
  from jsonb_array_elements(p_rows) r
  where (r->>'match_id')::bigint = any(p_match_ids)
  on conflict (event_id, type, player_name) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function public.rpc_replace_events(text, bigint[], jsonb) to anon, authenticated;

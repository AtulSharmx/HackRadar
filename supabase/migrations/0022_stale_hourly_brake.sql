-- 0022_stale_hourly_brake.sql (P0, 25 Nov 2026)
-- The collector now runs every hour. 0015's "missing in 3 runs" meant 18 h at 6-hourly runs but would be 3 h now,
-- so a source that drops a page for a few hours would hide real open events.
-- Stale now needs both: not seen for 12 h AND missing in at least 3 successful runs of that source (a source that
-- failed or was skipped this hour, like the 6-hourly heavy ones, is not in ok_sources, so nothing is missing).
-- 0015's rule stays too: not seen for 3 days = stale, so events of a switched-off source don't stay open forever.
-- Safety brake: if one run would mark more than 30% of the open events stale, it marks none and returns how many
-- it kept open in stale_blocked; the collector sends the Telegram alert A10 "Data blow-up".

-- a new output column changes the return type, which "create or replace" can't do
drop function if exists public.end_of_run(text[], timestamptz);

create function public.end_of_run(ok_sources text[], run_started timestamptz)
returns table (closed_count integer, stale_count integer, stale_blocked integer)
language plpgsql
set search_path = ''
as $$
declare
  c integer;
  s integer := 0;
  b integer := 0;
  candidates uuid[];
begin
  update public.events set status = 'closed'
  where status = 'open' and registration_deadline < now();
  get diagnostics c = row_count;

  -- only "3 or more" matters; the cap keeps the smallint far from overflowing (hourly = 8,760 runs a year)
  update public.event_sources set missing_runs = missing_runs + 1
  where source = any(ok_sources) and last_seen_at < run_started and missing_runs < 1000;

  select coalesce(array_agg(e.id), '{}') into candidates
  from public.events e
  where e.status = 'open'
    and not exists (   -- no source still vouches for it
      select 1 from public.event_sources es
      where es.event_id = e.id
        and (es.missing_runs < 3 or es.last_seen_at > now() - interval '12 hours')
        and es.last_seen_at > now() - interval '3 days'
    );

  if cardinality(candidates) * 10 > (select count(*) from public.events where status = 'open') * 3 then
    b := cardinality(candidates);
  else
    update public.events set status = 'stale', trust_label = 'stale' where id = any(candidates);
    get diagnostics s = row_count;
  end if;

  return query select c, s, b;
end $$;

revoke all on function public.end_of_run(text[], timestamptz) from public, anon, authenticated;
grant execute on function public.end_of_run(text[], timestamptz) to service_role;

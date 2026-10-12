-- 0015_stale_unseen.sql (launch audit, 10 Oct 2026)
-- An event goes stale when no source has seen it for 3 days, even if that source no longer runs.
-- Before, "missing" was counted only for sources that ran, so events of a switched-off source (Devpost,
-- last seen 29 Sep) stayed "open" forever. 3 days = 12 collector runs, so a short outage of one source
-- does not mark its events stale; anything seen again is reopened by the collector (sync.py).

create or replace function public.end_of_run(ok_sources text[], run_started timestamptz)
returns table (closed_count integer, stale_count integer)
language plpgsql
set search_path = ''
as $$
declare
  c integer;
  s integer;
begin
  update public.events set status = 'closed'
  where status = 'open' and registration_deadline < now();
  get diagnostics c = row_count;

  update public.event_sources set missing_runs = missing_runs + 1
  where source = any(ok_sources) and last_seen_at < run_started;

  update public.events e set status = 'stale', trust_label = 'stale'
  where e.status = 'open'
    and not exists (
      select 1 from public.event_sources s
      where s.event_id = e.id and s.missing_runs < 3 and s.last_seen_at > now() - interval '3 days'
    );
  get diagnostics s = row_count;

  return query select c, s;
end $$;

revoke all on function public.end_of_run(text[], timestamptz) from public, anon, authenticated;
grant execute on function public.end_of_run(text[], timestamptz) to service_role;

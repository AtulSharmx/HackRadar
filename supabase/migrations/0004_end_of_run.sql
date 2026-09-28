-- 0004_end_of_run.sql
-- Called once at the end of every collector run (service key only).
-- ok_sources: sources that fetched successfully this run. A source that failed is NOT counted
-- as "missing", so one outage can't mark all its events stale.

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
      where s.event_id = e.id and s.missing_runs < 3
    );
  get diagnostics s = row_count;

  return query select c, s;
end $$;

-- functions are executable by PUBLIC by default in Postgres; lock it to the collector
revoke all on function public.end_of_run(text[], timestamptz) from public, anon, authenticated;
grant execute on function public.end_of_run(text[], timestamptz) to service_role;

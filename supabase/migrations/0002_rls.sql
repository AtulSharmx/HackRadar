-- 0002_rls.sql

alter table events          enable row level security;
alter table event_sources   enable row level security;
alter table event_changes   enable row level security;
alter table devices         enable row level security;
alter table saved_events    enable row level security;
alter table manual_events   enable row level security;
alter table source_runs     enable row level security;
alter table geocode_cache   enable row level security;
alter table push_tickets    enable row level security;
alter table pending_digest  enable row level security;
alter table review_queue    enable row level security;

-- events and change history: read-only for signed-in app users
create policy events_read on events
  for select to authenticated using (true);

create policy event_changes_read on event_changes
  for select to authenticated using (true);

-- devices: each app user sees and edits only its own row
create policy devices_select_own on devices
  for select to authenticated using (id = (select auth.uid()));
create policy devices_insert_own on devices
  for insert to authenticated with check (id = (select auth.uid()));
create policy devices_update_own on devices
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy devices_delete_own on devices
  for delete to authenticated using (id = (select auth.uid()));

-- saved events: only your own
create policy saved_select_own on saved_events
  for select to authenticated using (device_id = (select auth.uid()));
create policy saved_insert_own on saved_events
  for insert to authenticated with check (device_id = (select auth.uid()));
create policy saved_update_own on saved_events
  for update to authenticated
  using (device_id = (select auth.uid())) with check (device_id = (select auth.uid()));
create policy saved_delete_own on saved_events
  for delete to authenticated using (device_id = (select auth.uid()));

-- all other tables: no policy = no access for anon or authenticated.
-- the collector uses the service role key, which bypasses RLS.

-- grants: "Automatically expose new tables" is OFF in this project,
-- so roles get nothing unless granted here. RLS policies above then filter rows.
grant usage on schema public to authenticated, service_role;
grant select on events, event_changes to authenticated;
grant select, insert, update, delete on devices, saved_events to authenticated;
-- anon (not signed in) gets no table access at all.

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

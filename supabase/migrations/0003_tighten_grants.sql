-- 0003_tighten_grants.sql
-- Supabase still gave anon/authenticated full privileges on every table.
-- Revoke everything, then grant back only what the app needs. RLS stays on top.

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant select on events, event_changes to authenticated;
grant select, insert, update, delete on devices, saved_events to authenticated;

-- future tables/functions created by postgres start closed too
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

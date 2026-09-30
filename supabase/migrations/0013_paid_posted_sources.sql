-- 0013_paid_posted_sources.sql: the Feed's "Paid" filter and "Newest" sort, and the detail screen's source line.

-- true = the source says a fee is charged, even when it gives no amount (Hack2Skill "PAID", Unstop isPaid).
-- A known fee_amount decides it too (> 0 = paid). null = the source says nothing.
alter table public.events add column if not exists is_paid boolean;
-- when the listing went up on the source (Unstop approved_date, Devfolio/Hack2Skill registration start).
-- "Newest" sorts by it; first_seen_at only says when HackRadar found the event (a new source looked "new").
alter table public.events add column if not exists posted_at timestamptz;

update public.events set is_paid = fee_amount > 0 where fee_amount is not null and is_paid is null;

-- "Listed on Unstop and Devfolio · Checked 2 h ago": last_seen_at is written on every collector run, so it is
-- the real check time (events.last_checked_at only moves when something changed). Only these four columns.
grant select (event_id, source, source_url, last_seen_at) on public.event_sources to authenticated;
create policy event_sources_read on public.event_sources for select to authenticated using (true);

-- 0017_submissions_hardening.sql (security review of 0016, 12 Oct 2026)
-- 1. The 5-a-day limit counted created_at, which the client could set to any past date and slip past it.
--    People may now insert only the content columns; id, user_id, created_at, status, review_note and
--    notified always take their defaults. Same for reports (only event, reason and note).
revoke insert on public.submissions from authenticated;
grant insert (title, registration_url, organizer, mode, city, registration_deadline, start_date, end_date,
              fee_amount, prize_text, eligibility_text, themes) on public.submissions to authenticated;
revoke insert on public.reports from authenticated;
grant insert (event_id, reason, note) on public.reports to authenticated;

-- 2. Links go into an HTML message to the admin and into the app: no quotes or angle brackets in them.
alter table public.submissions drop constraint if exists submissions_registration_url_check;
alter table public.submissions add constraint submissions_registration_url_check
  check (registration_url ~ '^https://[^\s/"<>]+\.[^\s"<>]+$' and length(registration_url) <= 500);

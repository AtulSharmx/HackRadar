-- 0016_account_reports_submissions.sql (launch audit, 10 Oct 2026)

-- 1. Delete my account (Play Store requirement). Deleting the auth user cascades to devices, saved_events,
--    push_tokens, push_tickets and pending_digest. Reports and submissions stay (they are about events)
--    but lose the link to the person (on delete set null).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 2. Report wrong info: one report per person, event and reason.
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete set null default auth.uid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  reason      text not null check (reason in ('wrong_dates', 'wrong_place', 'closed', 'fake', 'duplicate', 'other')),
  note        text check (length(note) <= 300),
  created_at  timestamptz not null default now(),
  notified    boolean not null default false,
  unique (user_id, event_id, reason)
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert on public.reports to authenticated;
grant usage on sequence public.reports_id_seq to authenticated;
create policy reports_insert_own on public.reports for insert to authenticated
  with check (user_id = auth.uid() and notified = false);
create policy reports_select_own on public.reports for select to authenticated
  using (user_id = auth.uid());

-- 3. Submit a hackathon: signed-in (not guest) people only, 5 a day, reviewed before it goes live.
--    The collector publishes approved ones as source "community" (collector/community.py).
create table if not exists public.submissions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete set null default auth.uid(),
  title                  text not null check (length(title) between 3 and 200),
  registration_url       text not null check (registration_url ~ '^https://[^\s/]+\.[^\s]+$' and length(registration_url) <= 500),
  organizer              text not null check (length(organizer) between 2 and 150),
  mode                   text not null check (mode in ('online', 'offline', 'hybrid')),
  city                   text check (length(city) <= 80),
  registration_deadline  timestamptz not null,
  start_date             timestamptz,
  end_date               timestamptz,
  fee_amount             integer check (fee_amount between 0 and 100000),
  prize_text             text check (length(prize_text) <= 200),
  eligibility_text       text check (length(eligibility_text) <= 300),
  themes                 text[] not null default '{}',
  status                 text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note            text check (length(review_note) <= 300),
  created_at             timestamptz not null default now(),
  notified               boolean not null default false,
  check (mode = 'online' or city is not null),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists submissions_status_idx on public.submissions (status);
alter table public.submissions enable row level security;
revoke all on public.submissions from anon, authenticated;
grant select, insert on public.submissions to authenticated;
create policy submissions_insert_own on public.submissions for insert to authenticated
  with check (
    user_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and status = 'pending' and review_note is null and notified = false
    and registration_deadline > now()
    and (select count(*) from public.submissions s
         where s.user_id = auth.uid() and s.created_at > now() - interval '1 day') < 5
  );
create policy submissions_select_own on public.submissions for select to authenticated
  using (user_id = auth.uid());

# Plan: HackRadar v2 (from 29 Sep 2026)

Replaces "Implementation Plan HackRadar" (v1; kept in git history). Built so far: collector with Unstop,
dedupe, change tracking, trust labels, geocoding, health and Telegram alerts, running on GitHub every
6 h through Supabase; the app through onboarding, feed, filters, detail and Saved.

Rule: one step at a time, each ends with its Check passing. Tick it here when done.

## A. Data you can trust (first, because everything else shows this data)

- [ ] A1 Unstop detail enrichment: start date, rounds, structured eligibility from `/api/public/competition/{id}` (only for new or changed events, polite rate).
  - Check: event start date filled on 95%+ of Unstop events.
- [ ] A2 Quality gate: "is this a hackathon?" (source category + rules for esports/quiz/olympiad/poster/hiring-only), date sanity, prize outliers → review_queue.
  - Check: no esports/poster events in the feed; the 4 found on 29 Sep are caught.
- [ ] A3 Themes v2 from tags, skills and description.
  - Check: "other" under 15%.
- [ ] A4 Devfolio adapter (fetch_url POST variant, fixture, tests).
  - Check: 25+ Devfolio events live; duplicates with Unstop merged.
- [ ] A5 Terms check, then Hack2Skill and Devnovate adapters.
  - Check: each adds events; no duplicates; health alerts per source.
- [ ] A6 Per-field source precedence in merge (deadline from where registration happens).
  - Check: a test where Devfolio and Unstop disagree picks the right one.
- [ ] A7 App shows facts only: remove the verbatim "About" block from detail.
- [ ] A8 Weekly jobs: quality report on Telegram (per source, per field), retention cleanup, pg_dump backup.
  - Check: Monday's report arrives; backup artifact exists.
- [ ] A9 Send permission emails (docs/outreach.md), add Devfolio, Hack2Skill, Devnovate as courtesy.

## B. Development build and notifications

- [ ] B1 EAS development build (logged in as atulshxrma), install on the phone.
  - Check: the app runs from the dev build with the same features as Expo Go.
- [ ] B2 Reminders: 7 d, 48 h, 24 h before saved deadlines; quiet hours; cancel on unsave; "starts tomorrow" for Registered. Toast text back to the App Flow wording.
  - Check: a test event 25 h away rings the 24 h reminder with the phone locked (Samsung, battery optimisation on and off).
- [ ] B3 Push: push_tokens table + RLS, register the token, collector sends new-match and saved-change pushes via Expo, receipts next run.
  - Check: a new matching event reaches the phone as a push; tapping opens the right screen.
- [ ] B4 Quiet hours and daily digest option.
- [ ] B5 Telegram keeps only admin alerts.

## C. Community supply (the part no other app has)

- [ ] C1 submissions table + RLS (own rows, 5 a day), Submit screen (paste link → prefilled form).
- [ ] C2 Collector link reader with SSRF guard (platform link → JSON-LD → OpenGraph), publish approved submissions.
  - Check: a college event from a Google Form link, approved in the table, appears in the feed after the next run.
- [ ] C3 Telegram message per pending submission; organizer_verified flag and badge.
- [ ] C4 Report wrong info (reports table + sheet on detail).
  - Check: a report lands in review_queue with the reason.
- [ ] C5 Share text (with Play Store link) and Add to calendar.

## D. Accounts and settings

- [ ] D1 Google sign-in and email code, linking the guest account (same user id, saves kept).
- [ ] D2 Settings: preferences, location, notifications, hide warnings, privacy notice, Delete my data (in app + web URL).
  - Check: Delete my data removes server rows and returns to onboarding.

## E. Polish and launch

- [ ] E1 Both themes, largest font, TalkBack, reduce motion, performance on the longest list.
- [ ] E2 Extend the RLS check script to submissions, reports, push_tokens; security review.
- [ ] E3 Play Console: app listing, privacy policy page, Data safety form, signing key backed up.
- [ ] E4 Closed test: 12+ testers for 14 continuous days (college friends, one club). Track misses.
- [ ] E5 Fix what the test finds, then public release.
- [ ] E6 After launch: weekly metrics from PRD (coverage, wrong-info rate, saves, submissions).

## Progress log
- 29 Sep 2026: v2 docs written; collector moved to fetch-through-Supabase; Devpost off pending permission.

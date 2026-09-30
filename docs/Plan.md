# Plan: HackRadar v2 (from 29 Sep 2026)

Replaces "Implementation Plan HackRadar" (v1; kept in git history). Built so far: collector with Unstop,
dedupe, change tracking, trust labels, geocoding, health and Telegram alerts, running on GitHub every
6 h through Supabase; the app through onboarding, feed, filters, detail and Saved.

Rule: one step at a time, each ends with its Check passing. Tick it here when done.

## A. Data you can trust (first, because everything else shows this data)

- [x] A1 Unstop detail enrichment: rounds and real start dates from `/api/public/competition/{id}` (only for new or changed events, max 60 per run).
  - Check (revised): start date filled wherever the source has one. Result 29 Sep: 140/233 (60%, was 0.9%);
    the other 93 have no rounds on Unstop at all, so the app says "Start date not listed". 0 start-after-end.
  - Learned: Unstop's top-level start_date is when registration opens, never the event start; organizers
    sometimes add notices as "rounds" dated after the event (now dropped). Structured eligibility moved to A3.
- [x] A2 Quality gate: "is this a hackathon?" + date sanity (collector/quality.py).
  - Check: no esports/poster events in the feed; the 4 found on 29 Sep are caught. Result: 20 of 232 excluded
    (15 robot races, 2 esports, olympiad, poster, business plan), each checked by hand; 0 real hackathons lost
    (tests keep 20 odd-looking real titles in). Feed: 213 open hackathons.
  - Learned: Unstop's category (231/232 "online_coding_challenge") and organizer tags ("Quizzes & Treasure Hunt"
    on NASA Space Apps) are useless for this, so only explicit title rules exclude; the default is keep.
    Date problems become warnings, never silent rewrites. Coding contests stay for now (can't tell from titles).
    Prize outliers dropped: no real case found.
- [x] A3 Themes v2 from tags, skills and description (normalize.classify_themes).
  - Check: "other" under 15%. Result 30 Sep: 41% → 7% (14 of 205; games and one-offs that fit no theme).
  - New theme "Coding contests", so contests stay but people choose them (onboarding + filters), which settles
    A2's open question. Open-theme hackathons are "Open innovation" instead of "other". Description text counts
    only with unambiguous phrases ("machine learning", not "AI-powered"). Structured eligibility: not started;
    Unstop only gives category names ("Engineering Students"), which eligibility_text already shows.
- [x] A4 Devfolio adapter (fetch_url_post, fixture, tests).
  - Check: 25+ Devfolio events live; duplicates with Unstop merged. Result 30 Sep: Devfolio had 25 open,
    23 relevant (1 abroad offline, 1 not relevant), 22 new + 1 merged with Unstop (Algothon'26). Feed: 226.
  - Devfolio gives no organizer name and no prize amounts; neither is invented. Its "verified" flag is stored
    (events.source_verified) and replaces the organizer check in trust rules. Fee unknown → "Check details".
  - fetch_url_post allows one exact URL and a fixed body shape only. Dedupe: one online + one offline now
    scores 15 lower (two false review items on 30 Sep).
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

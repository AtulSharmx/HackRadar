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
- [x] A5 Terms check, then Hack2Skill and Devnovate adapters.
  - Check: each adds events; no duplicates; health alerts per source. Result 30 Sep: Hack2Skill listed 18,
    6 open and joinable (online/hybrid), all new, 0 merged, 0 duplicates; health checks run per source name.
  - Terms: Hack2Skill has no clause against automated access (robots.txt allows) → added. Devnovate's Terms say
    "must not copy the materials" → not built; permission draft in docs/outreach.md.
  - Hack2Skill's list has no city, organizer or paid-fee amount; none invented. FLAGSHIP events are run by
    Hack2Skill itself (stored as source_verified); COMMUNITY events keep the "no organizer" warning. In-person
    events are left out unless the title names an Indian city (location unknown, may be abroad). Homepage promo
    rows that point back at a listed event are dropped.
- [ ] A6 Per-field source precedence in merge (deadline from where registration happens).
  - Check: a test where Devfolio and Unstop disagree picks the right one.
- [x] A7 App shows facts only: remove the verbatim "About" block from detail. Done 30 Sep in the app bug round (below).
- [ ] A8 Weekly jobs: quality report on Telegram (per source, per field), retention cleanup, pg_dump backup.
  - Check: Monday's report arrives; backup artifact exists.
- [ ] A9 Send permission emails (docs/outreach.md), add Devfolio, Hack2Skill, Devnovate as courtesy.

## B. Development build and notifications

- [x] B1 EAS development build (logged in as atulshxrma), install on the phone.
  - 1 Oct: @atulshxrma/hackradar, package com.hackradar.app, dev-client APK installed and working; adds native
    Google sign-in, expo-crypto (secure PKCE) and expo-intent-launcher (Unstop app hand-off).
  - Check: the app runs from the dev build with the same features as Expo Go.
- [ ] B2 Reminders: 7 d, 48 h, 24 h before saved deadlines; quiet hours; cancel on unsave; "starts tomorrow" for Registered. Toast text back to the App Flow wording.
  - 1 Oct: built (app/src/lib/reminders.js). The phone's schedule is kept equal to Saved on every change
    (save, unsave, Registered, a deadline that moved, notifications off, log out). Quiet 11 pm to 8 am IST
    moves a reminder to 9 pm before; titles say "closes in 7 days / in 2 days / tomorrow" by calendar day.
    Registered: 7 pm IST the evening before it starts. Tap opens the event. No exact-alarm permission
    (Android's inexact "allow while idle" alarm, minutes late at worst). New HackRadar icon set and status-bar
    icon. Registered events now stay under Registered until the event is over (closed registration moved
    them to Past).
  - Check: a test event 25 h away rings the 24 h reminder with the phone locked (Samsung, battery optimisation on and off).
- [ ] B3 Push: push_tokens table + RLS, register the token, collector sends new-match and saved-change pushes via Expo, receipts next run.
  - 1 Oct: built (spec docs/superpowers/specs/2026-10-01-b3-push-design.md). Migration 0014 applied
    (push_tokens, register_push_token, push_tickets.token); rls_check 19/19. collector/push.py (send,
    receipts, dead tokens), notify.py push: grouped new-match push, quiet hours via pending_digest, 4 h
    guard, change pushes. App: token registration, two Profile switches, tap routing, Feed "From
    notification" chip. Waiting on the owner's Firebase setup (google-services.json + FCM V1 key on
    expo.dev), then a new build.
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
  - 30 Sep: sign-in screen with Google, GitHub, phone (+91 SMS) and email codes, 30 s resend, log out
    (app/src/app/account.js, lib/account.js). Methods the server hasn't switched on show "Soon" (read from
    /auth/v1/settings). Setup left for the owner: Google/GitHub OAuth apps, an SMS provider (+ India DLT),
    email templates with {{ .Token }}, redirect URLs hackradar://** and exp://**, manual identity linking.
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
- 30 Sep 2026, app bug round (user report: fee filter, sort):
  - Feed: the filter-chip row took half the screen (a horizontal ScrollView grows by default); lists now
    start at the top after a sort/filter/search change; "Set city" on the banner and in both sheets.
  - Fee filter is Free / Paid / Both. Free = not known to charge (a "Fee not listed" event still shows, with
    that label); Paid = known to charge. New events.is_paid keeps "paid, amount not listed" (Hack2Skill PAID,
    Unstop isPaid) out of Free. Same rule in collector/match.py and app match.js (shared cases 12-18).
  - Newest sorts by events.posted_at (Unstop approved_date, Devfolio/Hack2Skill registration start), not
    first_seen_at, which made every event of a newly added source look new; cards show "Posted 3 h ago".
    Fixed on the way: "GMT+0530" dates were read as UTC-5:30 (dateutil), 11 h off.
  - "Closing within 7 days" counts India calendar days like the countdown (a "7 days left" card was dropped).
  - Settings tab built (preferences, city, distance, notifications, hide warnings, about); the app pointed
    people to it from 4 places while it was a placeholder. Delete my data stays in D2.
  - Event detail: "Did you register?" now waits for the return from the browser (Android resolved at once,
    so it expired unseen); "I registered" / "Move to Interested" on the page; offline shows "can't load",
    not "no longer listed"; one prize line; venue without the repeated city; distance from me; "Checked"
    = the collector's last visit (event_sources.last_seen_at, 4 columns readable) instead of last change.
  - Saved: copies refresh from the server on every sync (closed/changed events), and a save or remove made
    during a sync is no longer undone by it. Switches were invisible in dark mode when off.
- 30 Sep 2026, app round 2 (user asks):
  - Light theme by default (the dark look felt "AI-made"); Settings > Appearance: Light / Dark / Match device.
  - Haptics through lib/haptics.js on buttons, chips, tabs, sort, switches, pages, save, swipe; tab "shift"
    animation, detail slides in, feed cards fade up, chips and saved rows glide instead of jumping.
  - Feed shows 10 per page with "< Page 2 of 25 >"; Filters "Reset" is now "Clear" (no filters at all).
  - Location: full-screen search with suggestions under the box (the keyboard hid them before), real places
    as you type from Photon (komoot, OpenStreetMap, no key), phone list offline; GPS names the city through
    Photon's reverse lookup, then the phone, then the nearest listed city.
  - Apply on an Unstop event opens the Unstop app on its page when installed (unstop.com assetlinks names
    com.dare2compete.app); without it, a sheet offers the Play Store or the website. Coming back after 15 s or
    more shows a "Did you register?" popup (Registered, or x), with the real time away and the site.
- 30 Sep 2026, app round 3 (user asks): light theme only (dark removed, so no theme switch delay or "match
  device" issue); Settings redesigned with every choice in place (chips, and a sliding Segmented control for
  mode, fee and distance, also used in Filters and onboarding); Account card with email-code sign-in and log out.
- 1 Oct 2026, speed + layout round (user: "app slow, taps late on Best match and the tabs"):
  - Measured on the web preview (React Profiler, long tasks): opening Sort re-rendered all 10 cards (24 ms,
    memo defeated by new arrow callbacks) -> 1.3 ms; picking a sort blocked 149 ms -> the sheet closes in
    ~28 ms and the list follows in a transition; first tap on Settings 101 ms -> tabs prefetched.
  - The phone runs a development build (JS from Metro, dev mode), several times slower than the app people
    will install; a "preview" (release) APK is now built for judging speed (EAS env "preview" holds the
    EXPO_PUBLIC_* config).
  - Splash showed Expo's default image: expo-splash-screen now uses the HackRadar mark.
  - Layout audit (mobile-redesign-app, app/design-baseline.json), approved by the user: Feed has one chip
    row (Filters, Sort, City, then active filters) instead of a floating pill and a city banner; trust shows
    on a card only for "Check details" and "Warning"; the third tab is "Profile".
- 6 Oct 2026, "the app must work without my laptop": the phone had the development build again (it loads
  JS from Metro). The release (preview) APK is standalone. Log out now opens sign-in ("Continue as guest"
  stays one tap away). EAS Update added (expo-updates, channels, runtimeVersion "fingerprint"): JS-only
  changes ship with `eas update --channel preview --environment preview`; installed apps take them on the
  next launch. Native changes (new native package, app.json plugins) still need a new APK.

# TRD: HackRadar – Personal Hackathon Finder App

Sep 27, 2026 · @Atul Sharma

## Overview

This TRD turns the HackRadar PRD into build instructions: a Python collector on a schedule, a Supabase database, and an Expo Android app, with no always-on server in version 1.

Scope: everything in the PRD's version 1 (P0 features, local reminders, push for new matches, source health). Add-by-link, AI extraction and multi-user login are designed for, but not built.

Key technical decisions:

1. Serverless-by-schedule. The collector runs as a GitHub Actions job every 6 hours instead of a server that stays awake. Cheaper and nothing to babysit.
2. App reads the database directly. The Expo app queries Supabase with a read-only key protected by row-level security. No custom API until a feature truly needs one.
3. One adapter per source. Each source is a small Python module with the same interface, so a broken source never breaks the others.
4. Reminders on the phone, discovery alerts from the backend. Deadline reminders are scheduled locally; only "new matching event" alerts need push.
5. Filtering on the phone. With a few hundred open events, filtering and sorting in the app is instant and keeps the backend simple.

Readers: me (builder), and any AI or mentor I ask for help. Terms are explained in plain words where they first appear.

## System architecture

Four parts talk in one direction: the collector writes, the database stores, the push service delivers, and the app reads.

Components:

1. Collector (Python, GitHub Actions)
   - Runs on a cron schedule. Fetches sources, cleans data, merges duplicates, geocodes venues, applies trust labels, writes to the database, and triggers notifications.
2. Database (Supabase PostgreSQL)
   - Stores events, sources, devices, saved events, run logs and the geocode cache.
   - Two keys: a secret service key used only by the collector (full access), and a public anon key used by the app (limited by row-level security, meaning rules inside the database that decide who can read or write each row).
3. Push service (Expo push service to Firebase Cloud Messaging)
   - The collector sends a message to Expo; Expo forwards it to Google's FCM; FCM delivers it to the phone.
4. Android app (Expo / React Native)
   - Reads events, stores preferences locally, filters and sorts, schedules local reminders, registers its push token.
5. Telegram bot (temporary)
   - Same alerts as push, used in weeks 3 to 5, and kept afterwards for admin health alerts.

One collector run, step by step:

1. Start job, load secrets from GitHub Actions.
2. For each source adapter: fetch, parse, validate. Errors are caught per source.
3. Normalize every record into the common event format.
4. Match against existing events: merge, update, or insert.
5. Geocode new venues (from cache first).
6. Compute trust label and warnings.
7. Write to the database in one transaction per source.
8. Log a source\_runs row per source.
9. Find new events that match each device's alert filter; send grouped pushes.
10. Find saved events whose deadline or venue changed; send change pushes.
11. Run the health check; send an admin alert if any source is unhealthy.

App data flow: on open and on pull-to-refresh, the app fetches open events updated since its last sync, merges them into a local cache, and applies filters locally.

## Collector

The collector is a Python package with one adapter per source, run by GitHub Actions every 6 hours at an odd minute, in a private repository.

Adapter interface (every source implements the same three functions):

```python
class SourceAdapter:
    name: str                      # "devpost", "unstop", "manual"
    def fetch(self) -> list[dict]: # raw records, with retries and delays
        ...
    def parse(self, raw: dict) -> RawEvent:  # source fields -> common fields
        ...
    def is_relevant(self, e: RawEvent) -> bool:  # India or online, still open
        ...
```

Source plan:

1. Devpost adapter. Devpost's listing pages load from a public JSON feed that other tools read without login ([Apify](https://apify.com/automation-lab/devpost-scraper)). Find the exact URL and fields in the browser's Network tab, keep only India and online events, and treat the format as unstable.
2. Unstop adapter. Unstop also serves public JSON, but it does not validate filter values and its city filter does not work server-side, so fetch broadly and filter locally ([Apify](https://apify.com/dami_studio/unstop-scraper)).
3. Manual adapter. Reads a manual\_events table I fill by hand (or later through add-by-link), so manual entries go through the same cleaning path.
4. Devfolio. Not built until a login-free feed is confirmed.

Fetch rules:

- One shared HTTP client (httpx) with a clear User-Agent like "HackRadar/0.1 (personal project; contact email)".
- At least 2 seconds between requests to the same site; at most 20 pages per source per run.
- Timeout 20 seconds per request; 3 retries with growing waits (2, 4, 8 seconds) only for network errors and HTTP 429/5xx.
- Stop that source for the run on HTTP 403, a CAPTCHA page, or a login redirect. Log it; never try to get around it.
- Respect robots.txt, checked once per run with Python's urllib.robotparser.

Scheduling facts that shape the design:

- GitHub may start scheduled runs late, sometimes by hours under load, and the top of the hour is the busiest slot ([GitHub community](https://github.com/orgs/community/discussions/156282), [Cronuru](https://cronuru.com/dialects/github-actions)). Use a cron like "23 \*/6 \* \* \*" and never depend on exact timing.
- In a public repository, scheduled workflows are switched off after 60 days with no activity; the rule does not apply to private repositories ([Cronuru](https://cronuru.com/guides/github-actions-scheduled-workflows)). Use a private repo, which also keeps scraper code private. Private repos use a monthly free-minutes quota; at about 2 minutes per run, 4 runs a day is roughly 240 minutes a month. Confirm the current quota.
- Add a manual trigger (workflow\_dispatch) so I can run it from my phone when testing.
- Job timeout: 15 minutes. Only one run at a time (concurrency group), so two runs never write at once.

Failure isolation: each adapter runs inside its own try/except. A failing source writes an error row to source\_runs and the run continues with the others.

## Normalization, duplicates and changes

Every record is cleaned into one common format, matched against existing events with a simple score, and fingerprinted so later changes can be detected.

Normalization rules:

- Dates: parse with dateutil, convert to timezone-aware datetimes in Asia/Kolkata, store in UTC. A date with no time gets 23:59 IST for deadlines.
- Mode: map source words to online, offline or hybrid ("in-person", "on-site" = offline; "virtual", "remote" = online).
- Money: parse Indian formats like "₹1,00,000" and "1 lakh". Keep non-INR prizes as text plus an approximate INR value using a fixed rate set in config, labelled approximate.
- Fee: "free", "0", missing = 0 only when the source says free; otherwise unknown (null), which triggers "Check details".
- Themes: map free-text tags into a fixed list (AI/ML, cybersecurity, web, mobile, blockchain, IoT/hardware, data science, open innovation, other) with a keyword dictionary.
- City and state: clean spelling with an alias list ("Bengaluru" = "Bangalore", "Gurugram" = "Gurgaon", "Delhi NCR" = Delhi).
- Text: strip HTML, collapse whitespace, cut description\_short to 300 characters.
- Validation: drop records with no title or no URL; keep records with missing dates but label them "Check details".

Duplicate detection, in order:

1. Same (source, source\_event\_id) = same row; update it.
2. Same registration URL after cleaning (lowercase host, no tracking parameters, no trailing slash) = same event across sources; merge.
3. Otherwise score candidates that start within 2 days of each other:
   - Title similarity with rapidfuzz token\_set\_ratio on normalized titles (lowercase, no punctuation, no words like "hackathon", "2026", "edition").
   - +10 if same city or both online; +10 if same organizer (fuzzy).
   - Score 90 or more = merge automatically. 75 to 89 = keep separate, set needs\_review. Below 75 = new event.
4. When merging, prefer the field from the source with more detail, and keep every source link in event\_sources.

Change detection:

- For each event, compute a SHA-256 fingerprint of the fields that matter to me: deadline, start date, venue, city, mode, fee.
- If the fingerprint differs from the stored one, record which fields changed in an event\_changes row and update the event.
- Changes to deadline or venue on a saved event trigger a push; other changes do not.
- An event missing from its source for 3 runs in a row becomes stale; a passed deadline sets status to closed.

## Geocoding and distance

My location is resolved on the phone; venue locations are resolved once by the collector and cached; distance is a straight-line calculation done in the app.

My location (in the app):

- Ask permission with expo-location only when I tap "Use my location", never at app start.
- Get one position at balanced accuracy, then call reverseGeocodeAsync to get city and region (state) ([Expo docs](https://docs.expo.dev/versions/unversioned/sdk/location/)). Reverse geocoding can be imprecise and return just one result, so always show the result in editable fields ([Expo forums](https://forums.expo.dev/t/reverse-geolocation-only-returning-1-result/10721)).
- Save city, state and coordinates rounded to 2 decimals (about 1 km) on the phone. Send the same rounded values to the devices table only for alert filtering.
- If permission is denied or reverse geocoding fails, fall back to a searchable city list with coordinates bundled in the app.

Venue locations (in the collector):

1. Look up the cleaned address in geocode\_cache first.
2. If missing, query Nominatim with a structured query (street, city, state, country=India), one request per second at most, with an identifying User-Agent ([OSM community](https://community.openstreetmap.org/t/clarification-on-nominatim-usage-policy/102661)).
3. If there is no result, try the college or venue name plus city; if that fails, use the city centre from the bundled city list and set location\_approximate = true.
4. Cap new geocodes at 50 per run; the rest wait for the next run.
5. Show "© OpenStreetMap contributors" on the About screen, since attribution is expected when using the data.

Distance (in the app): straight-line distance with the haversine formula, where R = 6371 km and φ, λ are latitude and longitude in radians.

```latex
d = 2R \arcsin\sqrt{\sin^2\frac{\varphi_2-\varphi_1}{2} + \cos\varphi_1\cos\varphi_2\sin^2\frac{\lambda_2-\lambda_1}{2}}
```

- Show it as "about 18 km"; add "(approx.)" when the venue location is approximate.
- Road distance and travel time are out of scope for version 1; a "Open in Maps" button covers that need.

## Trust labels and match score

Both are plain rule-based functions in the collector (trust) and the app (match score), so every result can be explained in one line.

Trust label, evaluated in this order (first match wins):

1. stale: deadline passed, or not seen in its source for 3 runs.
2. warning: any red flag is true.
3. check\_details: title and URL present, but deadline, mode, fee or (for offline) city is missing.
4. trusted\_source: from Devpost, Unstop or Devfolio, with organizer, deadline and registration URL present.
5. Anything else: check\_details.

Red flags (each stored as a short code plus a human sentence in warnings):

- high\_fee: fee\_amount > FEE\_LIMIT (default ₹500 per team) and no prize or perk found.
- no\_organizer: organizer empty.
- date\_conflict: two sources disagree on the deadline by more than 1 day.
- domain\_mismatch: registration URL host differs from event URL host and is not a known form or platform host (Google Forms, Unstop, Devfolio, Devpost).
- social\_only: only source is a manual entry pointing to Instagram, WhatsApp or a shortened link.

All thresholds live in one config file so I can tune them without touching logic.

Best-match score (0 to 100, computed in the app per event):

- Theme match: 35 points if any event theme is in my themes.
- Distance: 25 points for online or within my max distance, scaled down linearly to 0 at twice my max distance.
- Fee: 15 points if free, 8 if fee ≤ FEE\_LIMIT, 0 otherwise.
- Urgency: 15 points if the deadline is 2 to 10 days away (actionable), 8 if 11 to 30 days, 0 if under 2 days or unknown.
- Trust: 10 points for trusted\_source, 5 for check\_details, 0 for warning.

The detail screen shows the top two reasons, for example "Matches AI, 12 km away". Weights are constants in one file and can be tuned after a month of use.

## Database

Supabase PostgreSQL on the free plan holds everything; row-level security lets the app read events and write only its own device rows, and the collector's regular writes keep the project from pausing.

Free plan facts to design around: 500 MB database per active project, 2 active projects, no backups, and projects pause after 7 days with no activity ([Supabase pricing](https://supabase.com/pricing), [SSD Nodes, checked 10 Sep 2026](https://www.ssdnodes.com/learn/is-supabase-free-cloud-vs-self-hosted)). A collector that writes every 6 hours counts as activity. A few thousand events is only a few MB.

Schema (core tables):

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  organizer text,
  description_short text,
  mode text check (mode in ('online','offline','hybrid')),
  venue_address text, city text, state text,
  lat double precision, lng double precision,
  location_approximate boolean default false,
  registration_url text not null, event_url text,
  registration_deadline timestamptz, start_date timestamptz, end_date timestamptz,
  themes text[] default '{}',
  team_min int, team_max int, solo_allowed boolean,
  fee_amount int,                -- INR, null = unknown, 0 = free
  prize_text text, prize_amount_inr int, perks text[] default '{}',
  eligibility_text text, eligible_degrees text[], eligible_years int[],
  trust_label text not null default 'check_details',
  warnings jsonb default '[]',
  fingerprint text,
  needs_review boolean default false,
  status text not null default 'open' check (status in ('open','closed','stale')),
  first_seen_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_checked_at timestamptz
);

create table event_sources (
  event_id uuid references events(id) on delete cascade,
  source text not null, source_event_id text not null,
  source_url text, raw_hash text, missing_runs int default 0,
  primary key (source, source_event_id)
);

create table devices (
  id uuid primary key references auth.users(id),  -- anonymous sign-in user
  expo_push_token text,
  city text, state text, lat_rounded numeric(5,2), lng_rounded numeric(5,2),
  prefs jsonb not null default '{}',              -- themes, modes, degree, year, fee, max_km
  alert_filter jsonb, quiet_hours int4range, digest_mode boolean default false,
  updated_at timestamptz default now()
);

create table saved_events (
  device_id uuid references devices(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  status text check (status in ('interested','registered')),
  saved_at timestamptz default now(),
  primary key (device_id, event_id)
);

create table source_runs (
  id bigint generated always as identity primary key,
  source text, run_at timestamptz default now(),
  events_found int, new_events int, error_text text
);

create table event_changes (
  id bigint generated always as identity primary key,
  event_id uuid references events(id) on delete cascade,
  changed_fields text[], changed_at timestamptz default now(), notified boolean default false
);

create table geocode_cache (
  address_key text primary key, lat double precision, lng double precision,
  approximate boolean, created_at timestamptz default now()
);
```

Supporting tables (same RLS as source\_runs, collector only): push\_tickets (ticket\_id, device\_id, sent\_at, checked) and pending\_digest (device\_id, event\_id, queued\_at).

Indexes: events(status, registration\_deadline), events(updated\_at) for sync, events(city), a GIN index on events(themes), source\_runs(source, run\_at desc).

Access rules (row-level security):

- Turn on RLS for every table. Tables without a policy are closed to the app by default.
- events and event\_changes: app may select rows; no insert, update or delete.
- devices and saved\_events: app may select, insert, update and delete only rows where the device id equals auth.uid().
- source\_runs and geocode\_cache: no app access at all.
- The collector uses the service key, which bypasses RLS, and it exists only in GitHub Actions secrets.

Identity without login: the app uses Supabase anonymous sign-in on first launch, so each phone gets a private user id for RLS without any login screen. If the app is reinstalled, a new id is created and the old device row can be cleaned up.

Backups: the free plan has none, so a weekly GitHub Actions job exports the database with pg\_dump into a private repo artifact.

## Mobile app

The app is an Expo (React Native, JavaScript) Android app with six screens, a local copy of open events, filtering done on the phone, and deadline reminders scheduled on the phone.

Libraries:

- expo-router for screens and navigation (file-based: each file in app/ is a screen).
- @supabase/supabase-js for reading events and writing device rows, with AsyncStorage to keep the anonymous session.
- expo-location for GPS and reverse geocoding.
- expo-notifications for local reminders and push.
- expo-web-browser (or Linking) to open registration pages; React Native's Share API for WhatsApp sharing.
- AsyncStorage for preferences and the event cache (a few hundred events as JSON is small); move to expo-sqlite only if it grows large.

Screens:

1. Onboarding (first launch only): themes, mode, degree and year, fee preference, max distance, "Use my location", notification permission.
2. Feed: search bar, sort selector, filter chips, event cards, pull to refresh, "last updated" time.
3. Filters (bottom sheet): all P0 filters; "Save as my alert filter" button.
4. Event detail: summary line, all fields, warnings, source and last checked, match reasons, Apply, Save, Share, Open in Maps.
5. Saved: tabs for Interested and Registered, sorted by deadline.
6. Settings: edit preferences and location, quiet hours, digest mode, hide warnings, about and OpenStreetMap credit.

Sync logic:

1. On app open (if more than 15 minutes since last sync) and on pull to refresh, request events where updated\_at is later than the last sync time, 500 rows per page.
2. Merge into the local cache by id; drop events that are closed or stale.
3. Save the new last-sync time only after all pages succeed.
4. If offline, show the cache with a small "offline, showing saved data" banner.

Filtering and sorting run in memory with useMemo on the cached list. At a few hundred events this is well under 100 ms, so no server queries are needed per filter change.

Local reminders:

- On save, schedule up to three notifications with date triggers (deadline minus 7 days, 48 hours, 24 hours), skipping any time already past or inside quiet hours (moved to 8 am).
- Store the returned notification ids with the saved event; cancel them on unsave or when a deadline change arrives, then reschedule.
- Create one Android notification channel "Deadlines" and one "New hackathons" so each can be muted separately in Android settings.
- Samsung phones can delay background work to save battery. Test that reminders fire on time with the phone locked, and add a Settings tip to turn off battery optimization for the app if they do not.

Build and install: EAS Build produces a development build for testing and an APK for daily use, installed directly on the phone with no Play Store listing.

## Push notifications

The collector sends grouped pushes through the Expo push API at the end of each run and checks delivery receipts on the next run, which falls neatly inside Expo's receipt window.

Expo push facts ([Expo sending docs](https://docs.expo.dev/push-notifications/sending-notifications/), [Expo FAQ](https://docs.expo.dev/push-notifications/faq/)):

- Free to use. Limit of 600 notifications per second per project, and at most 100 messages per request.
- Each send returns a ticket at once; the delivery receipt should be fetched 15 minutes to 24 hours later, after which receipts are cleared.
- No delivery guarantee or SLA, so reminders that matter (deadlines) stay local on the phone.
- Payload limit is about 4 KB, so send only title, body and an event id.

Token registration (app):

1. After notification permission is granted, call getExpoPushTokenAsync with the project id.
2. Upsert it into devices.expo\_push\_token for the current anonymous user.
3. Repeat on every app start, because tokens can change.

Sending (collector, after the database write):

1. For each device with a token, find events first seen in this run that match its alert\_filter (same matching code as the app, ported to Python and tested against shared examples).
2. Skip if inside quiet hours or digest\_mode is on; queue those into a pending\_digest list sent at 8 am IST by the next run after 8 am.
3. Build one message per device: title "3 new hackathons match", body with up to 3 titles, data = list of event ids.
4. For saved events with a deadline or venue change, send one message per change: title "Deadline changed", body with the event title and new date.
5. Send in chunks of 100 with plain HTTPS POST (or a community Python SDK), retrying on HTTP 429 with backoff.
6. Store ticket ids in a push\_tickets table with the device id.

Receipts (next collector run):

- Fetch receipts for tickets older than 15 minutes and younger than 24 hours.
- On DeviceNotRegistered, clear that device's token. On credential errors, send me a Telegram admin alert.

In the app: tapping a notification opens the event (or the feed filtered to the listed ids) using the data field. The app also shows notifications while open, as a banner.

Optional hardening: turn on Expo's enhanced push security so sending requires an access token, stored only as a GitHub Actions secret.

## Security and privacy

The main risks are a leaked secret key, untrusted data from scraped pages, and collecting more personal data than needed; each has a concrete control below.

Threats and controls:

1. Leaked service key (full database access).
   - Only in GitHub Actions secrets; never in the app, never in code, never printed in logs.
   - Add a .gitignore for .env files and run a secret scanner (GitHub secret scanning or gitleaks) on every push.
   - If leaked: rotate the key in Supabase at once, then update the secret.
2. Public anon key inside the APK. Anyone can extract it, which is expected.
   - Safe only because RLS limits it to reading events and managing the caller's own device rows. Test this directly: try to update an event with the anon key and confirm it fails.
3. Malicious or broken data from sources (they are untrusted input).
   - Validate types and lengths before saving; strip HTML; cap text fields.
   - The app opens only http and https links. Any other scheme (javascript:, intent:, file:) is refused.
   - Show the link's domain next to the Apply button so a mismatched domain is visible.
4. Add-by-link (later) fetching a URL I type.
   - Allow only http and https, block private and local addresses, limit size and time, and never follow more than 3 redirects. This prevents the server being tricked into fetching internal addresses (SSRF).
5. Supply-chain risk from packages and GitHub Actions.
   - Pin Python and npm versions with lock files; run pip-audit and npm audit weekly; enable Dependabot.
   - Pin third-party GitHub Actions to a commit SHA and give workflows the minimum permissions (contents: read).
6. Push abuse. Enable Expo enhanced push security so only my collector can send.
7. Lost APK signing key. Let EAS manage it, and download a backup of the keystore to a safe place, or future updates cannot install over the old app.

Privacy:

- Collect only what features need: preferences, city, state, rounded coordinates, push token. No name, email or phone in version 1.
- Location is read only when I tap the button; no background location permission.
- A "Delete my data" button in Settings deletes the device row and saved events, then clears local storage.
- Logs record counts and errors, never tokens or coordinates.
- If the app is ever shared beyond friends, write a short privacy notice and review India's Digital Personal Data Protection rules before collecting anything more.

This section doubles as a portfolio piece for a SOC path: keep a short threat model and the RLS test results in the repository README.

## Non-functional requirements

Version 1 targets fast screens, alerts within about 6 to 9 hours of an event appearing, zero missed saved deadlines, and ₹0 monthly cost.

Performance:

- App cold start to a usable feed from cache: under 2 seconds on my phone.
- Filter or sort change: under 100 ms for up to 1,000 cached events.
- Sync of changes since last open: under 3 seconds on 4G.
- Collector run: under 5 minutes; hard timeout 15 minutes.

Freshness and reliability:

- Runs are scheduled every 6 hours, but GitHub can start them late, so plan for new events to reach me within 6 to 9 hours, not exactly 6.
- One failing source never stops the others (per-adapter isolation).
- A source with 0 events or errors for 2 consecutive days triggers an admin alert.
- Deadline reminders work fully offline because they are scheduled on the phone.
- The app keeps working read-only from cache when the backend is down or paused.

Data quality:

- Every event shows source and last-checked time.
- Duplicates in the feed: fewer than 1 in 50 events after the first two weeks of tuning.
- Fields the collector could not parse are shown as unknown, never guessed.

Cost (monthly): GitHub Actions, Supabase, Expo push and EAS Build all within free tiers for one user and a few friends. If any service would start charging, the fallback is to reduce run frequency first, not to pay.

Maintainability:

- Adding a new source means one new adapter file plus tests; no changes elsewhere.
- All thresholds and weights in one config file per side (Python and JavaScript).
- README with setup steps so I (or a teammate) can rebuild everything from scratch in under an hour.

## Testing, deployment and monitoring

Test the parts most likely to break (parsers, matching, rules) with saved sample data, deploy everything from one private repository, and watch runs through source\_runs plus Telegram admin alerts.

Repository layout:

- collector/ (Python package: adapters, normalize, dedupe, geocode, trust, notify, main.py)
- collector/tests/ with fixtures/ holding saved JSON and HTML from each source
- app/ (Expo project)
- shared/match\_cases.json (example events and filters with expected results, used by both Python and JavaScript tests)
- supabase/migrations/ (SQL files, applied in order)
- .github/workflows/ (collect.yml, backup.yml, test.yml)

Testing:

1. Parser tests: each adapter parses its saved fixtures into the expected common format. When a live source changes, save a new fixture and update the test.
2. Normalization tests: Indian money formats, date formats, mode words, city aliases.
3. Duplicate tests: pairs that must merge, pairs that must not, and borderline pairs that must be flagged.
4. Rule tests: each red flag and trust label; match score on shared/match\_cases.json in both languages, so app and collector always agree.
5. RLS tests: a script using the anon key tries forbidden actions (edit an event, read another device) and must fail.
6. App checks by hand on my phone: onboarding, GPS fill, filters, save, reminder firing with the phone locked, notification tap opens the right event.
7. Tests run on every push via test.yml (pytest, and Jest for the app's matching code).

Deployment:

- Database: apply migrations with the Supabase CLI; never change tables by hand in the dashboard after week 1.
- Collector: merging to main updates what the scheduled workflow runs. workflow\_dispatch allows a manual run.
- App: EAS Build profiles "development" (with dev tools) and "preview" (APK for daily use). Increase the version number on each APK.
- Secrets: SUPABASE\_URL, SUPABASE\_SERVICE\_KEY, EXPO\_ACCESS\_TOKEN, TELEGRAM\_BOT\_TOKEN, TELEGRAM\_ADMIN\_CHAT\_ID in GitHub Actions; only the Supabase URL and anon key in the app config.

Monitoring:

- Every run writes a source\_runs row per source and a one-line summary to the workflow log.
- Admin Telegram alert when: a source is unhealthy for 2 days, a run fails completely, push credentials fail, or more than 10 events need review.
- A weekly Telegram summary: events added per source, pushes sent, receipts failed.
- GitHub emails me when a workflow fails; keep that notification on.

## Technical risks and open questions

The riskiest assumptions are that source feeds stay reachable and that Expo push works smoothly on a Samsung phone; both should be tested in week 1, before building anything big.

Risks:

1. Source feeds change or block access. The Devpost and Unstop JSON feeds are undocumented. Mitigation: fixtures and tests, health alerts, manual adapter as backup.
2. GitHub schedule delays or skipped runs ([GitHub community](https://github.com/orgs/community/discussions/156282)). Mitigation: odd-minute cron, tolerate late runs, receipts window of 24 hours covers gaps. If delays get extreme, trigger the workflow from an external free cron service through the GitHub API.
3. Supabase pauses the project. Mitigation: the collector writes every 6 hours; the health alert catches it if the collector itself stops.
4. Samsung battery saving delays local reminders. Mitigation: test on the real phone early; Settings tip to exclude the app from battery optimization.
5. Matching logic drifts between Python and JavaScript. Mitigation: shared test cases file.
6. Free tiers change. Mitigation: all parts are standard (PostgreSQL, Python, HTTPS), so moving host is a config change, not a rewrite.

Open questions:

- [ ] Exact Devpost and Unstop JSON endpoints and fields (check in browser Network tab).
- [ ] What do both sites' terms and robots.txt allow for personal automated access?
- [ ] Does Devfolio have any login-free listing feed?
- [ ] Current GitHub Actions free minutes for private repos, and EAS Build free build limits.
- [ ] Does Supabase anonymous sign-in need to be enabled per project, and are there any limits I should know?
- [ ] Is the venue text from sources good enough for Nominatim, or will most offline events end up with city-level approximate locations?

## Sources

Checked 27 Sep 2026: [Apify Devpost scraper](https://apify.com/automation-lab/devpost-scraper), [Apify Unstop scraper notes](https://apify.com/dami_studio/unstop-scraper), [GitHub scheduled run delays](https://github.com/orgs/community/discussions/156282), [Cronuru GitHub cron reference](https://cronuru.com/dialects/github-actions), [Cronuru schedule traps](https://cronuru.com/guides/github-actions-scheduled-workflows), [Expo location docs](https://docs.expo.dev/versions/unversioned/sdk/location/), [Expo forums on reverse geocoding](https://forums.expo.dev/t/reverse-geolocation-only-returning-1-result/10721), [Nominatim policy discussion](https://community.openstreetmap.org/t/clarification-on-nominatim-usage-policy/102661), [Supabase pricing](https://supabase.com/pricing), [SSD Nodes on Supabase free plan](https://www.ssdnodes.com/learn/is-supabase-free-cloud-vs-self-hosted), [Expo sending notifications](https://docs.expo.dev/push-notifications/sending-notifications/), [Expo push FAQ](https://docs.expo.dev/push-notifications/faq/). Companion document: the HackRadar PRD.

# Implementation Plan: HackRadar

Sep 27, 2026 · @Atul Sharma

## How to use this plan

Work one task at a time, in order, and tick it only after its check passes; never ask an AI to "build the whole app".

Setup for AI sessions:

1. Export PRD, TRD, App Flow, UI/UX Design Brief, Backend Schema and this plan as Markdown into a docs/ folder in the repo.
2. Start each AI session with: "Read docs/. We are on Phase X, task Y. Do only that task. Don't add packages or change files outside that task without asking."
3. After the AI finishes, run the task's Check yourself. If it fails, paste the exact error back; don't ask it to "fix everything".
4. Before ticking, make sure I can explain in my own words what the code does. If not, ask the AI to explain it simply.
5. Commit after every ticked task with a message naming the task ("P1.3 save devpost events").
6. Update the Progress log at the end of this doc at the end of each session.

Time estimate: about 6 weeks at 10 to 12 hours a week. Phases 1 to 3 already give a working Telegram alert system, so the project is useful even if the app takes longer.

## Phase 0: Setup (about 3 hours)

Goal: every account, tool and folder is ready, and nothing secret is in the repo.

- [ ] P0.1 Create a private GitHub repo "hackradar" with folders collector/, app/, supabase/migrations/, shared/, docs/ and a .gitignore that includes .env, node\_modules, **pycache**.
  - Check: git status shows no .env file tracked.
- [ ] P0.2 Put the 6 planning docs into docs/ as Markdown.
- [ ] P0.3 Install on the laptop: Python 3.11+, Node.js LTS, Git, VS Code, Supabase CLI.
  - Check: python --version, node --version, supabase --version all print versions.
- [ ] P0.4 Create a Supabase project (region closest to India) and note the project URL, anon key and service key in a local .env only.
- [ ] P0.5 Create a Telegram bot with BotFather; send it a message; note the bot token and my chat id in .env.
- [ ] P0.6 Turn on GitHub secret scanning for the repo (or add gitleaks to a pre-commit hook).
- [ ] P0.7 Read the terms and robots.txt of Devpost and Unstop; write what is allowed in docs/sources.md.
  - Check: docs/sources.md says, for each source, allowed / not allowed / unclear. Unclear or not allowed means that source is manual-only.

## Phase 1: First source into the database (week 1)

Goal: running one command fills Supabase with real, clean hackathons from Devpost.

- [ ] P1.1 Apply 0001\_init.sql and 0002\_rls.sql from the Backend Schema doc with the Supabase CLI.
  - Check: all 11 tables appear in the dashboard with RLS enabled.
- [ ] P1.2 Find Devpost's listing JSON in the browser Network tab; save one response as collector/tests/fixtures/devpost\_page1.json.
- [ ] P1.3 Create the Python package: collector/ with config.py, http.py (shared client with User-Agent, delay, retries), models.py (RawEvent and Event dataclasses).
  - Check: python -c "import collector" works.
- [ ] P1.4 Write adapters/devpost.py with fetch, parse, is\_relevant.
  - Check: a pytest test parses the saved fixture into a list of RawEvent with titles, URLs and dates.
- [ ] P1.5 Write normalize.py (dates to IST-aware, mode words, INR parsing, theme mapping, city aliases).
  - Check: tests for "₹1,00,000", "1 lakh", "in-person", "Gurgaon" all pass.
- [ ] P1.6 Write db.py that inserts or updates events and event\_sources using the service key.
- [ ] P1.7 Write main.py that runs the Devpost adapter end to end and logs a source\_runs row.
  - Check: python -m collector.main runs; events appear in Supabase; running it twice does not create duplicates.
- [ ] P1.8 Try the RLS checklist from the Backend Schema doc with the anon key.
  - Check: every forbidden action fails.

## Phase 2: Second source, duplicates, schedule (week 2)

Goal: the database updates itself every 6 hours from two sources, merges duplicates, and tells me when a source breaks.

- [ ] P2.1 Save Unstop fixtures and write adapters/unstop.py (fetch broadly, filter locally).
  - Check: parser test passes on the fixture.
- [ ] P2.2 Write dedupe.py: URL match, then title + date + city score with rapidfuzz; 90+ merge, 75 to 89 goes to review\_queue.
  - Check: tests with 3 must-merge pairs, 3 must-not-merge pairs, 2 borderline pairs.
- [ ] P2.3 Write changes.py: fingerprint of tracked fields; write event\_changes when it differs.
  - Check: change a fixture's deadline, rerun, one event\_changes row appears.
- [ ] P2.4 Add end-of-run updates: close passed deadlines, count missing runs, mark stale.
- [ ] P2.5 Add manual adapter reading confirmed rows from manual\_events.
  - Check: a row added by hand in the dashboard shows up as an event after a run.
- [ ] P2.6 Create .github/workflows/collect.yml: cron "23 \*/6 \* \* \*", workflow\_dispatch, concurrency group, 15-minute timeout, secrets from GitHub.
  - Check: a manual run from the Actions tab succeeds and adds source\_runs rows.
- [ ] P2.7 Write health.py and telegram.py; send an admin message if a source had 0 events or errors for 2 days, or if the whole run failed.
  - Check: temporarily break the Unstop URL, run twice with the time window shortened for testing, and receive the alert.
- [ ] P2.8 Create test.yml so pytest runs on every push.

## Phase 3: Location, trust and Telegram alerts (week 3)

Goal: I get useful Telegram alerts for NCR and online hackathons, with distance and trust labels. This is the first real milestone.

- [ ] P3.1 Write geocode.py: cache lookup, Nominatim structured query at 1 request per second with a named User-Agent, city-centre fallback, cap of 50 new lookups per run.
  - Check: a Gurugram venue gets coordinates; a second run makes zero Nominatim calls for it.
- [ ] P3.2 Add shared/cities.json (major Indian cities with coordinates) for fallbacks and the app's city picker.
- [ ] P3.3 Write trust.py with the label order and 5 red flags; thresholds in config.
  - Check: one test per red flag and per label.
- [ ] P3.4 Write match.py (alert filter matching and best-match score) and shared/match\_cases.json with 10 examples.
  - Check: all 10 cases give the expected result.
- [ ] P3.5 Temporary: add a test user in the Supabase Auth dashboard, then a devices row for me using that user's id, with Gurugram and my prefs (devices.id must match an auth user).
- [ ] P3.6 After each run, send new matching events to my Telegram as one grouped message with title, distance, deadline, fee and link.
  - Check: next scheduled run sends me a message only if something new matched; no repeats of old events.
- [ ] P3.7 Send Telegram change alerts for my saved events (saved by hand in the dashboard for now).
- [ ] P3.8 Use it for a few days. Note every hackathon I hear about that the bot missed, in docs/misses.md.

## Phase 4: App skeleton, feed and onboarding (week 4)

Goal: the app on my phone shows the real feed, opens event details, and knows my city.

- [ ] P4.1 Learn the basics first: follow Expo's official "Get started" tutorial for one evening before touching the real app.
- [ ] P4.2 Create the Expo app in app/ with expo-router; add tabs Feed, Saved, Settings with placeholder text.
  - Check: runs on my phone.
- [ ] P4.3 Add theme.js with the light and dark color tokens, type sizes and spacing from the Design Brief.
- [ ] P4.4 Connect supabase-js with AsyncStorage; do anonymous sign-in on first launch; create my devices row.
  - Check: a new row appears in devices with my auth id.
- [ ] P4.5 Build the sync function (updated\_at paging) and the local cache in AsyncStorage.
  - Check: turn on airplane mode, reopen the app, cached events still show with the offline banner.
- [ ] P4.6 Build the EventCard component exactly as specified; then the Feed list with pull to refresh.
- [ ] P4.7 Build Event detail with Apply (domain shown, only http/https allowed), Share, Open in Maps.
- [ ] P4.8 Build the 5 onboarding steps, including GPS with expo-location and reverse geocoding, and the city picker fallback.
  - Check: GPS fills Gurugram, Haryana; denying permission opens the city picker.
- [ ] P4.9 Test both themes and the largest font size on my phone.

## Phase 5: Filters, sorting, saving, reminders (week 5)

Goal: I can find, save and get reminded about hackathons without leaving the app.

- [ ] P5.1 Port match.py's filter and score logic to app/lib/match.js; run shared/match\_cases.json in a Jest test.
  - Check: same 10 results as Python.
- [ ] P5.2 Add search, the sort menu and the Filters bottom sheet with a live "Show N" count.
- [ ] P5.3 Add "Save as my alert filter"; write it to devices.alert\_filter.
- [ ] P5.4 Add Save on cards and detail; write saved\_events; build the Saved tab with Interested and Registered.
- [ ] P5.5 Schedule local reminders with expo-notifications (7 days, 48 h, 24 h, respecting quiet hours); store notification ids; cancel on unsave.
  - Check: save a test event with a deadline 25 hours away; the 24-hour reminder arrives with the phone locked.
- [ ] P5.6 Registered flow: cancel deadline reminders, schedule the "starts tomorrow" reminder; "Did you register?" prompt after Apply.
- [ ] P5.7 Settings screen: preferences, location, quiet hours, digest mode, hide warnings, delete my data.
  - Check: Delete my data removes the server rows and returns to onboarding.
- [ ] P5.8 Test reminders with Samsung battery optimization on and off; add the Settings tip if needed.

## Phase 6: Push notifications and daily-use APK (week 6)

Goal: new matches and changes arrive as real app notifications, and the app is installed as a normal APK I use every day.

- [ ] P6.1 Create a Firebase project, add FCM v1 credentials to the Expo project with EAS.
- [ ] P6.2 Make a development build with EAS Build and install it (push does not work in Expo Go).
  - Check: the Expo push notification test tool delivers a test message to my phone.
- [ ] P6.3 In the app: ask notification permission (Android 13+), get the Expo push token, save it to devices on every start.
- [ ] P6.4 In the collector: notify.py sends grouped new-match pushes and change pushes in chunks of 100, stores tickets in push\_tickets.
- [ ] P6.5 Receipt check at the start of each run; clear tokens on DeviceNotRegistered; admin Telegram alert on credential errors.
- [ ] P6.6 Quiet hours and digest: queue into pending\_digest; send at the first run after 8 am IST.
- [ ] P6.7 Notification tap routing: one event opens detail; several open the Feed filtered to those events.
  - Check: tap each of the 4 notification types and land on the right screen.
- [ ] P6.8 Turn off the Telegram match alerts (keep admin alerts).
- [ ] P6.9 Turn on Expo enhanced push security; add the access token as a GitHub secret.
- [ ] P6.10 Build a "preview" APK with EAS, install it, and back up the signing keystore.
- [ ] P6.11 Add the weekly backup and cleanup workflows from the Backend Schema doc.
- [ ] P6.12 Write the README: what it does, setup steps, threat model, RLS test results, screenshots.

## Progress log and definition of done

Version 1 is done when I use the app daily for one full week without opening Unstop or Devpost to look for events, and no saved deadline is missed.

Definition of done (all must be true):

- [ ] Collector has run on schedule for 7 days with no unnoticed failure.
- [ ] At least 2 sources plus manual entries feed the app.
- [ ] Feed, filters, sort, detail, save, reminders and push all work on my phone.
- [ ] RLS checklist passes; no secrets in the repo or the APK.
- [ ] README explains setup and security choices.
- [ ] docs/misses.md shows coverage of at least 80% of events I heard about elsewhere.

If a week slips: cut polish and nice-to-have tasks first. Never cut P2.7 (health alerts) or P1.8 and the RLS checks.

Progress log (one line per session: date, tasks done, what broke, next task):

- 27 Sep 2026: planning docs finished. Next: P0.1.

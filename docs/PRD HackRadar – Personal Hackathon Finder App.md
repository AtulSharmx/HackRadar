# PRD: HackRadar – Personal Hackathon Finder App

Sep 27, 2026 · @Atul Sharma

## Summary

HackRadar (working name) is a personal Android app that pulls hackathons from several platforms into one list, filters them by my location and preferences, and alerts me before I miss a deadline.

- Who: me first (a second-year BCA student in Gurugram), then friends and my college club if it proves useful.
- What: one feed of hackathons from Unstop, Devfolio, Devpost and events I add myself, with location auto-fill, filters, sorting, trust labels and deadline reminders.
- How: an Android app (built with Expo / React Native) talking to a small Python backend that collects and cleans the data.
- Why now: listings are scattered across sites, Instagram and WhatsApp, and the big platforms do not filter well by city or distance.

One-line pitch: every hackathon I can actually join, near me or online, in one app, with a reminder before it closes.

## Problem

Finding the right hackathon takes too much checking, and the ones I care about most (offline, nearby, free, open to BCA) are the hardest to find.

1. Scattered sources. Big events live on Unstop, Devfolio and Devpost. Small college events often live only on Instagram, WhatsApp groups and posters.
2. Weak location filtering. Platforms show a city name, but there is no easy way to ask "offline events within 50 km of Gurugram".
3. Noise. Unstop mixes hackathons with jobs, quizzes and internships, so hackathons get buried.
4. Eligibility surprises. Many events are only for BTech, a specific year, or a specific state. I often find out after reading the full page.
5. Missed deadlines. Nothing reminds me about an event I was interested in until it has already closed.
6. Trust. Some events charge high fees or have unclear organizers, and it is hard to tell at a glance.

## Goals and non-goals

Version 1 succeeds if I stop checking other sites manually and never miss a deadline for an event I saved.

Goals for version 1:

- One list of open hackathons from at least 2 sources plus events I add by link.
- Location auto-fill (city and state) from the phone's GPS, with manual override.
- Filters, sorting and search that answer "what can I join this month?" in under 30 seconds.
- Phone notifications for new matching events and for deadlines of saved events.
- Clear labels for fee, missing information and possible warnings.
- A way to know when a data source stops working.

Non-goals for version 1:

- Applying on my behalf. The app only opens the official registration page.
- Accounts for other users, login screens, or publishing on the Play Store.
- iPhone support.
- Organizer dashboards, team finder, chat, or monetization.
- A promise that every event is genuine. The app shows signals, not guarantees.

## Target user and user stories

The first user is me: a BCA student in Gurugram with an Android phone, interested in AI, cybersecurity and web development, who can travel within Delhi NCR and prefers free events.

Later users, only after version 1 works for me: friends in my class, then a college tech club.

User stories:

1. As a student, I open the app and see all open hackathons I am eligible for, newest first.
2. As a student, I tap "Use my location" once and the app fills Gurugram, Haryana, so offline events near me show up.
3. As a student, I filter to "offline, within 50 km, free, AI or cyber" and get a short list.
4. As a student, I sort by "closing soonest" to see what needs action this week.
5. As a student, I read a one-line summary (fee, mode, team size, deadline) without opening the full page.
6. As a student, I tap Apply and the official registration page opens.
7. As a student, I save an event and get reminders 7 days, 48 hours and 24 hours before the deadline.
8. As a student, I get a phone notification when a new event matches my saved filters.
9. As a student, I paste a link to a college hackathon I saw on Instagram, and it gets added to my list.
10. As the builder, I get an alert when a source has returned nothing for 2 days, so I can fix the scraper.

## Market research

The idea already exists in many forms, so HackRadar should not try to beat these platforms. It should sit on top of them and do the personal filtering they do badly.

What exists today (checked 27 Sep 2026):

- [Unstop](https://unstop.com/hackathons): the biggest Indian board, with 2,540+ hackathons listed, plus an Android app promising personalized recommendations and deadline alerts ([Play Store](https://play.google.com/store/apps/details?id=com.dare2compete.app&hl=en_IN)). Hackathons are mixed with jobs, internships and quizzes. A developer who built a scraper for it noted that its city filter does not really work on the server side ([Apify](https://apify.com/dami_studio/unstop-scraper)).
- [Devfolio](https://guide.devfolio.co/docs/guide/participating-in-hackathons/hackathon-modes): runs registration for many Indian hackathons and tags each one Online or Offline, but it is a registration tool, not a personal discovery feed.
- [Devpost](https://apify.com/automation-lab/devpost-scraper): the largest global platform, with 13,000+ competitions and a public JSON feed that needs no login.
- [HackIndia](https://hackindia.org/): a circuit of AI and Web3 hackathons across 52+ cities.
- [indiahackathons.com](https://indiahackathons.com/): the closest competitor. It aggregates Luma, Eventbrite, Meetup, Devpost and direct submissions, groups events by 10 hub cities, and charges organizers for "Get Featured". It updates only weekly, and on 27 Sep 2026 it showed 27 upcoming events in total and 0 in Delhi NCR.
- Reskilll, Internshala and Where U Elevate also list hackathons, with basic filters.
- Student projects on GitHub already do most of this as bots: a [Hyderabad Telegram bot](https://github.com/Sushanth-Patel/hackathon-alert-automation) that uses Gemini to extract venue and team size, an [Unstop-to-Telegram notifier](https://github.com/yashraj-ghemud/unstop-scraper) with city and fee filters, and a [multi-source aggregator](https://github.com/Hari564-tech/hackathon) on Supabase.

Gaps worth building for:

1. Nobody offers "within X km of me" for offline events in India. Everyone stops at the city name.
2. Coverage of small college events is poor. The indiahackathons count of 0 for Delhi NCR shows how much never reaches aggregators.
3. Eligibility (degree, year) is not filtered anywhere I checked.
4. No one combines several sources into one de-duplicated feed with deadline reminders inside a phone app.

Honest takeaway: none of these gaps is a moat. Unstop could add a distance filter in one update. That is fine for a personal tool and a portfolio project, but it is a weak base for a startup today.

## Features (MVP scope)

The MVP has 9 features. P0 must ship in version 1; P1 ships only if time allows.

1. Onboarding and preferences (P0)
   - One-time setup: themes (AI, cyber, web dev, etc.), mode (online, offline, both), degree, year, fee preference, max travel distance.
   - No login in version 1. Preferences live on the phone and are sent to the backend with a device ID.
   - Done when: setup takes under 1 minute and can be changed later in Settings.
2. Location auto-fill (P0)
   - "Use my location" asks for GPS permission once, then fills city and state automatically.
   - Manual city and state picker if permission is denied.
   - Only city, state and rough coordinates are stored, never a location history.
   - Done when: tapping the button fills Gurugram, Haryana correctly.
3. Hackathon feed (P0)
   - One scrolling list of open hackathons from all sources, with duplicates removed.
   - Each card shows: title, organizer, mode, city or Online, distance, deadline countdown, fee, prize, and trust label.
   - A one-line summary, for example "Free, offline, 12 km away, 2-4 members, AI, closes in 5 days".
4. Filters and search (P0)
   - Mode, free or paid, theme, city, state, distance (10, 25, 50, 100 km, anywhere), closing soon (under 7 days), eligible for me, solo allowed.
   - Text search on title and organizer.
   - Filters can be saved as "my alert filter" for notifications.
5. Sorting (P0)
   - Closing soonest, newest added, nearest, highest prize, best match.
   - Best match = simple score from theme match, distance, fee, and days left. No machine learning in version 1.
6. Event detail and Apply (P0)
   - Full details, source name, last checked time, warnings.
   - Apply button opens the official registration page in the browser.
   - Share button to send the event to friends on WhatsApp.
7. Save and track (P0)
   - Save an event, then mark it Interested or Registered.
   - Saved events drive deadline reminders.
8. Add event by link (P1)
   - Paste a link to any hackathon page. The backend fetches the page and fills what it can; I fix the rest by hand.
   - This is how local college events from Instagram or WhatsApp get in.
9. Source health (P0, admin only)
   - The backend tracks how many events each source returned per run.
   - If a source returns 0 events or errors for 2 days, I get a notification.

Notifications and trust labels are detailed in their own sections below.

## Data sources

Data is the hardest part of this project: start with Devpost and one Indian source, add events by link, and treat every scraper as something that will break.

Planned sources, in order:

1. Devpost. It has a public JSON feed that tools use without login ([Apify](https://apify.com/automation-lab/devpost-scraper), [devpost-api on PyPI](https://pypi.org/project/devpost-api/)). It is unofficial and undocumented, so it can change without notice. Filter to India and online events.
2. Unstop. It also serves public JSON, but its filters are unreliable, so filtering must happen on my side ([Apify](https://apify.com/dami_studio/unstop-scraper)). This is the most important source for Indian college events.
3. Devfolio. No public listing feed confirmed yet. Check before building; skip if it needs login.
4. Manual "add by link" for college events from Instagram, WhatsApp and posters.

Rules the collector must follow:

- Read each site's terms and robots.txt before adding it. If a site forbids automated access, use it only through manual links.
- Never log in, bypass a CAPTCHA, or dodge blocks.
- Run at most every 6 hours per source, with a delay between requests and a clear User-Agent naming the app.
- Store only event facts and the source link, never copy full descriptions for display.
- Keep it personal-use. Showing scraped data to the public or charging money for it needs permission first.

Location data:

- My location: the phone's own reverse geocoding (built into Expo's location library) turns GPS into city and state, so no third-party service is needed.
- Venue coordinates: the backend geocodes each venue address once with OpenStreetMap's Nominatim and caches the result. Nominatim allows at most 1 request per second, needs an identifying User-Agent, and forbids bulk use ([OSM community](https://community.openstreetmap.org/t/clarification-on-nominatim-usage-policy/102661)). A few dozen new venues a day is well within that.
- If a venue has no clear address, fall back to the city centre and label the distance "approximate".

Duplicate removal:

- Same registration URL = same event.
- Otherwise compare normalized title, start date (within 1 day) and city. A strong match merges; a weak match is kept separate and flagged for me to check.

## Notifications

Deadline reminders run on the phone itself; new-event alerts come from the backend through Expo's push service; Telegram is the temporary fallback until push works.

Two kinds of notifications:

1. Deadline reminders (local). When I save an event, the app schedules reminders on the phone for 7 days, 48 hours and 24 hours before the deadline. These need no server and work even if the backend is down. If the deadline changes, the app cancels and reschedules them.
2. New matching events (remote). After each collection run, the backend checks new events against my saved alert filter and sends a push through the Expo push service, which delivers through Google's Firebase Cloud Messaging on Android ([Expo docs](https://docs.expo.dev/push-notifications/push-notifications-setup/)).

Setup facts to plan for:

- Push does not work in the Expo Go test app on Android since SDK 53. I need a development build of my own app ([Courier guide](https://www.courier.com/blog/expo-notifications), [Expo docs](https://docs.expo.dev/push-notifications/push-notifications-setup/)).
- Android needs Firebase (FCM v1) credentials added to the Expo project.
- Android 13 and above asks the user for notification permission at runtime; without it, notifications silently never appear ([DEV guide](https://dev.to/russel_dsouza_bd584a3cb2a/push-notifications-in-react-native-the-complete-2026-guide-2d4g)).
- Push needs a real phone, not an emulator.

Rules so the app does not become annoying:

- Group new matches: at most one "new hackathons" notification per collection run, listing up to 3 titles.
- Quiet hours from 11 pm to 8 am.
- Optional daily digest mode instead of instant alerts.
- Tapping a notification opens that event inside the app.
- Important changes to a saved event (deadline or venue) get their own notification.

Fallback: in weeks 1 to 3, before the app exists, the backend sends the same alerts to a Telegram bot. Telegram messages already appear in the phone's notification bar, so this is useful from day one.

## Trust and genuine-event labels

The app never says an event is "genuine"; it shows one of four labels based on simple rules, and hides nothing without telling me.

Labels:

- Trusted source: came from Devpost, Unstop or Devfolio, has an organizer name, dates and a registration link.
- Check details: some key field is missing (venue, deadline, eligibility or fee).
- Warning: one or more red flags below.
- Stale: not seen in the source for 3 runs, or deadline already passed.

Red flags (each one shown as a short reason on the card):

- Registration fee above ₹500 per team with no prize or perk listed.
- No organizer name, or the organizer is a person with no college or company.
- Dates conflict between sources.
- Only source is a social-media post with no official page.
- Registration link goes to a different domain from the event page.

Behaviour:

- Warning events stay visible but sink to the bottom when sorting by best match.
- A setting "Hide warnings" is off by default.
- Events I add by link start as "Check details" until I confirm them.
- Every card shows the source name and when it was last checked, so I can judge for myself.

The ₹500 threshold is a starting guess; I will adjust it after seeing real data.

## Tech stack and architecture

The cheapest design that works needs no always-on server: a scheduled Python job fills a hosted database, and the app reads from it directly.

How data flows:

1. Every 6 hours, a GitHub Actions workflow runs the Python collector.
2. The collector fetches each source, cleans the data, removes duplicates, geocodes new venues, and applies trust labels.
3. It saves events to a Supabase (PostgreSQL) database and records a health row per source.
4. It compares new events with my alert filter and sends pushes through Expo's push service (Telegram in the early weeks).
5. The Android app reads events straight from Supabase, filters and sorts them, and schedules deadline reminders on the phone.

Stack:

- Collector: Python 3.11+, requests or httpx, BeautifulSoup for HTML pages, rapidfuzz for title matching, geopy for distance.
- Scheduler: GitHub Actions on a cron schedule. Free, no server to keep alive.
- Database: Supabase free tier (PostgreSQL). Row-level security makes the events table read-only for the app.
- App: Expo (React Native, JavaScript), expo-location for GPS and city/state, expo-notifications for local and push notifications, installed as an APK through EAS Build.
- Optional API later: FastAPI, only when I need logic the app should not do (like "add by link"). Render's free tier would host it, but free services sleep after 15 minutes idle and take about a minute to wake ([Toolfreebie review](https://toolfreebie.com/render-hosting-review/)). Fine for personal use.

Why not SQLite: GitHub Actions starts a fresh machine every run, so a local file database would be lost. A hosted database solves that.

Security from day one:

- Supabase service key and Expo access token stored only as GitHub Actions secrets, never in code or the app.
- The app uses only the public anon key, with row-level security so it can read events but not change them.
- Only city, state and rounded coordinates stored; no location history, no phone number, no email in version 1.
- Validate and clean everything the collector reads, since scraped pages are untrusted input.

Free tier limits change often. Check current limits for GitHub Actions, Supabase and Expo EAS before starting.

## Data model

Five tables cover version 1: events, event\_sources, devices, saved\_events and source\_runs.

1. events (one row per real hackathon)
   - id, title, organizer, description\_short
   - mode (online, offline, hybrid)
   - venue\_address, city, state, lat, lng, location\_approximate (yes/no)
   - registration\_url, event\_url
   - registration\_deadline, start\_date, end\_date
   - themes (list), team\_min, team\_max, solo\_allowed
   - fee\_amount (0 = free), prize\_text, prize\_amount\_inr, perks (list)
   - eligibility\_text, eligible\_degrees (list), eligible\_years (list)
   - trust\_label, warnings (list)
   - first\_seen\_at, last\_checked\_at, status (open, closed, stale)
2. event\_sources (links each event to where it was found)
   - event\_id, source (devpost, unstop, devfolio, manual), source\_event\_id, source\_url, raw\_hash
   - One event can have several rows here, which is how duplicates are merged.
3. devices (me, and later friends)
   - id, expo\_push\_token, city, state, lat\_rounded, lng\_rounded
   - themes, modes, degree, year, fee\_preference, max\_distance\_km
   - alert\_filter (saved filter as JSON), quiet\_hours, digest\_mode
4. saved\_events
   - device\_id, event\_id, status (interested, registered), saved\_at
5. source\_runs (for health alerts)
   - source, run\_at, events\_found, new\_events, error\_text

Rules:

- raw\_hash stores a fingerprint of the source data, so the collector can spot changes to deadline or venue and notify saved users.
- Coordinates on devices are rounded to about 1 km, which is enough for distance filters and protects privacy.
- Deadlines and dates are stored in IST-aware timestamps so reminders fire at the right time.

## Roadmap

Version 1 takes about 6 weeks at 10 to 12 hours a week alongside college, and each week ends with something that works on its own.

1. Week 1: One source, end to end
   - Read Devpost and Unstop terms and robots.txt; pick what is allowed.
   - Python script that fetches Devpost events and prints clean rows.
   - Create the Supabase project and the events table; save rows to it.
   - Done when: running the script fills the database with real events.
2. Week 2: Second source, duplicates, schedule
   - Add Unstop. Add duplicate matching and event\_sources.
   - Move the script into GitHub Actions every 6 hours, with secrets.
   - Add source\_runs and the "no data for 2 days" check.
   - Done when: the database updates by itself and duplicates merge.
3. Week 3: Filters and alerts without an app
   - Geocode venues with caching; compute distance from Gurugram.
   - Trust labels and red flags.
   - Telegram bot sends matching new events and health alerts.
   - Done when: I get useful Telegram alerts for NCR and online events. This is already a usable product.
4. Week 4: App basics
   - Learn Expo basics; build the feed screen reading from Supabase.
   - Event detail screen with the Apply and Share buttons.
   - Onboarding and GPS auto-fill of city and state.
   - Done when: the app shows the real feed on my phone.
5. Week 5: Filters, sorting, saving, reminders
   - All P0 filters and sorts; best-match score.
   - Save and Interested/Registered status.
   - Local deadline reminders at 7 days, 48 hours and 24 hours.
   - Done when: I can find, save and get reminded without leaving the app.
6. Week 6: Push notifications and polish
   - Development build with FCM credentials; register the push token.
   - Collector sends Expo pushes for new matches; turn off Telegram.
   - Quiet hours, digest mode, bug fixes, and an APK installed on my phone.
   - Done when: I use the app daily for a week without opening Unstop.

After version 1 (only if I still use it): add-by-link, eligibility filtering, AI extraction of details from long pages and posters, then sharing the APK with friends.

If a week slips, drop polish, never the Week 2 health check.

## Success metrics

Version 1 is a success if, over the first month of use, it replaces manual checking and catches every deadline I care about.

- Coverage: at least 80% of open hackathons I find elsewhere (by chance or from friends) are already in the app. Track every miss in a note.
- Freshness: new events appear within 6 hours of being posted on a connected source.
- Missed deadlines: zero missed deadlines for saved events.
- Signal: at least half of the new-event notifications are ones I open.
- Reliability: any source failure is noticed within 2 days.
- Real outcome: I register for at least 2 hackathons found through the app in the first 2 months.

If coverage stays below 50% after a month, the problem is data, not the app, and adding sources or add-by-link comes before any new feature.

## Risks, open questions and later features

The biggest risk is data: if sources block access or miss local events, the app looks empty no matter how good it is.

Risks and what to do:

1. A source changes its format or blocks requests. Mitigation: health alerts, one parser file per source, and add-by-link as a backup.
2. Terms of service forbid automated access. Mitigation: check before building, keep it personal, never bypass blocks.
3. Local NCR college events never appear online. Mitigation: add-by-link early; later, poster upload with AI extraction.
4. React Native learning takes longer than planned. Mitigation: Telegram alerts from Week 3 mean the project is useful even if the app is late.
5. Free tiers change or pause. Mitigation: keep the collector portable; the whole thing can move to another host.
6. Notification fatigue. Mitigation: grouping, quiet hours, digest mode, and tracking how many alerts I open.
7. Wrong eligibility or fee data. Mitigation: always show source and last-checked time; never hide an event silently.

Open questions:

- [ ] Does Devfolio offer any listing feed that does not need login?
- [ ] What do Unstop's and Devpost's terms say about automated access for personal use?
- [ ] Is this also my final-year project? If yes, what does the college require in the report?
- [ ] Which source finds the most Delhi NCR offline events in practice?

Later features, in rough order:

- Add-by-link and poster upload with AI extraction of details.
- Eligibility filter based on degree and year.
- Remembering yearly events (like Smart India Hackathon) and alerting before they open.
- Sharing with friends: simple login, then a college club group feed.
- Teammate finder.
- Startup direction only if other students actively ask for it; organizer listings and featured spots are the realistic revenue ideas.

## Sources

Checked 27 Sep 2026: [Unstop hackathons](https://unstop.com/hackathons), [Unstop Play Store](https://play.google.com/store/apps/details?id=com.dare2compete.app&hl=en_IN), [Apify Unstop scraper notes](https://apify.com/dami_studio/unstop-scraper), [Devfolio modes](https://guide.devfolio.co/docs/guide/participating-in-hackathons/hackathon-modes), [Apify Devpost scraper](https://apify.com/automation-lab/devpost-scraper), [devpost-api](https://pypi.org/project/devpost-api/), [HackIndia](https://hackindia.org/), [indiahackathons.com](https://indiahackathons.com/), [Hyderabad alert bot](https://github.com/Sushanth-Patel/hackathon-alert-automation), [Unstop Telegram notifier](https://github.com/yashraj-ghemud/unstop-scraper), [Multi-source aggregator](https://github.com/Hari564-tech/hackathon), [Nominatim policy discussion](https://community.openstreetmap.org/t/clarification-on-nominatim-usage-policy/102661), [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Courier Expo guide](https://www.courier.com/blog/expo-notifications), [DEV push guide 2026](https://dev.to/russel_dsouza_bd584a3cb2a/push-notifications-in-react-native-the-complete-2026-guide-2d4g), [Render free tier review](https://toolfreebie.com/render-hosting-review/).

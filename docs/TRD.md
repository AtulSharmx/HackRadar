# TRD: HackRadar (v2, public app)

29 Sep 2026 · replaces "TRD HackRadar – Personal Hackathon Finder App" (v1; kept in git history).
Describes what is built today and what gets built next. Product decisions live in docs/PRD.md.

## Architecture

```
 Unstop · Devfolio · Hack2Skill · Devnovate        organizers + students (Submit, Report)
            │  (public JSON, allowed)                          │ app, RLS: own rows only
            ▼                                                  ▼
 GitHub Actions: collector (Python) ──fetch_url()──▶ Supabase Postgres ◀── Android app (Expo)
   every 6 h · adapters · normalize · dedupe ·          events, sources, changes,    guest sign-in,
   trust · geocode · changes · submissions ·           devices, saved, submissions,  feed cache,
   alerts · health                                      reports, push tokens          reminders
            │                                                  │
            ▼                                                  ▼
   Telegram (admin: health, weekly quality,         Expo push → FCM → phones
   moderation queue)                                (new matches, saved-event changes)
```

- **Collector** runs on GitHub Actions (free, private repo). Sources block GitHub's IPs, so page
  fetches go through the database function `fetch_url` (exact-endpoint allowlist, service key only).
  *(built)*
- **Database** is one Supabase project; RLS on every table; anon gets nothing, a signed-in app user gets
  read on public tables and own rows elsewhere; the collector uses the service key. *(built)*
- **App** is Expo SDK 57 + expo-router, guest-first; it reads Supabase directly and caches the feed
  on the phone. *(built through the Saved tab)*

## Sources

| Source | Endpoint | Status |
|---|---|---|
| Unstop | `GET unstop.com/api/public/opportunity/search-result` + detail `GET /api/public/competition/{id}` | list built; detail enrichment next |
| Devfolio | `POST api.devfolio.co/api/search/hackathons` | next (needs a POST variant of fetch_url) |
| Hack2Skill | `GET hack2skill.com/api/v1/innovator/public/event/public-list` | after a terms check |
| Devnovate | `GET devnovate.co/api/v1/events` | after a terms check |
| Devpost | `GET devpost.com/api/hackathons` | code built, OFF until permission |
| Submissions | our `submissions` table | next |

Rules (unchanged, enforced in code): honest User-Agent, robots.txt checked every run, ≥ 2 s between
requests to a host, ≤ 20 pages per source per run, stop a source on 401/403/captcha/non-JSON,
retry only network errors and 429/5xx. One adapter per source, with saved fixtures and parser tests.
Evaluated and rejected: HackerEarth (403s, no hackathons listed), Reskilll (robots disallows /api/),
Lablab.ai (needs a headless browser past Cloudflare), GeeksforGeeks (robots disallows /),
re-listing sites (Hackathon.com, AllHackathons). Details: docs/data-plan.md.

## Collector run (every 6 h at :23 UTC)

1. Each enabled adapter fetches, parses and filters (open and India/online). A failure is isolated.
2. **Quality gate** (next): "is this a hackathon?" check, date sanity (start ≤ end, deadline ≤ end,
   nothing years away), prize outliers flagged. Failures go to review_queue, not the feed.
3. Sync: match known source links → dedupe new ones (URL, then title/date/city score; 90+ merge,
   75–89 review) → merge with **per-field source precedence** → trust label + warnings → fingerprint;
   tracked-field changes go to event_changes. Events linked to a failed source are left untouched. *(built;
   precedence next)*
4. End of run: close passed deadlines; count missing runs for sources that ran; stale after 3. *(built)*
5. Geocode new venues (cache → Nominatim → city centre, approximate flagged). *(built)*
6. Publish approved submissions (next).
7. Alerts: push to devices with tokens (next); Telegram only for the admin's own marked row. *(built)*
8. Health: per-source alert after 2 days of zero or errors; whole-run failure alert from the workflow. *(built)*
9. Weekly (Monday): data-quality report per source and field; retention cleanup; database backup.

## Data model

Built: events, event_sources, event_changes, devices (id = auth user id), saved_events, manual_events,
source_runs, geocode_cache, push_tickets, pending_digest, review_queue. Migrations 0001–0008.

Next migrations:
- **submissions** (id, user_id → auth.users, url, fields jsonb, status pending/approved/rejected,
  reason, event_id, created_at). RLS: a user inserts and reads only their own; max 5 per user per day
  (check in the insert policy); only the collector/admin changes status.
- **reports** (id, user_id, event_id, reason enum wrong_date/fake/duplicate/closed/other, note ≤ 300
  chars, created_at). RLS: insert own, read own. Unique (user_id, event_id, reason).
- **push_tokens** (user_id, expo_push_token unique, platform, updated_at): one row per phone, since a
  logged-in user can have several.
- **events.organizer_verified** boolean, set by the admin.
- events.description_short stays for parsing (themes, eligibility) but is no longer shown in the app.

## Submissions (next)

1. App: paste a link. The collector (not the database, not the phone) fetches it on the next run with
   an SSRF guard: https only, public IPs only (resolve and reject private/loopback/link-local ranges),
   ≤ 2 MB, 10 s timeout, no auth, max 3 redirects each re-checked.
2. Parse in order: known platform link (reuse that adapter's detail API) → schema.org `Event` JSON-LD →
   OpenGraph + visible dates. Whatever is found pre-fills the form; the submitter fixes the rest.
   Google Forms and Instagram posts are accepted as links, but the details come from the submitter.
3. The admin gets a Telegram message per pending submission and approves or rejects it in the Supabase
   table (a one-tap approve flow is P1). Approved ones become events with source = 'manual'
   (the existing manual adapter path), go through the same quality gate, dedupe and trust rules.
4. A submitter whose event is approved sees "Live" on it; rejected ones show the reason.

## App

Built: onboarding (5 steps), feed with incremental sync and offline cache, search/filter/sort with the
shared match rules (shared/match_cases.json passes in Python and JS), detail, save + Saved tab,
design system (MOBILE-DESIGN.md).

Next, in order:
1. **Development build** (EAS, profile `development`): needed for expo-notifications (it can't even be
   imported in Expo Go on Android since SDK 53) and for native Google sign-in.
2. Reminders: expo-notifications local schedules (7 d, 48 h, 24 h; quiet hours; cancel on unsave).
3. Push: register the token → push_tokens; the collector sends via the Expo push API, checks receipts
   next run, drops dead tokens.
4. Submit event screen, Report sheet, Add-to-calendar (an intent with the deadline), share text.
5. Account linking: Google (`signInWithIdToken` / `linkIdentity`), email code (custom SMTP).
6. Settings with Delete my data (in-app, plus a web URL for Play's data deletion requirement).

## Limits and cost

| Item | Free limit | Our use | Plan |
|---|---|---|---|
| Supabase DB | 500 MB | < 50 MB for a year of events | fine |
| Supabase egress | 5 GB/month | first sync ~0.5 MB per install, then small deltas | select needed columns; Pro past ~5k weekly users |
| Supabase auth | 50k MAU | guests count as users | Pro when close |
| Supabase pause | after 7 days idle | collector writes every 6 h | fine |
| GitHub Actions | private repo minutes | ~1 min × 4 runs a day | fine |
| Expo push, EAS builds | free tier | a few builds a month | fine |
| Google Play | $25 one time | personal account: 12 testers × 14 days closed test first | plan the test with college friends |

## Security and privacy

- RLS everywhere; the live RLS check script covers every app-facing table (extend it for submissions,
  reports and push_tokens).
- Secrets only in .env and GitHub secrets; the pre-commit hook blocks keys, tokens and .env.
- `fetch_url` allows exact endpoints only (redirects can't be disabled in the http extension).
- Submitted links are fetched by the collector with the SSRF guard above, never by the database.
- DPDP: privacy notice at onboarding, purpose-limited data, delete-my-data, a grievance contact,
  breach notice within 72 h; full compliance by 13 May 2027.

## Testing

- Collector: pytest (fixtures per source, normalize, dedupe, changes, trust, geocode, health, notify,
  shared match cases). App: jest (format, feed sync, saved, prefs, match cases, feed view).
- Before each release: RLS check script, a manual run on GitHub, one full pass on a real phone in both
  themes at the largest font.

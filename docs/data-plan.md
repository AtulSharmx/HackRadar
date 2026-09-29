# Data plan: more sources, better data (29 Sep 2026)

Goal: a public app students trust, so every event must be real, current, and correctly described.
Everything below was checked live on 29 Sep 2026 with HackRadar's honest User-Agent, not copied from other projects.

## 1. Where we are (measured on the 233 open events)

| Field | Filled | Problem |
|---|---|---|
| Registration deadline, organizer, fee, team size, description | 100% | fine |
| Eligibility text | 99% | free text only, not structured (degree/year) |
| Cash prize | 57% | many prizes are goodies/certificates, fine, but some amounts are missed |
| Themes other than "other" | 60% | 40% land in "other", weak keyword mapping |
| Exact venue location (offline) | 42% | small colleges missing in OpenStreetMap |
| **Event start date** | **0.9%** | Unstop's list API doesn't send it; the detail API does |
| Non-hackathons (esports, poster, olympiad) | ~2% | no "is this a hackathon?" check |

One source (Unstop) supplies everything, so the app is one outage away from empty.

## 2. Sources checked

What other people already built: four open-source aggregators on GitHub
(haridharshini899/hackathon-api, HackathonFeed/Dev-ScraperPipeLine, naveedsheriffj/hackathon-scraper,
KevStatic/HackScout) cover 16 platforms. Two things they do that we won't:
browser-User-Agent rotation to dodge blocks, and one of them fills in **fake fallback events** when a
fetch fails. HackRadar keeps its honest name, respects robots.txt, stops on blocks, and never invents data.

| Platform | Open now | How | robots.txt | Terms on scraping | Verdict |
|---|---|---|---|---|---|
| **Unstop** | 233 | JSON list + **detail API** (`/api/public/competition/{id}`: start date, rounds) | allows `/api/public/` | none found | in use; add detail enrichment |
| **Devfolio** | 27 open | JSON `POST api.devfolio.co/api/search/hackathons` (reg deadline, city, state, online, team size, themes, prizes, **verified** flag) | allows all (both domains) | none found | **add first**: Indian college hackathons, very clean |
| **Hack2Skill** | 9 open (18 listed) | JSON `hack2skill.com/api/v1/innovator/public/event/public-list` (registration + submission dates, mode, ticket = fee) | allows | not checked yet | add (check terms first) |
| **Devnovate** | ~20 open (297 total) | JSON `devnovate.co/api/v1/events` | allows all | not checked yet | add (check terms first) |
| Knowafest | 40 upcoming | HTML + one detail page per event (has "Registration Fees") | allows | not checked yet | later: college fests, but HTML parsing is fragile |
| WhereUElevate | 3 open | JSON `api.whereuelevate.com/.../drills/search` | allows | not checked yet | later: low volume, many are hiring challenges |
| MLH | 72 upcoming, ~1 in India | JSON inside the season page | allows `/seasons` | not checked yet | later: only its online events matter to us |
| HackerEarth | 0 hackathons right now | JSON `/api/events/upcoming/` | allows | 403s reported by others | skip for now |
| Devpost | ~70 | JSON | allows | **forbids scraping** | off until permission (docs/outreach.md) |
| Reskilll | ? | HTML only | **disallows `/api/`** | – | skip |
| Lablab.ai | – | needs a headless browser past Cloudflare | – | – | skip (that is bypassing a block) |
| GeeksforGeeks | – | – | disallows `/` | – | skip |
| Hackathon.com, AllHackathons | – | HTML re-listings of other platforms | – | – | skip: copies of copies, worse data |
| Manual entries / add-by-link | – | our own table | – | – | build: college notices, WhatsApp groups |

Expected result: roughly 233 → 330-370 open events after dedupe, from 4 independent sources.

## 3. Data quality plan

**A. Completeness**
- Unstop detail API for start date, rounds and structured eligibility (0.9% → ~100% start dates).
- Per-source field map written down, so each source fills every field it actually has.
- Weekly completeness report per source and field (Telegram), so drops are noticed.

**B. Correctness**
- Field precedence per source instead of "most detailed row wins": the deadline comes from the platform
  where registration actually happens; the venue from the organizer's own listing.
- Validation before saving: start ≤ end, deadline ≤ end, no dates years away, prize sanity (outliers
  flagged, not guessed), explicit time zones.
- "Is this a hackathon?" check: the source's own category first, then rules for esports, quizzes,
  olympiads, posters, hiring-only drives. Doubtful ones go to review_queue, not the feed.
- Themes v2: read tags, skills and description, not just the title; target under 15% "other".
- Location v2: cache manual fixes for colleges OpenStreetMap doesn't know; target 70%+ exact.

**C. Freshness**
- Every 6 hours (already); closed within one run of the deadline (already).
- Weekly dead-link check on registration URLs; broken links get a warning.

**D. Trust**
- Carry source trust signals (Devfolio "verified", organizer present, official platform).
- "Report wrong info" in the app → review_queue, with the reason.
- Every event shows where it's listed and when it was last checked (already on detail).

**E. Staying reliable**
- One adapter per source with saved fixtures and parser tests (the pattern we already use).
- Health alerts per source (already), plus alerts when a source's parse rate or field completeness drops.
- `fetch_url` allowlist grows by exact endpoints only; Devfolio needs a POST variant.

**F. Permissions**
- Courtesy emails to Devfolio, Hack2Skill and Devnovate too, same template as docs/outreach.md.
- Attribution on every card and detail ("Listed on Devfolio"), links always go to the source.

## 4. Order of work

| # | Work | Check |
|---|---|---|
| 1 | Unstop detail enrichment (start dates, rounds) | start date filled on 95%+ of Unstop events |
| 2 | "Is this a hackathon?" filter + themes v2 | "other" under 15%, zero esports/poster events in the feed |
| 3 | Devfolio adapter (+ fetch_url POST, fixtures, tests) | 25+ Devfolio events, cross-source duplicates merged |
| 4 | Terms check, then Hack2Skill and Devnovate adapters | each adds events without duplicates |
| 5 | Validation rules + weekly quality report | report arrives on Telegram every Monday |
| 6 | "Report wrong info" + manual entries (P2.5) | a reported event reaches review_queue |
| 7 | Knowafest, MLH online, WhereUElevate (after terms check) | only if 1-6 are stable |

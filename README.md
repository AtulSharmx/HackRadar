# HackRadar

Every hackathon an Indian student can actually join, near them or online, in one list, with an
honest label on each event and a reminder before it closes.

Hackathon-only, India-first. The Android app is in testing.

## Why this exists

Finding hackathons in India is harder than it should be.

The biggest gap is not on any platform at all. A lot of college hackathons are promoted only
through Instagram posters, LinkedIn and WhatsApp groups, and they take registrations through a
Google Form. A scraper never sees them.

The ones that are listed are scattered. Unstop, Devfolio, Hack2Skill, Devpost and the rest each
show only their own events, and Unstop mixes hackathons in with jobs, quizzes and esports.

Then there is trust. "Pay Rs 500 to 2,000 to register" scams target students, and nobody labels
them.

So HackRadar collects from every source it can reach, lets students and organisers submit the events no
scraper sees, and puts a trust label and a match score on each one.

## What's in here

| Folder | What it is |
|---|---|
| `collector/` | Python pipeline: fetches 11 sources, cleans, dedupes, scores, writes to Supabase |
| `app/` | The Android app. Expo SDK 57 with expo-router, Supabase auth and Google Sign-In |
| `supabase/` | Postgres schema and row-level security, as seven migrations |
| `shared/` | Data the collector and the app must agree on: cities, constants, match test cases |
| `site/` | The landing page |
| `docs/` | PRD, TRD, backend schema, app flow, design brief and the launch plans |

## How the collector works

One run is `python -m collector.main`. Every adapter fetches and parses in isolation, so a single broken
source can't take the run down; everything is deduped and saved together at the end.

```
adapters (11 sources) -> normalize -> quality gate -> dedupe -> sync (Supabase)
                                                                   |
                                                       match -> notify (push / Telegram)
```

| Stage | File | What it does |
|---|---|---|
| Fetch | `adapters/` | Devfolio, Devpost, Unstop, HackerEarth, Hack2Skill, ETHGlobal, Hackster, KnowAFest, Reskilll, HackIndia, DevEvents |
| Clean | `normalize.py` | Turns messy source text into real values: dates, money, mode, city, themes |
| Filter | `quality.py` | Keeps hackathons out of non-hackathon noise, and flags dates that can't be right |
| Merge | `dedupe.py` | Finds the same event across sources and merges the rows |
| Save | `sync.py` | Matches known links, dedupes the new ones, upserts into Supabase |
| Score | `match.py` | Alert filters and the match score. The app implements the same rules in JS, and both have to pass `shared/match_cases.json` |
| Alert | `notify.py`, `push.py` | New matching events, and changes to events someone saved |
| Watch | `health.py` | Warns when a source returns zero events, or only errors, across a whole window |

`community.py` handles the other half of the supply: hackathons people submit inside the app, and reports
that an event's information is wrong.

## Running the collector

```bash
pip install -r collector/requirements.txt
cp .env.example .env     # then fill it in
python -m collector.main
```

It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `HACKRADAR_CONTACT` is sent in the User-Agent so
sources have a way to reach me, and `MAX_DETAILS_PER_RUN` (default 60) caps how many detail pages a single
run will open.

## Running the app

```bash
cd app
npm install
npx expo start
```

## Status

The collector runs and fills the database. The Android app is in testing. HackRadar is my own idea and my
own build, and I want to launch it properly once the budget allows.

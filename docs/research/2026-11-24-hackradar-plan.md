# HackRadar: the plan (24 Nov 2026)

Lead product engineer's plan for Atul. It is built from the collector map, the app map, the past decisions, the source research, the user research and the 9-person user panel, plus my own read-only checks of the repo. Nothing in `D:/Projects/HackRadar` was changed.

**(unverified)** marks anything I could not check. Effort: **S** = half a day or less, **M** = 1–3 days, **L** = a week or more.

---

## 1. Verdict in 5 lines

1. **Today the app does not solve the student's problem, because its data has stopped.** All 121 scheduled collector runs failed (the repo has zero Actions secrets), and the failure alert can't send either. Fixing this comes first, because everything else depends on it.
2. **Most of the extra hackathons come from fixing sources we already read, plus two new legal ones.** The fixes are the dev.events bug, "opens soon" events from Devfolio and HackIndia, and a stronger quality gate. The new sources are GDG now and Hackathons India after an email. That gives about **250 joinable events, or about 300 with permissions**. It will not be 1,000. The bigger numbers elsewhere include closed events, CTFs and gigs.
3. **Balance the feed in the ranking, not in the collector.** Keep every Unstop event. Limit how many from one platform sit together on screen, and give every platform a chip with its count.
4. **Expiry is mostly built already.** Close the remaining gaps: events with no deadline, events that close early, and a database "clock" that keeps closing events even when the collector is down. Expired events stay in the saver's own Past list until they remove them.
5. **Product changes:**
   - The detail page answers "Can I join? Should I? By when?"
   - Onboarding answers actually shape the feed.
   - Registered becomes a milestone tracker.
   - Instant pushes only for strong matches that close soon. Everything else goes into one digest.
   - Telegram becomes the owner's admin console. A daily report comes every day, so a missing report is itself the alarm.

### 1b. Where the request contradicts itself, and my call

| He asked for | It clashes with | Decision |
|---|---|---|
| "Drop useless sources" | "Maximum quantity" | Drop only the sources that add zero joinable events: **Reskilll** (0 open of 173) and **KnowAFest** (already off, duplicates Unstop). Count quantity as *joinable hackathons*, not rows. The stronger quality gate removes about 25 non-hackathons from Unstop and Hack2Skill. The count goes down a little and trust goes up. |
| "Add by any means: APIs, scraping, Google, GitHub tools" | Sites' own Terms, and the project's source rules | "Any means" stops where a site's Terms or robots.txt say no: Devpost, MLH, DevSafar, and Luma's internal API. For those, ask permission. Scraping Google results breaks Google's terms too. Being clean is HackRadar's protection against Play Store and takedown trouble. |
| "No platform may crowd out others" | "More is better" | Unstop is about 60–65% of real supply even after the additions. Capping collection would cut quantity, so cap the *display* instead: at most 4 of any 10 cards in Best match and Newest. Never hide events. |
| "Notify users as soon as new hackathons arrive" | The 6-hourly schedule (it really fires about 2 a day), and push fatigue (37% of users turn notifications off at 2–5 pushes a week) | Make the runs **hourly and reliable**, so the delay is about 1–2 h. The default is still **one daily digest plus an instant push for a strong match that closes within 72 h**. "Instant for every match" is an opt-in mode capped at 3 a day. |
| "Keep expired events only for signed-in users who saved them" | The app is guest-first, and guests can save too | Keep them for **anyone who saved them**, on that phone. Signing in adds sync to other phones. If guests lost their saves, we would be punishing exactly the users we chose not to force into signing in. |
| "Professional detail page" | PRD rule: never copy source descriptions | Build a **summary made from facts** ("Online ideathon · AI · 3 rounds"). Whether to allow a one-line credited tagline is open question Q3. |
| "Telegram: tell users as soon as new ones arrive" | Telegram's job is admin-only | Users get push notifications. Telegram stays the owner's console. A public channel is a future idea (section 9). |

---

## 2. Platforms

### 2.1 Decision table

| Platform | Covered today? | Decision | Method | Effort | Risk | Confirmed? |
|---|---|---|---|---|---|---|
| **Unstop** | Yes (about 92% of events in Oct) | **Keep.** Balance it on screen, not in collection. | Public JSON list + detail API | S: quality-gate rules; store `registerCount` as a popularity tiebreak | Medium: undocumented API | **Confirmed live:** 180 open, all captured; 12–16% are not hackathons (CP contests, merch/design challenges, bug bounty, trading) |
| **Devfolio** | Yes | **Keep and widen.** Read `women_only`, `participants_count` and sponsors. Try the "upcoming" type for Opens soon. | Public search API (POST) | S | Medium: no organizer, no prize amounts | Fields confirmed in the fixture. **Live count unverified** (fixture 25). The "upcoming" type is **unverified**. |
| **Devpost** | No (adapter built, switched off) | **Keep off. Send the permission email (task A9).** Meanwhile its online events arrive legally through dev.events (4 of 5 sampled dev.events entries link to devpost.com). | JSON API (built) | S once allowed | Legal: Terms forbid scraping | Terms confirmed 30 Oct; fixture has 49 |
| **"Hackathon India" = HackIndia** (hackindia.org) | Yes | **Keep.** Show its 3 `upcoming` events as "Opens soon". Today `hackindia.py:64` drops them. | Next.js page data | S | High: the page format can change | Confirmed: 48 listed, 4 open, 3 upcoming (with null registration dates), 14 online. What "upcoming" means exactly is **unverified**. |
| **"Hackathons India" = indiahackathons.com** | No | **Add after a courtesy email.** Use `offers[].url` as the registration link and dedupe key; never use their `/go/` redirect. **Skip entries whose link is on devpost.com or lu.ma** until those platforms allow it, so we don't launder sources we chose not to read. No images, no copied text. Credit "via Hackathons India". | RSS (1 GET) + JSON-LD on new event pages only | S | Medium: second-hand data, small volume, many short meetups (the quality gate applies) | Confirmed: 33 RSS items, robots allows, no Terms page, no prize field |
| **Luma** | No. Only accepted as a submission link (`PLATFORM_HOSTS`). | **Don't collect.** Luma events reach us through Submit and (partly) Hackathons India. Later, possibly the ICS feeds of a hand-picked list of organizer calendars, which is Luma's own subscribe feature. | — | M if ever | Legal: Terms allow only "publicly supported interfaces", and `/discover` isn't one. Low volume. | Terms clause confirmed. Bengaluru gave about 1 real hackathon in 3 weeks. Other cities **unverified**. |
| **Hack2skill** | Yes | **Keep.** New quality-gate rules drop "Builder Pop-Up", "Meet the Builders", "Bootcamps", "Watch Face Design". | Public JSON list | S | Medium: no city or organizer | Confirmed: 21 in the window, about 9 real |
| **Google Developer Groups** (GDG, GDG on Campus) | No | **Add. First new source.** | Monthly sitemaps (this month + next 2), then JSON-LD and `__NEXT_DATA__` on event pages. robots.txt allows these; `/api/` is disallowed, so don't use it. | M | Medium: pages are 570 KB, so filter before fetching and fetch each URL only once. Hacktoberfest days and workshops are noise. Overlaps Hack2Skill (PromptWars, Futuready). Whether GDG can be reached from Actions or Supabase is **untested**. | robots.txt and fields confirmed. About 10–12 real Indian hackathons in October, a Hacktoberfest peak month; fewer in other months. |
| **"Devsafar" = DevSafar** (devsafar.app) | No | **Don't read it.** Use it only as a benchmark (compare its India and online counts monthly by hand) and add it to the competitor doc. | — | — | Its Terms forbid bots and copying | Terms confirmed (25 Jul 2026). Its counts are **unverified**. |
| **MLH** | No (the feed links out to it) | **No adapter.** Add the 1–2 Indian events a season by hand through the admin path. Ask MLH for permission; the real value is an "MLH Member Event" trust badge. | Season-page JSON, if allowed | S if allowed | Terms: personal, non-commercial use only | Confirmed: 37 upcoming, 2 in India (in person), 0 online |
| **HackerEarth** | Yes | **Keep** (cheap; 1 call) | Public JSON | — | Low volume (2–5, mostly hiring challenges) | Confirmed: 4 items |
| *Extra:* **dev.events** | Yes | **Keep and fix.** The regex bug lets US and other regional events through. Also read `/hackathons/AS/IN`, cache the official link per URL (stop fetching about 45 detail pages every run), and credit the real host ("Devpost via dev.events"). | JSON-LD pages | S | Medium: it's an aggregator | Bug confirmed: `devevents.py:25` has 0x08 bytes where `\b` was meant |
| *Extra:* **ETHGlobal** | Yes | **Keep, but run every 6 h**, not hourly (1.9 MB page) | Regex over a script tag | — | High fragility; 0–2 events | Confirmed: 1 kept |
| *Extra:* **Hackster** | Yes | **Keep-capped.** Label "Global contest · hardware". Part of the "global online" bucket (max 2 per 10 cards). | HTML regex | S | High fragility; contests run for months | Confirmed: 5 contests, one closing Jun 2027 |
| *Extra:* **Reskilll** | Yes | **Drop** (remove from `SOURCES`) | — | S | — | Confirmed: 0 open of 173 cards; 540 KB downloaded every run for nothing |
| *Extra:* **KnowAFest** | No (off) | **Drop.** Keep the code switched off; nothing to build. | — | — | Duplicates Unstop; non-hackathons | Confirmed: duplicates and non-hackathons seen |

Also worth doing, by hand rather than as feeds:
- Add **Smart India Hackathon** (one government event a year) as a manual entry when it opens.
- Ask **Internshala** for permission (200+ competitions; their Terms forbid copying).

### 2.2 Keeping the feed balanced (final rules)

1. **Credit the platform where the student registers.** Use the host of `registration_url` when it is a known platform. Otherwise use the source with the most detail.
   - Today `platformOf` takes the alphabetically first non-Unstop source, because `sync.py:66` stores the sources sorted. So an event on Devfolio and dev.events is shown as "dev.events".
   - Use this one key for chips, balancing and counts.
2. **Best match and Newest: at most 4 cards from one platform in any 10 in a row.** This replaces "at most 2 in a row".
   - When the next card would break the cap, lift the best event from another platform, but only if its score is at least 70% of the skipped one's **and** it passes the user's filters and distance.
   - If nothing qualifies, keep the original order. Weak events are never forced up.
3. **"Global online" bucket.** Hackster, ETHGlobal, and non-India dev.events or Devpost entries share one bucket, capped at 2 per 10 cards in Best match, so India-first stays India-first.
4. **Exact sorts stay pure:** Closing soonest, Starting soonest, Nearest and Highest prize. The Platform section of the filter sheet shows counts ("Unstop 156 · Devfolio 27 · Devpost via dev.events 34 · GDG 8 …"), so every platform is one tap away.
5. **Pushes and digests show at most 3 events per platform**, then "+5 more on Unstop".
6. **Collection is never capped per platform.** Only the quality gate and page limits apply.
7. **Watch it:**
   - The daily Telegram report shows each platform's share.
   - An alert fires if one platform is more than 80% of new events over 7 days, or if a platform has had 0 open events for 3 days.

### 2.3 Realistic volume (open, joinable events at any one time)

| Source | Estimate | Basis |
|---|---|---|
| Unstop, after the quality gate | 150–160 | 180 live, minus 12–16% |
| dev.events, after the regex fix, plus `/AS/IN` | 30–40 | 50 on pages 1–2, 26 of 30 online |
| Devfolio | 20–40, plus 5–10 Opens soon **(unverified)** | fixture 25; live count unverified |
| Hack2Skill | about 9 | live |
| HackIndia | 4, plus 3 Opens soon | live |
| Hackster / HackerEarth / ETHGlobal | about 5 / 2–4 / 0–2 | live |
| **GDG (new)** | +5–12, after removing Hack2Skill duplicates | October sitemap |
| **Hackathons India (new, after the email)** | +10–20, after meetups and Devpost/Luma-origin entries are removed | 33 RSS items |
| **Total, after about 5–10% cross-source duplicates** | **about 230–290** | |
| Devpost, if permission comes | +15–30 net (dev.events already covers part of it) | fixture 49 |
| Submissions (college events from Instagram, WhatsApp and Google Forms) | Grows with outreach. **This is the real differentiator**, per the Oct competitor research. | |

- **Expectation: about 250 open after Phase 1, about 300 with Devpost and Hackathons India.** Peak seasons (Sep–Nov, Jan–Mar) will be higher.
- Unstop's share falls from about 90% to about 60–65%.
- Say it honestly in the app's "How we find hackathons" page: we list fewer events than some sites, and every one is open and joinable.

---

## 3. Expired hackathons

### 3.1 When an event leaves the lists

Key: **R** = registration deadline, **S** = event start, **E** = event end. "Leaves the lists" means it is gone from the Feed, search, counts, filters, pushes, digests, "similar" suggestions, and the open counts in Telegram.

| What we know | Listed until | What the card says |
|---|---|---|
| R known | R, to the minute. A date with no time counts as 23:59 IST that day. | "Closes in 2 days" |
| Sources disagree on R | Listed until the **latest** R; the countdown uses the **earliest** (so nobody misses it). The warning stays. | "Closes 28 Nov (Devfolio says 30 Nov)" |
| No R, E known (HackerEarth, dev.events, rolling or "till seats fill") | E | "Deadline not listed · ends 6 Dec" |
| No R, no E, S known | S + 1 day | "Deadline not listed · starts 6 Dec" |
| No dates at all | Until the source stops listing it, and **at most 30 days after it was first seen** | "Dates not listed" (Check details) |
| The source marks it closed, or it closes early | Closed at the next run; it disappears at the next app sync | — |
| The source stops listing it | Stale once it hasn't been seen for **12 h across at least 3 successful runs** (see 3.3) | — |
| Announced, registration not open yet | New status `upcoming`: shown in **Opens soon**, not in the main list | "Opens 3 Jan · Remind me" |
| Opens-soon event whose date passes without opening | Stays until the source changes it; after 14 days with no change it goes stale | — |

### 3.2 What is deleted, what is hidden, what is kept

- **Hidden:** status `closed` or `stale`. The event leaves every list and every notification.
- **Kept in the database for 1 year.** This was already decided, for a future "past editions" trust signal.
- **Deleted by a weekly purge job (A8):**
  - events closed or stale for more than 365 days **that no `saved_events` row points to**;
  - `pending_digest` rows for closed events;
  - push receipts older than 30 days;
  - resolved `review_queue` rows older than 90 days.
- **Important:** `saved_events.event_id` uses `ON DELETE CASCADE` (`0001_init.sql:94`). A blind purge would silently wipe users' Past lists, so the purge must skip any event someone has saved.
- **Kept for the person who saved it, signed in or guest:**
  - **Interested** moves to **Past** when registration closes.
  - **Registered** stays in Registered until E + 1 day, showing the next milestone, then moves to Past.
  - **Past** is collapsed, and items stay until the user removes them (add a "Clear past" button).
  - The app already keeps a snapshot of each saved event, so Past works offline and after a purge.

### 3.3 Database behaviour

- **One SQL function, `close_expired()`**, sets an event to `closed` when `coalesce(R, E, S + 1 day) < now()`. The collector's `end_of_run` calls it.
- A **pg_cron job also calls it every hour**, so events keep closing even when the collector is down. pg_cron availability on this Supabase project is **(unverified)**; the repo uses only the `http` extension today.
- **The stale rule must change before going hourly.** Migration 0015 assumes 6-hourly runs (its comment says "3 days = 12 runs"; the code says `missing_runs < 3`). With hourly runs, 3 missed runs would mean 3 hours.
  - New rule: stale when the event hasn't been seen for 12 h **and** was missing in at least 3 successful runs.
  - Safety brake: one run may never mark more than 30% of open events stale. If it would, it skips that step and alerts Telegram.
- **New status `upcoming`:**
  - It needs a migration, because today the status check is `('open','closed','stale')` (`0001_init.sql:44`).
  - The app's first sync must also pull `upcoming` events.
- **Reopening:** `sync` already reopens events it sees again. If a saved event's deadline is extended, savers get "Deadline extended to 5 Dec" through the existing `saved_changes` push.

### 3.4 App behaviour

- **`visibleEvents` uses the same rule** (R, then E, then S + 1 day). Today `feed.js:52` checks only R, so events with no deadline stay listed after they end. With the fix, expiry works on the phone even if the database is behind.
- **Tapping a Past item, or one marked "no longer listed", opens the detail page from the saved snapshot.** It shows a grey banner, for example "Registration closed on 12 Nov" or "Unstop removed this listing on 20 Nov", plus **"See 4 similar open hackathons"**. A tap never does nothing; today it does nothing (`(tabs)/saved.js:80`).
- **A push or shared link to an expired event** opens the same closed view, not "That event is no longer listed."
- **Stale data banner:** if the last successful collector run was more than 12 h ago, the feed says "Listings last updated 14 h ago." The app never pretends the data is fresh.

### 3.5 Edge cases

- **Deadline extended after closing:** the event reopens, moves from Past back to Interested, and savers get a push.
- **Deadline moved earlier, or the venue changes:** savers get a push (already built). It will follow the "Changes to saved hackathons" switch (section 6.10).
- **Multi-round events:** after registration closes the event is hidden from the Feed, but Registered users keep tracking the next round.
- **Time zones:** deadlines from foreign events are shown in IST, with the original next to it ("11:59 PM PT = 1:29 PM IST Sat").
- **A guest reinstalls the app:** their saves are lost. The sign-in prompt says so plainly ("Sign in to keep them if you change phones").
- **Collector down:** the phone still hides events using R, E and S + 1 day, and the stale-data banner shows.

---

## 4. The detail page

### 4.1 Does the app solve the pain today?

The pain, from the research: *"I find out too late, I can't tell whether I can join or whether it's legit, and I miss deadlines."*

| Part of the pain | What the app does today |
|---|---|
| Finding out too late | One list exists, but its data is weeks old (collector down) |
| Can I join? | Unstop's "All" is shown as "Who can join: **Anyone**" (`event/[id].js:317`), which is often false |
| Is it legit? | The "Trusted source" label really measures how complete the data is. Devfolio's *verified* events show "Check details" only because Devfolio publishes no fee. |
| Missing deadlines | Reminders exist for the final deadline only. There are none for rounds, and none for Registered events that have no start date. |

**So it solves the pain only partly.** The detail page is where the student decides. Its first screen must answer three questions without scrolling: **Can I join? Should I? By when?**

### 4.2 Final layout, top to bottom

0. **App bar:** Back · the title appears after scrolling · Share · ⋮ menu (Open original page, Copy link, Report wrong info).
1. **Status strip:**
   - Countdown pill: "Registration closes in 2 days · Fri 29 Nov, 11:59 PM IST". Red at 2 days or less, amber at 7 days or less, always with words.
   - When the event isn't open, the status word instead: "Opens 3 Jan" or "Closed 12 Nov".
   - The trust chip, which can be tapped (item 11).
2. **Title** (up to 3 lines), "by IIT Delhi" (or "Organizer not listed"), and "On Unstop · also on Devfolio". *Why: who runs it is the first trust question.*
3. **Key facts, 2×2 grid:**
   - **When:** the event dates, "Sat 6 – Sun 7 Dec", or "Dates not listed".
   - **Where:** "Online", "Jaipur · 12 km" or "Hybrid".
   - **Team:** "Solo or 2–4", or "Teams of 4".
   - **Cost:** "Free (as listed by Unstop)", "₹250 per person" or "Fee not listed".
   - Below the grid, one prize line: "₹1,00,000 in cash prizes · certificate for all" or "Prizes not listed".

   *Why: the dates against exams, team, cost and place decide most applications (panel A, B, D, E).*
4. **Your fit:** one line from the existing `reasons()` in `app/src/lib/match.js:104`, which is written but never called. Example: "✓ Online, as you prefer · ✓ Open to B.Tech · ✗ ₹250 fee". *Why: it shows the student the app knows them, and makes the ranking visible.*
5. **What it is:** a summary built from facts, not copied:
   - "Online ideathon on AI and FinTech. 3 rounds: idea PPT, prototype, final pitch. Entry by PPT shortlist."
   - Then "Read the full rules on Unstop ↗".
   - *Why: "what will I actually do?" is the first question, and the PRD forbids copying descriptions (see Q3).*
6. **Who can join:**
   - Degrees, worded honestly: "Open to all degrees, as listed by Unstop. Check the rules for year and college limits." **Never "Anyone".**
   - Women-only or "at least one woman", from Devfolio `women_only` or Unstop `gender`. Unstop's codes must be decoded first **(unverified)**.
   - School students; same-college teams, but only when the source states it.
7. **Timeline stepper:**
   - Registration opens → Registration closes → Round 1 (PPT) due → Event starts → Event ends.
   - A "Today" marker. Every step shows its date and time, and a bell when a reminder is set (if saved).
   - Missing dates say "Round dates not published".
   - *Why: dates are the second-biggest confusion in the research. Rounds are known for 158 events and are shown today only as text.*
8. **Cost and prizes in detail:**
   - Fee per person or per team.
   - When the fee isn't confirmed, one line: "Shortlist-stage or hospitality fees are often not listed. Check the rules." (from the HackIndia Spark ₹250 case).
   - Cash vs non-cash prizes; perks (certificate, goodies: Unstop only).
9. **Venue:** name, city, state, "12 km from you" (or "approx. location"), Open in Maps.
10. **Add to calendar:** two buttons, "Deadline" and "Event dates".
    - Uses the Android `ACTION_INSERT` intent through `expo-intent-launcher`, which is already installed. No permission is needed.
    - Whether `beginTime` arrives as a long has to be **tested on a device (unverified)**.
11. **Trust and freshness:**
    - **"Why this label?"** opens a sheet of checks, for example: ✓ registration link is on unstop.com · ✓ organizer listed · ✗ fee not listed · ✓ sources agree on the deadline.
    - "Checked 40 min ago". Report wrong info.
12. **Similar open hackathons:** 3 compact cards (same theme or mode, closing later). *Why: this is the escape route on closed pages.*
13. **Sticky bottom bar:** `[Save]  [Register on Unstop ↗]`.
    - A hint above it: "Opens the Unstop app", or "Opens unstop.com" once the user has picked the website. **Remember that choice**; today the sheet repeats every time.
    - States:
      - **Saved:** "Saved · reminders 7 d, 48 h, 24 h, 3 h before close", with an inline fix if notifications are off.
      - **Closed:** the main button becomes "See 4 similar open".
      - **Opens soon:** "Remind me when it opens".
      - **Unsafe link:** disabled, with the reason.
    - After the student returns from registering: "Did you register?" (built, keep it).

### 4.3 Trust labels

- Rename **"Trusted source" to "Details complete"**. It stays off cards; nobody should read it as "safe".
- **Check details** (amber) should no longer fire for a field the source never publishes, such as Devfolio's fee. Every red flag stays.
- **Warning** (red) and **Outdated** (grey) stay as they are.
- Never show "Verified" or "Safe".

### 4.4 Not on the page

Banners, logos or copied images (the PRD forbids them, and they cost data on cheap phones), copied description text, ratings or comments, and teammate chat.

---

## 5. Filters and sort

### 5.1 Quick chips on the Feed

One tap each, in the chip row after `Filters · N` and `Sort`:

**Online · Near me (or "Set city") · Free · Closing in 7 days · This weekend · Solo OK**

- Online + Near me together means "either one" (that is the set the student can actually join).
- Active filters follow as removable chips.

### 5.2 Filter sheet

A bottom sheet, applied in one go, with a live "Show 37 hackathons" button and a count next to every option.

| Group | Type | Options |
|---|---|---|
| Where | multi | Online · In person · Hybrid; City + distance 10 / 25 / 50 / 100 / Any km |
| When it runs | single | Any · This weekend · Next 2 weeks · This month · Pick dates |
| Registration closes | single | Any · 48 h · 7 days · 30 days |
| Cost | single + switch | Any · Free only; switch "Include fee not listed" (default on) |
| Who can join | switches + single | Open to my degree · Solo allowed · Team size I have: 1 / 2 / 3 / 4 / 5+ · Women-only events: Show / Hide / Only (labelled "where listed") |
| Prize | single | Any · Cash prize listed · ₹10k+ · ₹50k+ · ₹1L+ |
| Themes | multi | the 9 themes, with counts |
| Platform | multi | every platform with events, with counts |
| Status | switch | Include "Opens soon" |
| Safety | switch | Hide events with warnings (default on) |

Footer: **Clear all** · **Show N hackathons**.

### 5.3 Sort

| Sort | Change |
|---|---|
| **Best match** (default) | — |
| Closing soonest | Events with no deadline go **last**, not dropped (today `feedView.js:146` drops them) |
| **Starting soonest** | New |
| Newest | — |
| Nearest | Needs a city |
| Highest prize | Unknown prizes go last; USD prizes are converted and shown with "≈" (today they count as 0) |

### 5.4 Defaults and behaviour fixes

- **Defaults:** Best match; Hide warnings on; "Where" set from the onboarding answer as removable chips with a "+N hidden · Show all" link. Everything else off.
- **Filters persist across restarts.** Today they live in `useState`.
- **Picking a city never wipes filters** (`(tabs)/index.js:95-101`).
- **"Save as my alert filter" is stored separately from prefs**, so later Profile changes stop overwriting it (`prefs.js:33-36`).
- **Search** also matches city, themes and platform, not only the title and organizer.
- **How it looks:** single-select groups as segmented chips, multi-select as filter chips with a check mark, never mixed in one group. Counts in muted grey, e.g. "(124)".
- **Skipped on purpose:**
  - named saved views (one alert filter is enough for now);
  - "beginner-friendly" and year of study (no source publishes these, so it would be false precision).

---

## 6. Every screen, in the order a new user meets them

### 6.1 Play Store listing

- The production build is an AAB, so the download stays small.
- The short description says what we do honestly: "Hackathons from Unstop, Devfolio, GDG and more, with reminders before registration closes."
- **Blocked by Q1** (the name clash) before the listing goes live.

### 6.2 Launch

- **Native splash (static):** the new mark (6.3) in teal with a mint blip, on `#F7F8FA`, which already matches `colors.background`, so there is no colour flash.
  - Canvas 288 dp, mark inside the 192 dp circle.
  - Call `SplashScreen.preventAutoHideAsync()` at startup. Hide the splash once the Feed's first frame is ready (cached list or skeleton), with a **hard cap of 500 ms**. Today it hides with no control.
- **In-app moment, cold start only:**
  1. An overlay draws the same mark at the same size and position.
  2. One ping ring grows out of the blip (reuse `components/RadarPing.js` with a single pulse; scale 1 → 2.2, opacity 0.4 → 0, 400 ms, ease-out).
  3. The overlay fades over 200 ms, showing the Feed already rendered underneath.
  - **Total 600 ms or less. It never waits for the network.** No haptic. Warm and hot starts get no animation.
- **Reduced motion:** no ping, only a 150 ms fade (Reanimated `useReducedMotion()`).
- **Test it on a preview or release build.** Expo Go and dev builds don't show the real splash.

### 6.3 App icon: one concept, chosen

**"Radar-clock": a radar sweep that is also a clock hand. It says "we watch deadlines".**

I chose it over the "H" monogram because the name may change (Q1), and a letter mark would tie the icon to that name. It has only 4 shapes, so it stays readable at 48 dp, and it no longer looks like the stock Material `radar` glyph used today.

- **Canvas** 108 × 108 dp. Everything sits inside the 66 dp safe zone, and the glyph is about 60 dp wide.
- **Background layer:** solid teal `#0E7C66` (the brand colour).
- **Foreground layer:**
  - **Ring:** white circle, centre (54, 54), radius 27 dp, 6 dp stroke.
  - **Hand:** white line from the centre to radius 23 dp at the **1:30 position** (45° clockwise from 12), 6 dp stroke, round caps.
  - **Sweep wedge:** the sector from 12:00 clockwise to the hand, radius 23 dp, white at 30% opacity (it trails behind the hand).
  - **Hub:** white dot, radius 5 dp, at the centre.
  - **Blip:** mint `#3DD6B0` dot, radius 6 dp, at the **12:45 position**, 15 dp from the centre (inside the wedge, just "found").
- **Monochrome layer** (Android 13+ themed icons): ring + hand + hub + blip as solid shapes, **without the wedge** (transparency turns muddy in themed icons). Today the monochrome file is a byte copy of the foreground.
- **Notification small icon** (24 dp, white on transparent): ring + hand + blip, 2 dp strokes.
- **Splash version:** the same glyph in teal, with the mint blip and the wedge in teal at 15%, on `#F7F8FA`.
- **Play Store** 512 × 512: full-bleed teal with the glyph scaled up (Play applies its own rounding).
- **Acceptance test:** preview at 48 dp under circle, squircle and themed masks. If the blip blurs, grow it to radius 7 dp.

### 6.4 Onboarding: 2 screens instead of 4

1. **Welcome:**
   - The mark; "Every hackathon you can join — near you or online."; "Free. No sign-up needed."
   - Buttons: **Get started** and the text button **I already have an account**.
   - A small link, "New to hackathons? What's a hackathon", opens a 3-line sheet that says non-coders are welcome at ideathons (panel user A).
2. **Where can you join?**
   - Choose one: **Online only** / **In person near me** / **Both**.
   - If in person or Both: a city search ("Use my location" is optional) and distance chips 10 / 25 / 50 / 100 / Any (default 50).
   - Button **Show hackathons**. Skip sets "Both, no city".
   - **Online only skips the city entirely.** Today Next stays disabled until a city is set (`location.js:83`).
3. **Into the Feed.** The answer shows as removable chips with "+N hidden".

**Moved later, on purpose:**
- **Degree:** a one-time card in the feed: "What do you study? We'll flag hackathons you can't join". Options: BTech, BCA, BSc, MCA, MTech, **B.Com, BBA, BA, Diploma, School**, Other.
- **Notification permission:** asked on the first Save, as "Remind me before registration closes?" followed by the system prompt.
- **Sign-in:** asked on the second Save.
- **Fee:** a filter chip, not a question.

### 6.5 Sign-in and sign-up

- **Guest-first stays.** An anonymous Supabase user is created silently. There is no separate "sign up": the first passwordless sign-in creates the account and keeps the same user id, so saves carry over.
- **Methods:**
  - **Continue with Google** (main button).
  - **Continue with email** (6-digit code; paste works; Resend after 30 s; "check spam").
  - **GitHub only if the server has it switched on; otherwise hidden.** No "Soon" badges.
- **Entry points:** "I already have an account" on Welcome; a one-time sheet on the second Save ("Keep your saved hackathons if you change phones", with Not now, then 7 days before asking again); the Profile account card; a "Sync to other phones" line in Saved; and Submit.
- **Gated (needs sign-in):** **only Submit a hackathon** (spam control, 5 a day). Everything else works as a guest.
- **After logging out:** the app starts a fresh guest session and opens the Feed. Today the phone gets locked on the sign-in screen (`session.js:29-33`).
- **Errors:** human sentences only, with an optional "Copy error details". Today raw server text is shown (`account.js:28`).
- **Risk:** Google sign-in uses the legacy Android SDK, which is deprecated. Plan the move to Credential Manager, or to the browser OAuth flow that already exists as a fallback, in Phase 4.

### 6.6 Home / Feed

- **Top:**
  - "HackRadar" title and the sync spinner.
  - The stale-data banner, only when the last run was more than 12 h ago.
  - Search (title, organizer, city, theme, platform).
  - The chip row (5.1).
- **At most one context strip at a time, in this priority:**
  1. "2 saved hackathons close in 24 h" → opens Saved.
  2. "12 new since your last visit · Unstop 7 · Devfolio 3 · GDG 2" → filters to the new ones.
  3. The one-time degree card.
- **Card:**
  - Line 1: countdown pill, **NEW** badge, warning flag (only for Check details or Warning), bookmark.
  - Title (2 lines); "Unstop · IIT Delhi".
  - Meta line: **"6–7 Dec · Online · Team 2–4 · Free · ₹1L"**. Dates appear only when known; we never print "Date not listed" on cards.
- **Paging:** 10 per page with the pager (the owner's 30 Sep decision; keep it).
- **Above the pager:** "Opens soon (5) · announced, registration not open yet" → its own list.
- **Footer:** "More on Devpost, MLH, lablab.ai" (honest about what we can't read), and "Know one that's missing? Submit it".
- **Keep:** the gestures (tap the tab to scroll to the top, double tap to reset) and the "From notification" view.

### 6.7 Event detail

See section 4.

### 6.8 Saved

- **Tabs:** Interested · N | Registered · N, plus a collapsed **Past · N**.
- **Interested card:** countdown, and a line "Reminders: 48 h, 24 h, 3 h". Swipe to remove (with Undo) and the long-press sheet stay.
- **Registered card = milestone tracker:**
  - Instead of "Closed", the next step: "Round 1 PPT due in 2 days", "Starts Sat 6 Dec, 10 AM", or "No start date listed, so no reminder".
  - A mini stepper.
  - Reminders 24 h before every round deadline, and at 7 pm the evening before the start.
  - Today a Registered card shows "Closed" (`format.js:27-29`), and events with no start date get no reminder (`reminders.js:52-55`).
- **Past:** "Closed 12 Nov" or "Ended 7 Dec". Tap opens the closed view (3.4). A "Clear past" button.
- **Guest note (once):** "Saved on this phone only. Sign in to keep them if you change phones."

### 6.9 Profile and Settings (one tab, route `/settings`)

1. **Account card**
   - Guest: "Guest · saved on this phone only", with **Sign in or create account**.
   - Signed in: Google photo or initial, name, email, "Signed in with Google" (all read-only).
2. **Your feed:** Where you can join · City and travel distance · What you study · Fee preference (Free first / Any) · Hide events with warnings.
3. **Notifications**
   - Deadline reminders: on/off, plus timing checkboxes 7 days · 48 h · 24 h · 3 h final call (all on by default).
   - Round and start reminders for Registered: on.
   - Changes to saved hackathons: on (its own switch; see 6.10).
   - New hackathon alerts: **Smart** (default once enabled) / Instant / Weekly / Off. Digest time (default 6 pm). "Alert filter: Online · Free · AI — Edit".
   - Quiet hours: 11 pm – 8 am, editable (B4).
   - "Make sure reminders arrive" (the battery fix).
   - Open the phone's notification settings.
4. **Help and about:** Submit a hackathon · Your submissions · **How we find and label hackathons** (the source list and trust rules: the honesty page) · Send feedback (email) · Rate HackRadar · Share HackRadar · Privacy policy · Terms · Version.
5. **Account:** Log out (signed-in users only) · **Delete account** (red; the confirm says "Removes your saved, registered and alert settings. This can't be undone.").

**What a signed-in user can and cannot change, and why**

| Can change | Cannot change | Why not |
|---|---|---|
| Every feed preference, city and distance, degree | Name and email | They come from Google or the email sign-in, and nobody else ever sees them (there are no public profiles). Editing them adds work and moderation for no benefit. Sign out or delete instead. |
| Every notification type, timing and quiet hours | Linked sign-in methods | Read-only "Signed in with Google". Linking a second method is rare and risky. |
| Alert filter | Trust labels, reports already sent, timestamps of saved and registered items | These are facts the app records. Use "Report wrong info" for mistakes. |
| Log out, delete account | Theme | Light-only was the owner's 30 Sep decision. Don't add a toggle that does nothing. |
| | Language | English only until the source data supports Hindi. |

### 6.10 Notifications

| Type | When it is sent | Default | Quiet hours | Android channel | Switch |
|---|---|---|---|---|---|
| Deadline reminder (local) | 7 d, 48 h, 24 h and 3 h before a saved event closes | On after the first-Save permission | Moves to 9 pm the evening before | Deadlines (high) | Deadline reminders |
| Round / start reminder (local) | 24 h before each round; 7 pm the evening before the start | On for Registered | Same | Deadlines | Round and start reminders |
| Change to a saved event (push) | The run that sees a changed deadline, dates or venue, an extension, an early close or a cancellation | On | Held until quiet hours end, per device | Deadlines | **Changes to saved hackathons.** Today it wrongly depends on "New hackathon alerts" (`push.js:63`, `notify.py:168`). |
| New matches, **Smart** (push) | One digest a day at the user's time (default 6 pm), plus an **instant** push for a match that closes within 72 h. At most about 5 non-deadline pushes a week. | Off until the user opts in | Yes | New hackathons | New hackathon alerts |
| New matches, **Instant** (opt-in) | Every run that finds matches, grouped, at most 3 a day | Opt-in | Yes | New hackathons | Same |
| **Weekly** (opt-in) | Sunday 6 pm: "New this week + closing this week" (for club coordinators) | Opt-in | — | New hackathons | Same |
| Submission status (push) | When the admin approves or rejects a submission | On for people who submitted | Yes | New hackathons | — |

No marketing pushes, and no "we miss you".

**How "instantly" becomes real:**
- From the moment an event appears on a platform: the next **hourly** run (0–60 min, plus a few minutes of GitHub queueing), then sync, then Expo push (seconds).
- That is **about 1–2 hours for strong matches**, outside quiet hours.
- Minutes-level real time would need webhooks from the platforms, and none of them offers public ones.
- At this scale the Expo push service is free and its rate limits don't matter (the exact limits are **unverified**).
- In-app, the **"New since your last visit"** strip gives the same "what's new" payoff without any push.

### 6.11 Submit a hackathon

- Sign-in required (5 a day; the admin reviews each one).
- Replace the typed DD/MM/YYYY dates with a **date picker** (`submit.js:169-177`).
- The submitter gets a **push when it's approved or rejected**.
- Later: paste a link and the form fills itself (C2).

### 6.12 Empty, offline and error states

- **First-ever open while offline:**
  - "Connect once to load hackathons; after that the app works offline."
  - **Retry** re-runs the guest sign-in *and* the sync. Today Retry does nothing until sign-in succeeds (`useFeed.js:19`).
- **Offline with a cache:** the banner gets a **Retry** button (`index.js:258`).
- **Filters too strict:** the existing Clear options stay.
- **Nothing open:** "Nothing matches right now", with "Turn on alerts" and "Clear filters".
- **Accessibility pass (E1):** TalkBack labels on chips and countdowns, 48 dp touch targets, large-font check.

---

## 7. Telegram

### 7.1 What it does today

| # | Message | Verdict |
|---|---|---|
| 1 | "🆕 N new hackathons for you": a personal match feed for the owner's own test device | **Remove** (Plan B5). It's noise, and in `main.py:108-113` it shares one `try` with the pushes, so a Telegram network error also skips users' pushes. |
| 2 | "📅 A saved hackathon changed", for that same device | **Remove** (users get this as a push) |
| 3 | New submissions and reports | **Keep** |
| 4 | Per-source health: 0 events, or only errors, for 48 h | **Keep, but stop repeating it every run.** Send it once, then mention it in the daily report until fixed. |
| 5 | Workflow "whole run failed" alert | **Keep.** It works once the secrets exist, but it can't fire when the secrets themselves are missing. That's why a watchdog outside GitHub is needed (7.2). |

### 7.2 Decision

**Keep Telegram, admin-only: it is the owner's console.** Users never interact with it. Every important backend fact reaches the owner from A to Z, with **counts only, never users' names or emails** (privacy).

Messages stay in Hinglish, like today's.

**Immediate alerts.** Sent when the problem happens; repeated at most every 6 h while it lasts, and listed in the daily report.

| Code | Alert | Trigger |
|---|---|---|
| A1 | **Run failed** | The workflow failure step, with the failed step and a link to the run |
| A2 | **Watchdog: no successful run in 3 h** | Sent by Supabase pg_cron through the existing `http` extension, so it is **independent of GitHub**. It catches missing secrets, a disabled workflow, GitHub outages, and GitHub's automatic disabling of schedules in public repos after 60 days without activity. |
| A3 | **Source down** | 3 failed runs in a row, or 0 events for 48 h (the existing health check, de-duplicated) |
| A4 | **Source shape changed** | A source's kept count falls more than 60% below its 7-day median, or more than 20% of its records fail to parse. This catches regex breakage on ETHGlobal, Hackster and HackIndia *before* the count hits 0. |
| A5 | **Blocked** | 401/403, a captcha page, robots.txt now disallowing our path, or the `fetch_url` allowlist refusing a URL |
| A6 | **New submission or wrong-info report** | Existing; each sent once |
| A7 | **Scam signal** | A report with reason "fake/scam", or 3 or more reports on one event |
| A8 | **Push trouble** | The Expo push API errors, or more than 10% of tickets or receipts fail in a run |
| A9 | **Platform imbalance** | One platform is more than 80% of new events over 7 days, or a platform has had 0 open events for 3 days |
| A10 | **Data blow-up** | One run would close or stale more than 30% of open events. The run refuses to do it and alerts instead. |

**Daily report, 09:00 IST, sent every day even when everything is fine.** It ends with "Sab theek" or a list of issues. **If it hasn't arrived by 09:15, that is the alarm.**
- **Runs:** ok / failed in the last 24 h, the last success time, the average duration.
- **Events:** open total; count and share % per platform; new / closed / stale per platform in 24 h; the Opens-soon count.
- **Quality:** how many were excluded as not-hackathons (with 3 example titles); possible duplicates waiting for review (these go nowhere today); open events with a Warning; open events with no deadline; geocode failures.
- **Notifications:** pushes sent (instant / digest / changes), failed, and dead tokens removed.
- **Users:** new devices (installs), new sign-ins, devices active in the last 7 days, devices with alerts on, saves today, "I registered" taps today (the best signal that the app is giving value).
- **Queue:** submissions and reports waiting.

**Weekly report, Monday 09:00 IST** (this is task A8):
- 7-day trend per platform.
- Data completeness per source: % of events with a deadline, start date, organizer, fee and city.
- The 5 most-saved hackathons, and the most-saved themes.
- Active devices this week vs last week.
- Purge results, database size, backup status.
- Permission emails still waiting for a reply.

---

## 8. Build order

Rules for every phase:
- JS-only app changes can ship as OTA updates: `expo-updates` is configured, with channels in `eas.json`.
- Native changes (the icon, splash, and intents if a config plugin is needed) need a new build.
- Every phase ends with the tests plus the hand checks listed.

### Phase 0: Make the data flow, and make silence loud (1–2 days; collector only, no app release)

1. **The owner adds 5 Actions secrets** in GitHub → Settings → Secrets and variables → Actions: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `HACKRADAR_CONTACT` (used in the User-Agent; `collect.yml:32`). Then click Run workflow once.
2. Remove Telegram messages #1 and #2, and give each notify step its own `try`.
3. Data fixes:
   - Fix the dev.events regex, with a test.
   - Remove `reskilll` from `SOURCES`.
   - Add quality-gate rules for CP and coding contests, design and merch challenges, bootcamps, meetups and pop-ups, webinars and bug bounties. Trading gets its own rule *without* the "hack" exception.
4. **Hourly runs that actually happen:**
   - A pg_cron job calls GitHub's `workflow_dispatch` API every hour. It uses a fine-grained token limited to "Actions: write" on this one repo, kept in Supabase Vault.
   - The GitHub cron stays as a backup.
   - Heavy sources (ETHGlobal, dev.events details, later GDG) run every 6 h.
   - Switch the stale rule to the time-based one (3.3).
   - *If pg_cron isn't available:* set the GitHub cron to `17 * * * *` and rely on the daily report.
5. The watchdog (A2) and daily report v1.

**Check by hand:**
- GitHub → Actions → collect shows green ticks every hour.
- Telegram receives the 9 am report.
- To test the watchdog: disable the workflow for 3 h (Actions → collect → ⋯ → Disable), confirm the Telegram alarm arrives, then enable it again.
- In the app, pull to refresh, sort by Newest, and see "Posted X min ago" on today's events.

### Phase 1: More, cleaner and balanced data (about 1 week; collector + database + one OTA)

- **dev.events:** read `/AS/IN`, cache official links, credit Devpost.
- **Devfolio:** `women_only`, `participants_count`, sponsors; test the "upcoming" type.
- **Unstop:** store `registerCount`; decode the `gender` codes; check whether `oppstatus` has an "upcoming" value **(unverified)**.
- **`upcoming` status:** a migration, HackIndia upcoming events, and the Opens soon list.
- **GDG adapter:** a migration for the allowlist and `event_sources_source_check`; Hacktoberfest and workshop filter; requires "hackathon", "buildathon" or "24-hour" in the title; fetch each URL once.
- **Permission emails** (templates are in `docs/outreach.md`): Hackathons India, Devpost, MLH and Unstop. Build the Hackathons India adapter, but switch it on only after their reply (Q2).
- **Expiry:** `close_expired()`, the hourly pg_cron close, and the purge job that skips saved events.
- **App (OTA):** the `platformOf` fix, the rolling cap, the global bucket, platform counts in the filter sheet, the new `visibleEvents` rule, the closed view for Past items.

**Check by hand:**
- Run in Supabase: `select s, count(*) from events, unnest(sources) s where status='open' group by s;` Unstop should be under 70%.
- In the app, the first 10 Best-match cards have no more than 4 from one platform.
- An event with no deadline whose end date has passed is gone.
- Tapping a Past item opens a page that says why it closed.

### Phase 2: The decision page and a feed that listens (about 1.5 weeks; OTA)

- The detail page as in section 4: key-facts grid, Your fit, What it is, Who can join (worded honestly), timeline, Add to calendar, the "Why this label?" sheet, the trust rename and rule fix, similar events, the closed and opens-soon states, the remembered Unstop choice, and **share text with the facts** (title, dates, mode and city, team, fee, deadline, link, "via HackRadar").
- Cards show the event dates and a NEW badge; the "New since your last visit" strip.
- Quick chips; new filter groups and counts; filters persist; the city-pick and alert-filter bugs fixed; search widened; the sort fixes.
- Onboarding answers become feed chips.
- The offline first-open fix and Retry buttons.

**Check by hand:**
- Open an Unstop event: it says "Open to all degrees, as listed by Unstop", not "Anyone".
- Tap the trust chip: a sheet lists the checks.
- Add to calendar fills in Google Calendar with the right date and time.
- Pick a city with 3 filters on: the filters are still there.
- Close and reopen the app: the filters are still there.
- With airplane mode on, on a fresh install: a clear message and a working Retry.

### Phase 3: Never miss a deadline (about 1 week; OTA + collector)

- Registered becomes the milestone tracker, with round and start reminders and the 3 h final call.
- Change pushes get their own switch.
- New-match modes: Smart / Instant / Weekly / Off, a digest time, per-device quiet hours on the server (B4), and the weekly cap.
- The notification permission prompt moves to the first Save. Onboarding is cut to 2 screens. The degree card.
- Profile and Settings restructure. Logging out returns to guest. No raw errors. Hidden "Soon" providers. A date picker on Submit, and the approval push.

**Check by hand, on a real Xiaomi or Realme phone (task B2):**
- Save an event that closes in 26 h: the 24 h reminder arrives on time.
- Mark an event Registered: the card shows the next round, not "Closed".
- Turn off new alerts: a deadline change on a saved event still arrives.

### Phase 4: Brand and launch polish (3–4 days, plus the Play closed test)

- The new icon (adaptive, monochrome, notification, Play 512), the splash, and the 600 ms launch moment with reduced motion. This needs a new build.
- The Google sign-in migration plan (Credential Manager, or the browser fallback).
- Update App Flow and the TRD source table. Write the honesty page.
- The Play listing (after Q1), then the closed test (12 testers for 14 days, E1–E6).

**Check by hand:**
- On a preview APK: the icon in a circle, a squircle and themed-icons mode; the splash, then the ping, then the feed in under a second.
- With "Remove animations" turned on: just a fade.

---

## 9. Future ideas, ranked

1. **HackRadar's own event pages and share links** (the owner's item 8; already in PRD P1).
   - `https://<domain>/e/<slug>`, built from the database: the facts, a "Register on Unstop ↗" button, "Get the app", and a share preview image generated from the facts (no copied images).
   - Android App Links (`assetlinks.json` + an `autoVerify` intent filter) open the app when it's installed.
   - `hackradar.expo.app` already hosts `site/index.html`, so it can grow there. A real domain should wait for Q1.
   - Bonus: Google can index these pages.
   - **Effort M–L. Do it after Phase 3.**
2. **Coordinator share:** pick several saved events and send one WhatsApp message, "This week's hackathons", with the facts and links. One coordinator reaches about 200 juniors. **S.**
3. **Organizer funnel:**
   - "List your college hackathon free" (web form + in-app);
   - paste a link and the form fills itself (C2);
   - an organizer-verified badge (C3).
   - This is the real differentiator against every aggregator.
4. **Past editions signal:** "4th edition · last held Oct 2025", from the 1-year retention. A trust signal that is true and costs nothing.
5. **Smart personalisation from behaviour, not questions:**
   - learn themes from saves;
   - one-tap offers like "You saved 3 AI hackathons. Get alerts for AI?";
   - a "Similar to ones you saved" rail.
6. **Opens-soon watchlist,** plus "deadline extended" detection shown as a badge.
7. **Home-screen widget "Next deadline"** (needs a native widget module). **M.**
8. **Public Telegram channel** that auto-posts the day's top 5 India and online hackathons: a growth channel, using a bot separate from the admin one. Do it after the share text ships.
9. **Permission-based sources:** Devpost, Internshala, the MLH badge, a hand-picked list of Luma calendar ICS feeds.
10. **Calendar subscription:** an ICS feed of my saved and registered events (needs the web app).
11. **Hindi UI**, and **dark mode** only if users ask (light-only was the owner's decision).

---

## 10. Open questions only the owner can answer

1. **The name:** keep "HackRadar" despite the HackRadar Discord bot, hackradar.tech and HackathonRadar.com, or rename before the Play listing? This decides the store listing, the share-link domain and the final icon.
2. **Permission emails:** may I draft them for you to send now (Hackathons India, Devpost, MLH, Unstop)? And should Hackathons India stay switched off until they reply? My recommendation: yes, keep it off until they reply.
3. **Detail page text:** keep the strict "facts only" rule, or allow one short, credited tagline from the source (for example Devfolio's one-line tagline)?
4. **CTFs, ideathons and coding contests:** my recommendation is ideathons in; CTFs tagged and hidden by default; CP and coding contests out. Agree?
5. **Supabase:** which plan are you on, and may we enable pg_cron and keep a narrow GitHub token in Supabase Vault for the hourly trigger and the watchdog? Hourly runs also raise Supabase egress (GDG pages are 570 KB each).

---

## Not verified (in one place)

- **Live data:** per-source counts in the production database (the anon key can't read `events`); the live Devfolio count, and whether its API has an "upcoming" type; whether Unstop's `oppstatus` has an "upcoming" value; what HackIndia's `upcoming` means; what Unstop's `gender` codes mean.
- **Reachability:** whether GitHub Actions or the Supabase `fetch_url` path can reach gdg.community.dev; Luma volume outside Bengaluru; how many of the Hackathons India events overlap with Unstop and Devfolio.
- **Infrastructure:** whether pg_cron and Vault are available on this Supabase project; Supabase egress limits on the owner's plan; the exact Expo push rate limits.
- **On a device:** whether `expo-intent-launcher` passes the calendar times as longs; whether reminders fire on time on Xiaomi and Realme on Android 14; how the new icon reads at 48 dp (it needs a real render).
- **Not checked at all:** whether the owner received GitHub's email notifications for the failed runs (worth checking: it's a free second alarm); and when the collector was last run by hand.

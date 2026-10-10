# HackRadar launch audit (10 Oct 2026)

How this was done: the full repo (app, collector, migrations, docs), live counts from the production
database on 10 Oct, the collector's run log, push tickets, and EAS Update data; competitor research from
8 Oct (docs/research/2026-10-08-competitors.md) plus fresh checks of MLH, HackerEarth and Hack2Skill.
Reddit and X could not be read from this setup (blocked), and Devpost showed a bot check, so the
student-behaviour section is reasoning backed by store listings, Telegram counts and competitor pages,
not by forum threads.

## 1. What the project is

- App: Expo SDK 57 / React Native (JS), Expo Router, Reanimated; Android only. Release APK shared by
  link, updated over the air (EAS Update, 2 phones already took updates).
- Backend: Supabase (Postgres + RLS + Auth). Guest by default (anonymous user), Google, GitHub and email
  code. RLS checklist 19/19.
- Collector: Python on GitHub Actions every 6 h. Reads Unstop, Devfolio and Hack2Skill public JSON
  endpoints through a Supabase function, quality gate, themes, dedupe, geocoding, trust labels, change
  tracking, Expo push, Telegram admin alerts.
- Tests: jest 69, pytest 94. About 12,500 lines across 69 commits.

## 2. Live numbers (10 Oct)

| | |
|---|---|
| Open events | 260: online 109, offline 121, hybrid 30 |
| By source | Unstop 238 (92%), Devfolio 17, Hack2Skill 5, Devpost 2 (stale, see bugs) |
| Last collector run | 12:41 UTC, all three sources OK (Unstop 236 found / 8 new) |
| Trust labels | trusted 239, check details 19, warning 2 |
| Offline/hybrid with coordinates | 147 of 151 |
| Start date missing | 82 of 260 |
| Rounds known | 158 of 260 |
| Theme only "other" | 40 of 260 |
| Eligible degree/year known | 0 of 260 |
| Users | 36 (33 guests, 3 accounts) · saved events 2 · push tokens 2 |
| Push | 8 new-match pushes sent 8-10 Oct, receipts clean, at most 2 a day |

## 3. Existing solutions

| Product | Does well | Lacks | vs HackRadar |
|---|---|---|---|
| Unstop (app 1M+, 4.0) | "2540+ hackathons in India", apply inside, alerts, huge reach | only its own listings; quizzes, treasure hunts, escape rooms in the hackathon list; no distance | 92% of HackRadar's list *is* Unstop: an Unstop user already sees most of it |
| Devfolio | the big student hackathons (ETHIndia etc.), "Remind me", project profiles | only Devfolio events, no app | HackRadar adds them to one list (17 open) |
| Hack2Skill | corporate and government hackathons (Google, Samsung, NTPC, Police Hackathon) | hosting platform, no cross-platform discovery | HackRadar lists only 5 of theirs |
| HackerEarth | company hiring hackathons | listing page showed nothing live; hiring focus | not integrated |
| MLH | global student league, season list | 2027 season shows 1 India event (New Delhi) | low value for India |
| Devpost | largest global list, project galleries | bot check on the listing; few Indian college events | off, waiting on permission |
| HackathonRadar.com | 53 platforms, 1.5K open, quality score, near me, map, API | web only, alerts on a paid plan, not India-student specific | far ahead on coverage |
| indiahackathons.com | India, organizer submissions, newsletter | no Unstop/Devfolio, 37 upcoming, no app | HackRadar has more listings and an app |
| Tracathon | stage-by-stage deadlines, results history | you add every hackathon by hand | HackRadar knows rounds for 158 events but only reminds on the final deadline |
| Small tools | Hackmate (10+), HackMate teammates (500+), a "HackRadar" Discord bot, Hackathon Finder extension (24 users), Telegram "Hackathons and Events" (7,559) | all tiny or manual | no one with traction does India + app + reminders |

## 4. Thinking like the user (2nd/3rd-year CS/BCA/BTech)

How they find hackathons today: the college WhatsApp group and club announcements, Instagram and LinkedIn
posters, Unstop's app and emails, Devfolio for the well-known ones, Telegram channels.

What frustrates them:
- the list is scattered, and the best college hackathons are posters with a Google Form, on no platform;
- "hackathon" lists full of quizzes and paid fests (Unstop shows Rs 150-300 fees on college events);
- unclear eligibility ("Engineering Students", "Undergraduate", year limits) found out only after reading;
- several rounds (PPT, prototype, final) with dates that are easy to miss;
- finding a team, and travel cost for offline events.

What brings them back weekly (not daily: hackathon discovery is a weekly habit): a short "new this week
for you" push, "closing this week" reminders, and round-by-round reminders for what they registered for.

What makes them recommend it: finding something their friends didn't see (an Instagram-only college
hackathon), and a clean share card into the class WhatsApp group.

## 5. Audit

### Working and complete (verified, not just written)
- Collector: three sources every 6 h without errors, quality gate, themes, geocoding, trust labels,
  change tracking (214 changes recorded), Telegram admin alerts.
- Feed: search, Filters / Sort / City chips, best-match sort, 10 per page, distance in km.
- Event detail: facts, Unstop app hand-off, "Did you register?" prompt, share.
- Saved: Interested / Registered, swipe to remove, Past.
- New-match push: real pushes delivered 8-10 Oct, grouped, max 2 a day, quiet hours, receipts.
- Accounts: guest, GitHub, email code, Google (test users only); log-out lock.
- Over-the-air updates: working.

### Incomplete or broken
1. **The default Feed hides most of the inventory.** Interests are a hard filter: a student who picks
   AI/ML sees 101 of 260 open events; with no city set it is online-only too (the preview showed
   "43 of 241"). 40 events tagged only "other" never show under any interest, including obvious ones
   like "Virtual: PromptWars". First impression: "this app has 40 hackathons".
2. **Degree and year are asked and never used.** Onboarding asks both; 0 of 260 events have eligibility
   data and no match rule reads it. The Unstop listing does show tags like "Engineering Students",
   "Everyone can apply", "Undergraduate", "Fresher".
3. **Events from a switched-off source never expire.** 2 Devpost events last seen 29 Sep still show as
   open (Devpost is off, so the "missing 3 runs" rule never sees them).
4. **Google sign-in works only for test users** (consent screen still in Testing). Most students would
   pick Google first.
5. **No privacy policy, no in-app "Delete account", no web deletion link.** Google Play requires account
   deletion (in the app and on the web) for apps that let people create accounts, and a Data safety form.
6. **Deadline reminders were never confirmed on a phone** (B2 open), and Indian OEMs (Xiaomi, Realme,
   Vivo, Oppo) are known to kill scheduled alarms under battery optimisation.
7. **82 events have no start date**, so "starts tomorrow" cannot fire for them; rounds are known for 158
   but only the final deadline gets reminders.
8. **No way to report wrong info** although every listing is scraped.
9. **Data rights:** the three sources are used through undocumented public endpoints and the
   permission emails (A9) were never sent. If Unstop blocks it, 92% of the app disappears overnight.
10. **Name clash:** "HackRadar" (Discord bot), "Hack Radar" (hackradar.tech), "HackathonRadar.com".

### Biggest gap to a product people use every week
HackRadar today is mostly a re-skinned Unstop list (92%), and its default view hides 60-85% of even
that. A student who already has Unstop gets little new; one who doesn't sees a thin feed. The app is
well built; the inventory and the default view are the problem.

### The one thing competitors have that HackRadar lacks
**Coverage.** HackathonRadar reads 53 platforms (1.5K open worldwide); Unstop alone claims 2,540+ Indian
listings. HackRadar has 260, almost all from Unstop.

### The one thing no competitor has (the opportunity)
**The Instagram/WhatsApp-only college hackathon, as a listing.** Let students and college clubs paste a
link or a poster, check it once, and publish it with reminders. Nobody in India does this at scale
(hackradar.tech does it for UK chats; indiahackathons.com takes submissions but has 37 listings). Close
second: an eligibility-aware feed ("only what I, a 2nd-year BCA, can enter"), which the onboarding
already asks for.

## 6. Priority list

### Must-have before a public launch
| # | What | Why | Size |
|---|---|---|---|
| 1 | Default Feed shows everything open, ranked by interests instead of filtered; re-tag the 40 "other" events | first impression is an empty-looking app | small |
| 2 | Use degree/year (parse Unstop eligibility tags) or stop asking | a question that does nothing breaks trust | medium (small to drop) |
| 3 | Privacy policy page, in-app Delete account + web deletion URL, Data safety answers | Play Store requirement | small-medium |
| 4 | Publish the Google consent screen (needs #3's privacy URL) | Google sign-in for everyone | small |
| 5 | Mark events stale when their source is off or unseen for 2 days | stale events today | small |
| 6 | Test reminders + push on 4-5 phones (Xiaomi, Realme, Samsung, Vivo) and add a "Reminders late? Turn off battery optimisation" tip | reminders are the core promise | medium (mostly testing) |
| 7 | Report wrong info (one tap on detail, lands in review_queue) | trust is the pitch, data is scraped | small-medium |
| 8 | Send the permission emails (docs/outreach.md) and decide the name before any Play listing | legal and brand risk | small (your time) |
| 9 | Start the Play closed test now: 12+ testers for 14 days (rule for new personal accounts) | cannot be shortened | 14 days elapsed |

### Should-have soon after (retention)
- Student/organizer submissions with review (C1-C3): the long tail, the real differentiator.
- More sources: Devnovate, Reskilll, HackerEarth, more of Hack2Skill (only 5 today).
- Round-by-round reminders (PPT, prototype, results) from the rounds already stored.
- Weekly "new for you + closing this week" digest push.
- Add to calendar; tags for women-only, beginner-friendly, pre-placement, travel support.

### Nice-to-have later (growth)
- WhatsApp share card with an install link; campus ambassador/club partners.
- Light team finder; hackathon history/portfolio; web version (and iOS) for reach.

## 7. Verdict

**Not ready for a public launch. Ready for a closed beta now.** The app is stable: the collector runs,
push and over-the-air updates work, security checks pass. But a public user today would see a thin feed
(mostly Unstop, mostly hidden by default filters), a degree/year question that does nothing, Google
sign-in that refuses them, and no privacy policy or account deletion, which also blocks the Play Store.

Minimum to be launch-ready: must-haves 1-8 (roughly one to two weeks of work), while the 14-day Play
closed test (#9) runs with 12-20 friends. Realistic public launch: about three weeks from starting,
assuming the closed test turns up nothing large.

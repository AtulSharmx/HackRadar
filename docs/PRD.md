# PRD: HackRadar (v2, public app)

29 Sep 2026 · replaces "PRD HackRadar – Personal Hackathon Finder App" (v1, personal tool; kept in git history)

## One line

Every hackathon an Indian student can actually join, near them or online, in one trustworthy list,
with scam warnings and reminders so they never miss a deadline.

## Why v2 changes the idea

v1 was a personal tool that scraped two platforms. Research on 29 Sep 2026 changed three things:

1. **The biggest gap isn't on any platform.** Many college hackathons are promoted only through
   Instagram and LinkedIn posters and WhatsApp groups, and they register through Google Forms. A scraper
   never sees them. Whoever lets **organizers and students add these** has the list nobody else has.
2. **Platforms already exist, and each one is an island.** Unstop (2,500+ listings, mixed with jobs,
   quizzes and esports), Devfolio, Hack2Skill, Devnovate and Devpost each show only their own events.
   Telegram channels (InternFreak and others) mix hackathons with jobs and have no filters or reminders.
   "HackMate"-style apps focus on swiping for teammates, not on finding the right event.
3. **Trust is a real problem.** "Pay ₹500–2,000 to register" scams target students, and nobody labels them.

So HackRadar v2 is **hackathon-only, India-first and trust-first**: the complete list, the right filter,
an honest label on every event, and a reminder before it closes.

## Who it's for

- **Students (primary):** BCA, BTech, BSc, MCA, MTech, anywhere in India. They want events they're
  eligible for, within reach, affordable, and not scams.
- **Organizers (supply):** college clubs, communities and companies who want their hackathon seen.
  Listing is free.
- **Me (admin):** moderates submissions and reports, watches data health.

## What v1 of the public app does

**P0 (must ship)**

1. **Complete feed:** events from Unstop, Devfolio, Hack2Skill and Devnovate (Devpost only with
   permission), plus organizer- and student-submitted events, with duplicates merged.
2. **Onboarding and preferences:** themes, mode, fee (free only / free and paid), degree and year
   (degree-aware years), city by GPS or picker, max distance. Guest by default, no login wall. *(built)*
3. **Filters, search, sort, best match,** with the same match rules as the alerts. *(built)*
4. **Event detail:** facts only (dates, venue, distance, team, fee, prizes, eligibility, themes),
   the source and when it was last checked, warnings in plain words, Apply → the official page. *(built;
   the verbatim "About" text is removed, see Data rules)*
5. **Save + Saved tab:** Interested / Registered, swipe to remove, Past. *(built)*
6. **Reminders:** 7 days, 48 h and 24 h before a saved deadline; "starts tomorrow" for Registered.
7. **Push alerts:** new events matching my alert filter; changes to saved events (deadline, venue).
8. **Submit an event:** anyone pastes a link (or fills a short form). HackRadar reads what it can,
   the submitter fixes the rest, and it goes live after a quick review. Organizers get a **Verified
   organizer** badge after proving they run it (an email from the event's domain or a link from the
   official page).
9. **Report wrong info:** one tap on any event (wrong date, fake, duplicate, closed), with an optional note.
10. **Trust labels and warnings:** Trusted source / Check details / Warning / Outdated, with reasons
    like "Fee is ₹800 and no prize is listed". *(built)*
11. **Share + add to calendar:** a WhatsApp-ready share text (title, deadline, official link, and the
    app's Play Store link), and an "Add to calendar" button for the deadline.
12. **Account (optional):** continue with Google or an email code, only when saving, so saves survive
    a new phone. Delete account in Settings.
13. **Admin health:** per-source counts and errors, weekly data-quality report on Telegram. *(built)*

**P1 (after launch, if people use it)**

- Weekly digest ("5 new hackathons for you this week").
- "My college" view: events at or near my college, and ones open to my degree and year.
- Past editions: "last year's edition had 400 participants and paid its prizes" as a trust signal.
- Poster reading: submit a poster image, HackRadar reads the dates and details.
- A small web page per event, so shared links open for people without the app.

**Not in v1, on purpose**

- Teammate matching. It's a different product with profiles, messaging, moderation and safety work.
  Other apps already do it; we link out if people ask.
- Registering inside HackRadar. Registration always happens on the organizer's page.
- Jobs, internships, quizzes, esports. Hackathons only is the whole point.
- iOS and a full web app. Android first (most Indian students).

## Data rules (public app)

- **Every event is real.** No sample, placeholder or generated events anywhere, not even in empty
  states. If a source fails, the app says so; it never fills the gap.
- **Facts, not copies.** Show facts (title, organizer, dates, mode, venue, fee, prize total, team size,
  eligibility, themes) and always link to the original page. Don't show source descriptions or images
  verbatim.
- **Permission first.** Use a platform only if its robots.txt and terms allow it, or it gave permission
  (see docs/outreach.md). Honest User-Agent, slow rate, stop on any block, never log in or dodge a captcha.
- **Personal data:** only what the app needs (preferences, city rounded to ~1 km, saves, push token,
  optional email). Privacy notice in the app, delete-my-data in one tap, following India's DPDP Rules
  (full compliance deadline 13 May 2027).

## Success, measured

| Metric | Target at launch + 3 months |
|---|---|
| Coverage: hackathons students hear about elsewhere that are already in HackRadar | ≥ 90% |
| Wrong-info reports confirmed, per 100 events | < 2 |
| Scam or pay-to-participate events shown without a Warning label | 0 |
| Weekly active users who saved at least one event | ≥ 40% |
| Events added by organizers or students (share of total) | ≥ 20% |
| Median time from app open to an Apply tap | < 30 s |

## Launch plan

1. Closed test on Google Play: at least **12 testers for 14 continuous days** (required for new
   personal developer accounts). College friends and one tech club, who are also the first users.
2. Their feedback and "missed events" list decide the last fixes.
3. Public release on Play Store, with a privacy policy page and a Data safety form.
4. Growth: each college club that lists its hackathon gets the Verified organizer badge and shares
   the event link, which opens HackRadar.

## Risks

| Risk | Plan |
|---|---|
| A platform blocks us or asks us to stop | Stop at once. Several sources plus organizer submissions mean no single source can empty the app |
| Submissions bring spam or scams | Every submission is reviewed before it goes live; reports and trust rules catch the rest |
| Supabase free-plan limits (500 MB, 5 GB egress, 50k MAU) | Sync only changed rows and needed columns; move to Pro ($25/month) past ~5k weekly users |
| One person runs everything | Automation first (collector, health, reports); moderation queue kept small |
| Legal grey areas | Facts only, links back, permission emails, takedown on request |

## Sources (29 Sep 2026)
- Platforms and apps: [Unstop hackathons](https://unstop.com/hackathons), [Unstop app](https://play.google.com/store/apps/details?id=com.dare2compete.app&hl=en_IN), [HackMate (Play)](https://play.google.com/store/apps/details?id=com.mahesh.hack_mate&hl=en_US), [Hackmate (Play)](https://play.google.com/store/apps/details?id=com.bitversestudio.hackmate&hl=en_US), [Reskilll comparison](https://blogs.reskilll.com/top-7-hackathon-platforms-in-india-2026-a-complete-comparison/)
- Telegram channels: [InternFreak on TGStat](https://in.tgstat.com/channel/@internfreak), [Hackathons and Events](https://telegram.me/s/hackathons_and_events_updates?before=51)
- Promotion channels: [organiser guide (DEV)](https://dev.to/pranjulrathour/how-to-run-a-college-hackathon-students-remember-an-organisers-guide-346k), [Campus ambassadors](https://campusunite.in/ambassador)
- Scams: [student scams 2026 (Medium)](https://medium.com/@reachtosubrat/top-5-scams-targeting-students-in-india-2026-dont-fall-for-these-3f458910e979)
- Teammates: [HackPartner](https://github.com/jeremytey/hackpartner), [DevMatchups](https://github.com/harsh3dev/DevMatchups)
- Rules: [Play closed testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [DPDP Rules 2025 (PIB)](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014&reg=3&lang=2), [scraping and Indian law](https://lawrato.com/indian-kanoon/civil-law/is-web-scraping-legal-in-india-what-a-business-can-and-cannot-collect-3192), [Supabase free plan](https://uibakery.io/blog/supabase-pricing)

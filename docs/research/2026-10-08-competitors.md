# HackRadar competitor research (8 Oct 2026)

Method: web search, live competitor sites, Play Store pages, Product Hunt, GitHub, top.gg, Telegram,
Chrome Web Store. Limitation: Reddit was blocked from this research setup and search engines returned no
indexed Reddit/X threads, so user-complaint evidence comes from app stores, competitor pages, maker posts
and GitHub. Check r/developersIndia by hand before trusting feature priorities.

HackRadar as it really is today: sources Unstop, Devfolio, Hack2Skill (Devpost built but off); Android app;
quality gate + trust labels; distance in km; Free/Paid/Both; best-match sort; save; local reminders
7 d/48 h/24 h; saved-event change alerts; new-match push (built, not yet confirmed on a phone).

## 1. Do similar products exist?

Yes, many. The concept is not unique.

- Hosting platforms with their own listings: Unstop (dominant in India; app 1M+ downloads), Devfolio,
  Devpost, Hack2Skill, Reskilll, HackIndia, HackerEarth, MLH, DoraHacks.
- Aggregators (web): HackathonRadar.com (53 platforms incl. Unstop and Devfolio; quality score, near me,
  map; web only), indiahackathons.com (India, no app), hackradar.tech (global/UK, Discord community),
  1ph (India toggle, list showed empty), hackathons.top (dead: only 2025 listings), dev.events (thin India).
- Bots/extensions/channels: a Discord bot named HackRadar (top.gg), Hackathon Finder Chrome extension
  (24 users), Telegram "Hackathons and Events" (7,559 subscribers, manual posts).
- Play Store, query "hackathon finder india": Unstop first, then single-event apps and teammate apps
  (Hackmate 10+ downloads, HackMate 500+). No India hackathon aggregator app with traction was found.

Name clash: "HackRadar" (Discord bot), "Hack Radar" (hackradar.tech) and "HackathonRadar.com" already
exist. Check the trademark (IP India) and consider a distinct name before a public Play Store launch.

## 2. Top 3 closest competitors

### A. Unstop app (unstop.com, Play com.dare2compete.app)
- Career platform: jobs, internships, competitions and hackathons; one-tap apply, recommendations,
  "real-time alerts". Hackathon page: "2540+ Hackathons in India"; filters Team Size, Payment,
  Categories, Sort.
- Active, India, Android + iOS + web. Play: 1M+ downloads, 4.0 (26.1K reviews), updated 30 Sep 2026.
  iOS: 4.7 (3.1K ratings).
- Better: it is the source; apply inside; huge audience; organizers post there first; iOS; profiles.
- Worse: only its own listings; the hackathon list mixes in quizzes, treasure hunts, an escape room,
  line-follower contests and a supply-chain challenge; no distance-from-me filter; hackathons are one tab
  in a jobs app.

### B. HackathonRadar.com
- Global database reading 53 platforms daily (Devpost, Devfolio, MLH, ETHGlobal, Unstop, Kaggle, Hack Club,
  DoraHacks + 45). 1.5K open, 14.8K tracked. 0-100 quality score (prize credibility, organizer history,
  listing completeness). Near me, map, Discord bot, API/MCP, paid plans (Dev Pro: custom alerts, CSV).
- Very active (changelog last shipped 1 Sep 2026). Global; Bangalore shows 96 events. Web only.
  Product Hunt: 18 followers, 3 upvotes. Users not published.
- Better: coverage, scoring depth, map, API, business model.
- Worse: no mobile app, no phone push/reminders (alerts on a paid plan); not built for Indian students
  (no degree/year eligibility, no INR fee logic); Hack2Skill coverage not confirmed.

### C. indiahackathons.com
- India directory from Luma, Eventbrite, Meetup, Devpost + organizer submissions (reviewed within 24 h).
  10 hub cities + online, mode, date ranges, themes, free/paid label, weekly email newsletter.
- Active, India, web only. 37 upcoming when checked. Users not published.
- Better: organizer submissions (long tail), Luma/Meetup coverage, city pages (SEO), newsletter.
- Worse: no Unstop or Devfolio (so only 37 upcoming vs ~240 open in HackRadar); no app, push, reminders,
  distance or personalization.

## 3. Feature overlap

(yes / no / "-" = not seen on their public pages)

| Feature | HackRadar | Unstop app | HackathonRadar | indiahackathons |
|---|---|---|---|---|
| Unstop listings | yes | yes (own only) | yes | no |
| Devfolio listings | yes | no | yes | no |
| Hack2Skill listings | yes | no | - | no |
| Devpost / MLH / DoraHacks | no (Devpost off) | no | yes | Devpost only |
| Native mobile app | Android | Android + iOS | no | no |
| Online/offline/hybrid filter | yes | - (tag, no filter seen) | yes | yes |
| Free/Paid filter | Free/Paid/Both | "Payment" | - | label only |
| Distance in km from your city | yes | no | "near me" | city only |
| Theme filter | yes | Categories | yes | yes |
| "Real hackathon" filtering | quality gate + trust | no (quizzes mixed in) | 0-100 score | manual review |
| Personal best-match sort | yes | recommendations | yes | no |
| Save / bookmark | yes | yes | yes | no |
| Phone reminders before your deadline | 7 d/48 h/24 h | alerts (own events) | no (web, paid) | no (weekly email) |
| Push for new matches | built, unverified | yes | email (paid) | weekly email |
| Alert when a saved deadline/venue changes | yes | - | - | no |
| Apply inside | no (opens Unstop app/site) | yes | no | no |
| Profile / portfolio / teams | no | profile | Hack Passport | no |
| Organizer/student submissions | planned | organizers host | "request a source" | yes |

## 4. Genuine gaps HackRadar can fill (none is a moat)

1. Mobile-native, India-first aggregator: no India aggregator app with traction on Play Store.
2. Phone reminders before your saved deadlines plus "deadline moved" alerts across platforms.
3. Distance in km for offline college hackathons (Unstop has none; indiahackathons is city-level).
4. Cleaning Unstop's noise (quizzes, treasure hunts, escape rooms listed as hackathons).
5. Indian student context: honest INR fees, degree/year, Hack2Skill coverage.
6. The long tail (Instagram/WhatsApp-only college hackathons), planned: nobody in India does it at scale;
   becoming where colleges post is the closest thing to a moat.

Not a differentiator: "all hackathons in one place" (1ph, HackathonRadar, indiahackathons, HackathonFeed,
Hackmate and three products called Hack/Hackathon Radar all say it).

## 5. Feature ideas

| # | Feature | Evidence | Difficulty | Built elsewhere? |
|---|---|---|---|---|
| 1 | More sources: Devpost (permission), Reskilll, HackIndia, Devnovate, Luma, HackerEarth, MLH | 3 sources vs HackathonRadar's 53; Luma/Meetup carry corporate hackathons | medium per source | HackathonRadar, indiahackathons |
| 2 | Round-by-round reminders (PPT, prototype round, results) | Tracathon's whole product; HackRadar already stores Unstop rounds | easy-medium | Tracathon (manual) |
| 3 | Student/organizer submissions (link or poster) + moderation | HackathonFeed maker: discovery spread over Discord, LinkedIn, spreadsheets, Telegram; hackradar.tech watches WhatsApp groups; Telegram channel 7.5K manual | medium-hard | indiahackathons, 1ph |
| 4 | Pre-placement, women-only, beginner-friendly, travel-support tags | Student GitHub list (66 stars) uses exactly these categories; hackradar.tech filters free entry/travel | medium | partly hackradar.tech |
| 5 | Show why a listing is trusted + "Report wrong info" | Unstop mixes non-hackathons; HackathonRadar centres its score | easy-medium | HackathonRadar |
| 6 | Fee red-flag warnings | Indian scam advisories describe fee-before-joining traps; Unstop college events charge Rs 150-300 | easy | partly HackathonRadar |
| 7 | Add to calendar + share to WhatsApp | dev.events offers iCal; hackathons circulate in WhatsApp/Telegram | easy | dev.events |
| 8 | Light team finder | HackMate 500+ downloads, 4.9; Hackmate team-first | hard | HackMate, Hackmate, Devpost |
| 9 | Hackathon history / portfolio | Tracathon, Hack Passport, hackradar.tech profiles | medium | all three |
| 10 | Weekly digest (email/Telegram) | indiahackathons newsletter; Telegram channels with thousands of subscribers | easy-medium | indiahackathons |

## Bottom line

The idea is common; HackathonRadar.com beats HackRadar on coverage and Unstop owns Indian students'
attention. The opening is an India-first, phone-first app that removes the noise, shows how far an event
is and reminds you before you miss it. The hard parts are not code: more sources with permission, getting
colleges to post their Instagram/WhatsApp hackathons into HackRadar, distribution (most similar student
projects died: hackathons.top stuck in 2025, 1ph empty, Hackmate 10+ downloads), and the name clash.

## Sources

- Unstop: https://unstop.com/hackathons, https://play.google.com/store/apps/details?id=com.dare2compete.app,
  https://apps.apple.com/in/app/unstop/id1601170365
- HackathonRadar: https://www.hackathonradar.com, /changelog, /compare,
  https://www.producthunt.com/products/hackathon-radar
- https://indiahackathons.com/, https://hackradar.tech/, https://tracathon.in/, https://github.com/h55n/1ph,
  https://1ph.vercel.app, https://hackathons.top/explore, https://dev.events/hackathons/AS/IN/Delhi,
  https://hunted.space/product/hackathonfeed
- https://top.gg/bot/1457695413946814540, Chrome extension "Hackathon Finder",
  https://t.me/hackathons_and_events_updates, https://t.me/devfolio_announcements,
  https://www.sahildubey.com/2026/08/top-telegram-channels-for-coding.html
- Apps: com.bitversestudio.hackmate, com.mahesh.hack_mate, com.alt.hackz (Google Play)
- https://devfolio.co/hackathons, https://github.com/harshi1111/hackathons-tracker-2026,
  https://apify.com/aurumworks/hackathon-aggregator

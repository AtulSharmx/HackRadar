# Source rules (checked 2026-09-28)

## Devpost
- robots.txt: `User-agent: *` / `Disallow:` (sab allowed; sirf kuch bots banned).
- Terms of Service (info.devpost.com/legal/terms-of-service): automated scripts se
  site ko "scrape", "crawl" ya "spider" karna **mana hai**.
- Plain `curl` ko 403 milta hai (bot protection).
- Faisla: personal/non-commercial use, har 6 ghante mein ek run, low rate. ToS ka
  risk maana hua hai. Kabhi bhi user profiles / team pages nahi uthane.
  Devpost se permission ya official feed mil jaaye to wahi use karo.

## Unstop
- robots.txt: `/hackathons/`, `/competitions/`, `/api/public/*` allowed.
  `/api/*` (baaki), `/u/*`, `/p/*`, `/competitions/*/register` disallowed.
  Bingbot ke liye crawl-delay 1s hai; hum bhi requests ke beech kam se kam 1s rakhenge.
- Terms of Use (unstop.com/legal/terms-of-use): scraping ke baare mein koi clause nahi mila.
- Faisla: sirf allowed paths aur `/api/public/*`. Koi login-only ya user data nahi.

## Dono ke liye
- Hamesha ek pehchaan wala User-Agent bhejo, jisme contact ho.
- 1 request/second se tez nahi. Error aaye to backoff karke ruk jao.
- Sirf event ki public info rakho (naam, dates, prize, mode, venue, link). Kisi user ka data nahi.

## OpenStreetMap Nominatim (venue geocoding, added 2026-09-29)
- robots.txt disallows `/search` for crawlers. We are not crawling: this is API use, which the
  Nominatim Usage Policy allows for apps that stay within its rules.
- Rules we follow: max 1 request/second (1.1 s gap), identifying User-Agent, every result cached in
  `geocode_cache`, max 50 new addresses per run, approximate results retried only weekly.
- Must show "© OpenStreetMap contributors" in the app (About screen). Data is ODbL.
- shared/cities.json coordinates also come from Nominatim (built by `python -m collector.build_cities`).

## Where fetching runs from (decided 29 Sep 2026)
- Devpost and Unstop block GitHub Actions IPs (Devpost: captcha page; Unstop: 403 on robots.txt).
  Supabase's egress is not blocked, so on GitHub the collector fetches through the database function
  `fetch_url` (migrations 0006/0007): https only, host allowlist (unstop.com, devpost.com), service key
  only, 20 s timeout. Same named User-Agent, robots.txt still checked, same 2 s gap between requests.
- The owner accepted this as changing hosts, not disguising the client. If a source asks us to stop, we stop.
- Public app: Devpost is OFF (`SOURCES=unstop`) until Devpost grants permission (drafts in docs/outreach.md).
  Devpost-only events were marked stale; they return automatically if Devpost is re-enabled.

## More well-known platforms (checked 30 Oct 2026)
The owner asked for well-known platforms because 92% of open events came from Unstop. robots.txt and Terms were read for each.

| Platform | Verdict | Why |
|---|---|---|
| ETHGlobal | in use | no robots.txt, Terms have no clause against automated access; only India and online editions kept |
| Hackster | in use | robots.txt allows /contests, Terms have no such clause; online hardware contests |
| Hack2Skill | wider | in-person events with no city are now kept unless the title points abroad (6 were being dropped) |
| KnowAFest | built, off | allowed and has real college hackathons, but the owner wants well-known names; `SOURCES=...,knowafest` turns it on |
| Devpost, MLH, Devnovate, lablab.ai, Luma, TechGig, Where U Elevate, Hackathon.com | not read | their Terms forbid copying or reuse of site content; the Feed links out to the first four instead |
| GeeksforGeeks, HackQuest | not read | Terms forbid automated access / scraping |
| DoraHacks | not read | answers with a human-verification page: that is a block, we stop |
| Reskilll | not built | allowed, but no open events and not widely known |

Permission from Devpost would add the most (about 70 events). Drafts: docs/outreach.md.

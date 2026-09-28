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

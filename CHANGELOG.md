# What's new

## 25 Nov 2026: new server, and the data flows again

**The app (APK 1.0.0, build 3, re-released)**
- It now connects to HackRadar's new server. If you installed the APK before, [download it again](https://github.com/AtulSharmx/HackRadar/releases/latest) and install it over the old one.
- The screens are the same as before.
- Saved hackathons and sign-ins from the old server didn't carry over, so save them again and sign in again.

**The hackathon list**
- New hackathons arrive again. The collector had stopped on 13 Oct, and now it runs every 3 hours. The first runs brought about 250 open hackathons.
- It reads 8 platforms: Unstop, Devfolio, Hack2Skill, HackerEarth, HackIndia, dev.events, ETHGlobal and Hackster. ETHGlobal and dev.events are read every 6 hours.
- Reskilll is off: it had 0 open hackathons.
- Things that aren't hackathons are left out: coding contests, design and merch challenges, bootcamps, meetups and pop-ups, webinars, bug bounties and trading contests.
- dev.events no longer lets events from other regions through.
- A hackathon leaves the list only after it hasn't been seen for 12 hours and was missing from 3 runs of its platform. A safety brake stops any single run from hiding more than 30% of the list.

**Notifications**
- At most 2 new-hackathon alerts a day, never in quiet hours.

**Behind the scenes (admin)**
- Telegram is only the admin's console now. A problem is reported once when it starts, then at most every 6 hours.
- A daily report arrives at 9:17 am.
- Setup steps for the GitHub Actions secrets are in `docs/setup-actions-secrets.md`.

**Known limits**
- Email sign-in sends a link instead of a 6-digit code until custom email sending (SMTP) is set up.

## 21 Nov 2026: first test APK

- HackRadar 1.0.0 (build 3) for Android was published as a [GitHub release](https://github.com/AtulSharmx/HackRadar/releases/tag/v1.0.0).

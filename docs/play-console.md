# Google Play: launch checklist and form answers (12 Oct 2026)

Everything here matches the app as built and the privacy policy at https://hackradar.expo.app.

## Already done in the app

| Requirement | Status |
|---|---|
| Target SDK | 36 (Android 16), above Play's minimum |
| Package | `com.hackradar.app`, version 1.0.0, versionCode set by EAS (remote, auto-increment) |
| Permissions | INTERNET, VIBRATE, POST_NOTIFICATIONS (Android 13+ asks), ACCESS_COARSE/FINE_LOCATION (only when the user taps "Use my location"). Template extras SYSTEM_ALERT_WINDOW and storage are blocked in app.json |
| No background location | Location is read once, in the foreground, and rounded to about 1 km |
| Privacy policy | https://hackradar.expo.app, linked in Profile → Privacy policy |
| Account deletion | In app: Profile → Delete my account. Web: https://hackradar.expo.app/#delete |
| Production build env | EAS environment "production" has the three `EXPO_PUBLIC_*` values; profile `production` builds an AAB |

## Owner steps (need your Google accounts)

1. **Google sign-in out of testing.** Google Cloud Console → APIs & Services → OAuth consent screen:
   - Branding: app name HackRadar, support email, App domain → Privacy policy `https://hackradar.expo.app`.
   - Audience → **Publish app**. Only `email`, `profile` and `openid` are used, so no Google verification review is needed.
2. **Play Console account.** Rs 2,000 (US$25) one-time fee. A new personal account has to run a closed test with at least 12 testers for 14 days in a row before it can publish to production.
3. **Build the AAB.** From `app/`, run `npx eas-cli build --platform android --profile production`, then upload the `.aab` to the Closed testing track. Let Play App Signing manage the key.
4. **Add the Play signing key to Google sign-in.** Play Console → App integrity → copy the **App signing key SHA-1**. Then Google Cloud → Credentials → create an **Android** OAuth client with package `com.hackradar.app` and that SHA-1. Without this, "Continue with Google" fails in the Play build. Email and GitHub sign-in are not affected.
5. Fill in the forms below, add 12+ testers (their Gmail addresses or a Google Group), and share the opt-in link.

## Data safety form

- Does the app collect or share user data? **Yes, it collects. No sharing.** Supabase, Expo and Firebase are service providers, which Play does not count as sharing.
- Is all data encrypted in transit? **Yes** (HTTPS).
- Can users request deletion? **Yes**: in the app, and at https://hackradar.expo.app/#delete.

| Data type (Play's names) | Collected | Required? | Purpose |
|---|---|---|---|
| Location → Approximate location | Yes | Optional | App functionality (distance to offline hackathons) |
| Personal info → Email address | Yes | Optional (only if signing in) | Account management |
| Personal info → Name | Yes | Optional (Google/GitHub sign-in) | Account management |
| Personal info → Other info (degree) | Yes | Optional | App functionality, Personalization |
| App activity → App interactions (saved, interested/registered) | Yes | Optional | App functionality |
| App activity → Other user-generated content (reports, submissions) | Yes | Optional | App functionality |
| Device or other IDs (push token, random account ID) | Yes | Required | App functionality |

Not collected: precise location (rounded on the phone), contacts, photos, files, phone number, financial info, health, messages, web history, crash logs, analytics.

## Other forms

- **Ads**: No ads.
- **Content rating** (IARC questionnaire): category "Reference, News, or Educational". No violence, sexual content, gambling or drugs. Users can submit hackathon listings, but only an admin-reviewed listing is ever shown; there is no chat. Expected rating: Everyone / 3+.
- **Target audience**: 18 and over, plus 16–17 (college students). Do **not** pick under 13; that brings in the Families policy.
- **News app**: No. **Government app**: No. **Financial features**: None. **Health**: None.
- **App access**: everything works without signing in (guest). Submitting a hackathon needs any sign-in; reviewers can use email sign-in.

## Store listing (draft)

- Short description (80 chars max): `Every hackathon open to Indian students, online or near you, in one feed.`
- Full description: what it does (Unstop, Devfolio, Hack2Skill, HackerEarth and reviewed submissions, every 6 hours), ranking by interests and distance, deadline reminders, alerts at most twice a day, no ads, free.
- Category: Education. Contact email: atulshxrma04@gmail.com. Privacy policy: https://hackradar.expo.app
- Graphics needed: 512×512 icon (`app/assets/icon.png`), 1024×500 feature graphic, 2–8 phone screenshots (Feed, event detail, Saved, Profile).

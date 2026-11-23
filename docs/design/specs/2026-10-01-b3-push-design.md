# B3 Push notifications: design (approved 1 Oct 2026)

## Goal
New hackathons that match a person's interests, and changes to events they saved, reach their phone
as push notifications, without spam and without anyone's token or data leaking.

User decisions: new-match pushes at most twice a day, grouped (about 12 pm and 6 pm IST); nothing
between 11 pm and 8 am; design approved as presented in chat.

## What people get
- New matches, one grouped push per device per sending run:
  - 1 event: "New hackathon for you: HackX" / "Closes Tue 30 Sep · Online · Free"
  - n events: "3 new hackathons match" / "AI Build Sprint, HackNCR, CyberX CTF" (+ "and 4 more")
  - Tap: 1 event opens its detail; more open the Feed with a "From notification" chip that shows only
    those events; removing the chip returns to the normal Feed.
  - Channel "New hackathons" (default importance).
- Saved event changed (deadline, venue or city):
  - "Deadline changed: HackX" / "Now closes Fri 3 Oct (was Tue 30 Sep)."
  - "Venue changed: HackX" / "Now at <new> (was <old>)."
  - Two or more saved events changed in one run: "2 saved hackathons changed" / their titles; tap opens Saved.
  - Channel "Deadlines" (high importance), tap opens the event.
- Profile has two switches: "Deadline reminders" (B2, local) and "New hackathon alerts" (this push).
  Onboarding's "Allow notifications" turns both on.

## Limits (no spam)
- Collector runs at 05:53, 11:53, 17:53, 23:53 IST. Device quiet hours (devices.quiet_start_min /
  quiet_end_min, default 23:00 to 08:00 IST) hold new matches in pending_digest; the next run outside
  quiet hours sends them together with that run's matches. With this schedule that is 2 pushes a day.
- Guard: no new-match push to a device within 4 h of its last one (push_tickets kind new_match), so a
  manual collector run cannot add a third; those matches wait in pending_digest.
- Change pushes are processed only outside 23:00 to 08:00 IST; until then event_changes stay
  unnotified. Per-device quiet hours for changes come with B4 (editable quiet hours, daily digest).

## Data (migration 0014)
- push_tokens(expo_push_token pk, user_id → devices.id on delete cascade, platform, updated_at).
  One row per phone; an account on two phones has two rows.
- RLS on, no grants to anon/authenticated. The only way in is register_push_token(p_token, p_platform),
  SECURITY DEFINER: requires a signed-in user, validates the token shape, creates the devices row if
  missing, and moves an existing token to the caller (a phone that logged out to a new guest).
- push_tickets gains a token column, so a dead token can be deleted from its receipt.

## App
- After sign-in, when new-hackathon alerts are on and permission is granted: create both Android
  channels, get the Expo push token (projectId from app config) and call register_push_token. Fails
  quietly in Expo Go, on the web, or before Firebase is set up.
- devices.alerts_enabled = prefs.match_alerts (falls back to prefs.notifications for people who
  allowed notifications before this switch existed).
- Notification taps share the reminders handler: data.eventId or a single id opens the event;
  several ids open the Feed with ?from=<ids>.
- Feed: applyView gets an `only` set; with it, only those events show (filters and search ignored),
  and a soft "From notification" chip clears it.

## Collector
- collector/push.py: send(messages) to https://exp.host/--/api/v2/push/send in batches of 100, retry
  on 429/5xx with backoff, returns one ticket per message; check_receipts(db) at the start of each run
  for tickets 15 min to 24 h old (getReceipts, up to 1000 ids): DeviceNotRegistered deletes the token,
  every looked-up ticket is marked checked.
- collector/notify.py: push devices = alerts_enabled devices with at least one token. new_matches
  builds one grouped message per device (current run's matches + its pending_digest, still open and
  still matching, sorted by score); saved_changes adds push messages next to the Telegram ones.
  Telegram match alerts for the admin's own marked row are unchanged (B5 removes them).

## Owner steps (cannot be automated)
1. Add Firebase to the existing "HackRadar" Google Cloud project; add the Android app
   com.hackradar.app; download google-services.json into app/ (public identifiers, committed).
2. Generate an FCM V1 service account key and upload it on expo.dev (Credentials → Android →
   FCM V1 service account key). Never paste it in chat or commit it; delete the local file after.
3. New EAS builds (preview + development).

## Tests
- pytest: message text for 1 and many matches, quiet-hours queueing and later flush, the 4 h guard,
  change push text, ticket storage, receipts deleting a dead token.
- jest: applyView `only`.
- On the phone: alerts on → token row appears; a manual collector run delivers a push; tap opens the
  right screen.

## Not in B3
Daily digest option and editable quiet hours (B4), highlighting what changed on the detail screen,
iOS.

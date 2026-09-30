# App Flow: HackRadar

Sep 27, 2026 · @Atul Sharma

> **v2 (29 Sep 2026):** HackRadar is now a public app; see docs/PRD.md. Flows added on top of this
> document: **Submit an event** (paste a link, fix the prefilled form, "Pending review" → "Live"),
> **Report wrong info** (sheet on Event detail), **Account** (optional Google / email code when saving),
> **Add to calendar** on Event detail. Changed: Event detail shows facts only (no copied "About" text);
> onboarding fee choice is Free only / Free and paid; "Reinstalled app" (edge case 14) keeps saves if
> the user signed in. Everything else below still holds.
>
> **30 Sep 2026:** Filters sheet fee choice is **Free / Paid / Both** (Free also shows events that don't list
> a fee, labelled "Fee not listed"; Paid shows only events known to charge). **Newest** means newest on the
> source (its publish or registration-open date), and cards show "Posted 3 h ago" while it is chosen.
> "Closing within 7 days" counts calendar days in India, like the countdown.

## Overview

The app has 3 bottom tabs (Feed, Saved, Settings), 2 extra screens (Event detail, Onboarding) and 1 bottom sheet (Filters); every path starts from one of 4 entry points.

Screens:

- Onboarding (first launch only)
- Feed tab (home)
- Filters sheet (slides up over Feed)
- Event detail (opens from Feed, Saved or a notification)
- Saved tab (Interested and Registered lists)
- Settings tab (preferences, location, notifications, data, about)

Entry points:

1. App icon, first time: Onboarding, then Feed.
2. App icon, later: Feed, showing cached events at once, then syncing in the background.
3. New-match push notification: Feed filtered to the events in that notification (or Event detail if only one).
4. Deadline reminder or change notification: Event detail of that event.

Back button rule: Android back always goes to the previous screen; from any tab root it goes to Feed; from Feed it closes the app.

## First launch (onboarding)

Onboarding is 5 short steps, each skippable except step 1, and ends on the Feed with my preferences already applied.

1. Welcome
   - Shows: app name, one line ("Every hackathon you can join, near you or online"), Get started button.
   - Behind the scenes: anonymous sign-in to Supabase starts now, so it is ready by the last step.
2. Interests
   - Shows: theme chips (AI/ML, Cybersecurity, Web, Mobile, Data Science, Blockchain, IoT/Hardware, Open Innovation). Pick at least 1.
   - Next is disabled until 1 chip is picked.
3. How you want to join
   - Shows: Online, Offline, Both (default Both). Fee: Free only, Up to ₹500, Any (default Any).
   - Degree (BCA, BTech, BSc, MCA, Other) and Year (1 to 5).
4. Location
   - Shows: "Use my location" button and "Choose city" link. Max distance chips: 10, 25, 50 (default), 100 km, Anywhere.
   - Tap Use my location: Android permission prompt appears.
     - Allowed: spinner, then city and state fields fill (for example Gurugram, Haryana). Both stay editable.
     - Denied or failed: message "No problem, pick your city" and the city search opens.
   - Skipping this step sets mode to Online only until a city is set, and shows a banner on Feed.
5. Notifications
   - Shows: what I will get (new matches, deadline reminders) and an Allow button.
   - Tap Allow: Android 13+ permission prompt. If allowed, the push token is saved in the background.
   - Skip: reminders and alerts stay off; Settings shows how to turn them on.

Finish: save preferences on the phone and to the devices row, set my alert filter to match these answers, open Feed sorted by Best match.

## Core flow: find and apply

The main loop is Feed, narrow down, open an event, then Apply or Save; it should take under 30 seconds from app open to the registration page.

Feed:

1. Opens with cached events instantly; a thin progress bar shows while syncing.
2. Top: search bar, sort button (current sort shown, for example "Best match"), filter button with a count of active filters.
3. Below: active filter chips (for example "Offline · 50 km", "Free"); tapping a chip's x removes it.
4. List of event cards. Each card: title, organizer, mode or distance, deadline countdown, fee, prize, trust label.
5. Pull down: refresh. Footer: "Updated 2 hours ago".

Search: typing filters the list live by title and organizer. Clearing the field restores the list.

Sort: tap sort, pick one of Best match, Closing soonest, Newest, Nearest, Highest prize. Nearest is disabled with a note if no location is set.

Filters sheet:

1. Tap filter button; sheet slides up with: Mode, Fee, Themes, Distance, Closing within 7 days, Eligible for me, Solo allowed, Hide warnings.
2. The Show button reads "Show 14 hackathons" and updates live as options change.
3. Reset clears everything back to my defaults.
4. "Save as my alert filter" stores these choices for push alerts and shows a short confirmation.

Event detail:

1. Tap a card: detail opens.
2. Top: title, organizer, trust label, one-line summary.
3. Why it matches: top two reasons (for example "Matches AI · 12 km away").
4. Warnings, if any, in a clearly marked box.
5. Details: dates, deadline, venue and distance, team size, fee, prizes and perks, eligibility, themes, source and last checked.
6. Bottom bar: Save (bookmark icon) and Apply (main button).
7. Top-right: Share, Open in Maps (offline events only).

Apply: shows a small confirm line with the link's domain (for example "Opens unstop.com"), then opens the page in an in-app browser. Returning to the app offers "Did you register?" with Yes (marks as Registered) and Not yet.

Share: opens Android share sheet with title, deadline and link, ready for WhatsApp.

## Save and reminders

Saving an event marks it Interested and schedules up to 3 reminders on the phone; marking Registered keeps the reminders for the event date instead.

Save:

1. Tap the bookmark on a card or on Event detail.
2. Icon fills; a toast says "Saved. Reminders set for 7 days, 48 h and 24 h before the deadline."
3. If notifications are off, the toast says "Saved. Turn on notifications to get reminders" with a Turn on action.
4. Reminders already in the past are skipped silently; if the deadline is unknown, the toast says "Saved. No deadline found, so no reminders."

Saved tab:

1. Two segments: Interested and Registered, each sorted by closest deadline (or event date for Registered).
2. Each row shows the same card, plus a status pill.
3. Swipe left on a row: Remove (with Undo for 5 seconds).
4. Long press or the row menu: Mark as Registered or Move back to Interested.
5. Closed events move to a collapsed "Past" section at the bottom.

Mark as Registered:

1. Deadline reminders are cancelled.
2. One reminder is scheduled for the evening before the event starts ("HackX starts tomorrow, 9 am").

Unsave: all its reminders are cancelled and the device row on the server is updated so change alerts stop.

## Notification flows

There are 4 notification types, each with one fixed destination when tapped.

1. New matches (push, channel "New hackathons")
   - Text: "3 new hackathons match" / "AI Build Sprint (Delhi), HackNCR, CyberX CTF".
   - Tap: if 1 event, Event detail; if more, Feed with a "From notification" chip showing only those events. Removing the chip returns to the normal feed.
2. Deadline reminder (local, channel "Deadlines")
   - Text: "HackX closes in 48 hours" / "Tap to open. Registration ends Tue, 11:59 pm."
   - Tap: Event detail with Apply ready.
3. Change alert (push, channel "Deadlines")
   - Text: "Deadline changed: HackX" / "Now closes Fri 3 Oct (was Tue 30 Sep)."
   - Tap: Event detail with a highlighted "Changed" note on the changed field. Reminders are rescheduled automatically in the background.
4. Event starts tomorrow (local, for Registered events)
   - Text: "HackX starts tomorrow" / "9 am at SGT University, Gurugram."
   - Tap: Event detail.

While the app is open, a notification shows as a banner at the top and does not interrupt what I am doing.

If the event from a notification no longer exists (removed or merged), open Feed with a short message "That event is no longer listed".

## Settings flows

Settings is one scrolling list in 4 groups; every change saves instantly, with no Save button.

My preferences:

- Interests, mode, fee, degree and year open the same pickers as onboarding.
- Changes update the Feed's defaults and the devices row.

Location:

- Shows current city and state.
- "Update with GPS" repeats the onboarding location step; "Change city" opens city search.
- Max distance chips.

Notifications:

- New match alerts on/off (off stops pushes but keeps reminders).
- Edit alert filter: opens the Filters sheet pre-filled with the saved alert filter.
- Quiet hours: default 11 pm to 8 am, editable.
- Daily digest instead of instant alerts: on/off.
- If Android permission is off: a banner "Notifications are blocked" with an Open settings button.
- Tip: "Reminders late? Turn off battery optimization for HackRadar" with a button to Android's battery settings.

Data and about:

- Hide warning events on/off.
- Delete my data: confirm dialog ("This removes your preferences, saved events and reminders"), then delete server rows, cancel all reminders, clear local data, and return to Onboarding.
- About: version, data sources, "Map data © OpenStreetMap contributors".

## Edge cases and error states

Every screen has a defined empty, loading and error state, and the app never shows a blank screen.

1. No internet on open: show cached events with a banner "Offline. Showing events from 3 hours ago." Apply still works if the browser can load.
2. First open with no internet and no cache: "Can't load hackathons. Check your connection." with Retry.
3. Backend paused or erroring: same as offline; sync retries on next open or pull to refresh.
4. No results for filters: "No hackathons match these filters" with buttons Remove last filter and Reset filters.
5. Feed empty because sources are down: "No new events found recently. We're checking the sources." (never pretend there are simply no hackathons).
6. Location permission denied forever: "Location is off for HackRadar" with Open settings; city search still works.
7. GPS gives a wrong city: fields stay editable; the corrected city is saved.
8. Event with unknown deadline: card shows "Deadline not listed"; it is excluded from Closing soonest sort and cannot get reminders.
9. Event closed while open on screen: Apply turns into "Registration closed" (disabled), Save still allowed for next year.
10. Stale or warning event: label on card; detail shows the reason in plain words.
11. Approximate distance: "about 20 km (approx.)".
12. Duplicate that slipped through: detail shows "Also listed on" with both sources; a "Report duplicate" menu item logs it for review.
13. Registration link not http or https: Apply is disabled with "Link looks unsafe".
14. Reinstalled app: onboarding runs again; old server data is not recovered (by design, no login).

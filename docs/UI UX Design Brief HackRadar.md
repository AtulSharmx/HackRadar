# UI/UX Design Brief: HackRadar

Sep 27, 2026 · @Atul Sharma

## Design goals

HackRadar should feel like a calm, fast radar screen: dense enough to scan 10 events at a glance, clear enough to decide in 5 seconds per card.

Principles:

1. Deadline first. The most important fact on every card is how many days are left. It gets the strongest color and position.
2. Scan, then dive. Cards show only what helps decide "open or skip". Everything else lives on Event detail.
3. Honest signals. Trust labels and warnings are visible, plain, and never hidden in menus.
4. One main action per screen. Feed: open a card. Detail: Apply. Saved: act on the closest deadline.
5. Thumb-friendly. Main actions sit in the bottom half of the screen.
6. Dark mode is a first-class citizen, since most browsing happens at night.

Reference feel: a clean utility app, closer to a transit or weather app than a social feed. No infinite animations, no stock illustrations, no gradients behind text.

## Visual style

One teal brand color, neutral greys, and two urgency colors (red and amber) that are reserved for deadlines and warnings only.

Colors (light / dark), defined once as theme tokens in code:

- background: #F7F8FA / #0D1117
- surface (cards, sheets): #FFFFFF / #161B22
- text primary: #111418 / #E6EDF3
- text secondary: #5B6470 / #9AA4B2
- border: #E3E6EA / #2A313C
- brand (buttons, active chips, links): #0E7C66 / #3DD6B0
- on-brand text (text on brand buttons): #FFFFFF / #0D1117
- urgent (deadline 2 days or less, warnings): #C62828 / #FF6B6B
- soon (deadline 3 to 7 days, check-details): #9A5B00 / #F2B84B
- muted (stale, closed): #8A929C / #6B7480

Rules: red and amber never appear as decoration. Every color meaning also has a text or icon, so nothing depends on color alone. Check text contrast of at least 4.5:1 for body text in both themes.

Typography (Android system font, Roboto, so nothing to load):

- Screen title: 22 sp, semibold
- Card title: 16 sp, semibold, max 2 lines
- Body: 14 sp, regular
- Meta (organizer, source, time): 12 sp, regular, text secondary
- Countdown: 13 sp, semibold, in urgent or soon color when relevant

Spacing and shape:

- 4-point grid: 4, 8, 12, 16, 24, 32.
- Screen side padding 16; gap between cards 12; padding inside cards 16.
- Corner radius: cards 12, buttons 10, chips fully rounded, bottom sheet top corners 16.
- Elevation: none on cards in dark mode (use border); a very light shadow in light mode.

Icons: MaterialCommunityIcons from @expo/vector-icons, outline style, 20 to 24 dp. Key icons: map-marker (offline), web (online), clock (deadline), currency-inr (fee), trophy (prize), shield-check (trusted), alert (warning), bookmark / bookmark-outline (save).

## Components

Six reusable components cover almost every screen; build them once in a components/ folder before building screens.

1. Event card (the most important component)
   - Row 1: countdown badge on the left ("5 days left", colored by urgency), trust icon on the right.
   - Row 2: title, 2 lines max.
   - Row 3: organizer, 1 line, text secondary.
   - Row 4: three meta items with icons: mode or distance ("12 km" or "Online"), fee ("Free" or "₹300"), prize ("₹1L" or hidden if none).
   - Right edge of row 1: bookmark button (48 dp tap area).
   - Warning events: thin urgent-colored left border plus the warning icon.
   - Closed or stale: whole card at 60% opacity, countdown replaced by "Closed" or "Outdated".
   - Whole card is tappable except the bookmark.
2. Filter chip
   - Off: border only. On: brand fill with on-brand text and a small x to remove.
3. Trust label (pill)
   - Trusted source (shield-check, brand), Check details (info, soon), Warning (alert, urgent), Outdated (clock-alert, muted). Always icon plus word.
4. Buttons
   - Primary: brand fill, 48 dp tall, full width in bottom bars (Apply, Show 14 hackathons).
   - Secondary: brand outline (Save as alert filter, Reset).
   - Text button: for low-priority actions (Skip, Not yet).
5. Bottom sheet (Filters)
   - Drag handle, title, scrollable options, sticky bottom bar with Reset and Show N.
6. Banner
   - Full-width strip under the header for offline, permission and source issues. Neutral surface with an icon; one action button at most.

Also needed: toast (short confirmation at bottom, 3 seconds, optional Undo), skeleton cards (grey placeholders while the very first sync loads), and a section header for Saved ("Interested · 4").

## Screen layouts

Each screen is described top to bottom; the App Flow document covers what happens on tap.

Onboarding (one step per screen):

- Progress dots at top (5 dots).
- Big question as title ("What do you want to build?").
- Options as large chips or cards in the middle.
- Bottom: primary Next button, text button Skip (hidden on step 1 and 2).

Feed:

- Header: app name on the left, sync indicator on the right.
- Search bar (full width).
- Row: sort button on the left ("Best match ▾"), filter button on the right ("Filters · 3").
- Active filter chips, horizontally scrollable, one line.
- Card list with 12 dp gaps. Footer text "Updated 2 h ago".
- Bottom tab bar: Feed, Saved, Settings (icons with labels).

Event detail:

- Top bar: back, share, open in maps.
- Countdown badge and trust pill.
- Title (22 sp), organizer.
- Summary line in a soft surface box ("Free · Offline · 12 km · 2 to 4 members · AI").
- "Why this matches" with two short reasons.
- Warning box (only if warnings), urgent border, plain-language reasons.
- Details as label and value rows: Deadline, Event dates, Venue, Team size, Fee, Prizes and perks, Eligibility, Themes (chips), Source and last checked.
- Sticky bottom bar: Save (outline, icon) on the left, Apply (primary, wide) on the right, with the link domain in small text above Apply.

Saved:

- Segmented control: Interested · 4 | Registered · 1.
- Cards sorted by nearest deadline; swipe left reveals Remove.
- Collapsed "Past" section at the bottom.

Settings:

- Grouped list: My preferences, Location, Notifications, Data and about.
- Each row: label on the left, current value in text secondary on the right, chevron.
- Delete my data in urgent-colored text at the very bottom.

Empty states: one line of text, one action button, and a single simple icon. No illustrations.

## Accessibility and Android rules

The app must stay usable with large system fonts, TalkBack, and dark mode, and must respect Android's back button and edge-to-edge screens.

- Touch targets at least 48 × 48 dp, including the bookmark and chip x buttons.
- Support system font scaling up to 200%: cards grow taller instead of cutting text; titles may wrap to 3 lines at large sizes.
- Every icon-only button has an accessibility label ("Save HackX", "Share", "Open filters").
- Cards are read by TalkBack as one sentence: "HackX by SGT University, 5 days left, offline, 12 kilometres, free, trusted source".
- Never use color alone: urgency and trust always pair color with a word or icon.
- Follow the system light or dark theme automatically; no in-app theme switch needed in version 1.
- Draw behind the status and navigation bars correctly (safe area insets), so nothing hides under the gesture bar.
- Reduce motion: keep animations under 250 ms and skip them if the system "remove animations" setting is on.
- Hardware back closes the Filters sheet first, then goes back a screen.
- Test on my Samsung phone in both themes, with font size at maximum, before calling a screen done.

## Writing style

Text in the app is short, specific and friendly, like a classmate telling you about an event; English only in version 1.

Rules:

- Numbers over words: "5 days left", not "closing soon". "₹1L prize", not "big prize".
- Indian formats: ₹, lakh and crore for prizes (₹1,00,000 shown as ₹1L), dates like "Tue, 30 Sep", 12-hour time with am/pm.
- Buttons are verbs: Apply, Save, Show 14 hackathons, Turn on.
- Errors say what happened and what to do: "Can't load hackathons. Check your connection."
- Warnings are factual, never accusing: "Fee is ₹800 and no prize is listed", not "This looks like a scam".
- No exclamation marks except in the one-time welcome line.

Key strings:

- Countdown: "Closes today", "1 day left", "5 days left", "Closed", "Deadline not listed".
- Distance: "Online", "12 km", "about 20 km (approx.)", "Set location to see distance".
- Fee: "Free", "₹300 per team", "Fee not listed".
- Trust: "Trusted source", "Check details", "Warning", "Outdated".
- Empty filter result: "No hackathons match these filters."
- Save toast: "Saved. Reminders set for 7 days, 48 h and 24 h before the deadline."

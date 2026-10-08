# HackRadar mobile design (source of truth for every screen)

Read this and `docs/UI UX Design Brief HackRadar.md` before any UI change. Tokens live in `src/theme.js`.

## App Read
Hackathon-finder utility for Indian college students; calm, dense "radar" language (transit/weather-app
feel, not a social feed); plain StyleSheet + theme tokens; native navigation chrome.
- platforms: Android first-class; iOS and web not targeted in v1
- posture: unified-brand
- offline: required (cached feed + offline banner)

## Dials
- DESIGN_EXPRESSION 4: branded content (tokens, EventCard), native tab bar and headers
- MOTION_INTENSITY 3: press feedback, bookmark toggle, sheet; every animation < 250 ms, off with system "remove animations"
- VISUAL_DENSITY 6: ~10 cards scannable per screen, never below 48 dp touch targets

Signature element: the countdown badge on each card ("5 days left" in urgent/soon color). Everything else stays quiet.

## Nav Read
```
tabs (3): Feed · Saved · Profile       (Profile = account + my feed preferences; route stays /settings)
src/app/
  (onboarding)/ welcome, interests, join, location, notifications   first launch only
  (tabs)/ index = Feed  → push event/[id]
          saved         → push event/[id]
          settings      "Profile" tab → push about; account (slides up)
  event/[id]                           push, deep link hackradar://event/<id>
entry points: Feed chip row: Filters (sheet), Sort (sheet), City (full-screen city search)
sheets: filters, sort (over Feed); app hand-off (Event detail); row menu (Saved)
android back: default pop; an open sheet closes first
max taps to any core screen: 2
```

## Commitments
- One accent (brand teal). Red/amber only for deadline urgency and warnings, always with a word or icon.
- One icon family: MaterialCommunityIcons, outline at rest, filled when active.
- One radius scale: card 12, button 10, sheet 16, chips fully rounded.
- Screen padding 16, card gap 12, card padding 16.
- System font (Roboto). Brief-listed muted color changed for contrast (see theme.js comments).
- No gradients, illustrations, emoji, stock images, exclamation marks (except the one welcome line).
- Third tab is "Profile" (user's choice, 1 Oct): it holds the account and the feed preferences.
- Tab header titles are left-aligned as in the brief (centered 29 Sep, back to left 8 Oct by the user).
- Feed tab tapped again: once scrolls to the top, twice quickly starts over (refresh, no filters, default sort).
- Deviation from the brief, user's choice (30 Sep): light theme only; the dark theme was removed.
- Profile shows every choice in place (chips, Segmented); bottom sheets are for Feed filters and sort only.
- Feed top (user's choice, 1 Oct): search, then ONE chip row: Filters · Sort · City (action chips with an
  icon), then the filters that are on as soft (tinted) chips with an x. No floating bar, no city banner.
- Trust shows on a card only when it needs a look ("Check details", "Warning"), as icon + word; 9 in 10
  events come from trusted sources, so a mark on every card said nothing. Event detail keeps the full label.
- Taps must answer within a frame: list items take one stable callback (memo), heavy list updates go in
  startTransition, tabs are prefetched. Measured before/after in design-baseline.json.

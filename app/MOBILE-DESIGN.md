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
tabs (3): Feed · Saved · Settings      (App Flow doc; no profile screen exists, so Settings is a tab)
src/app/
  (onboarding)/ welcome, interests, join, location, notifications   first launch only
  (tabs)/ index = Feed  → push event/[id]
          saved         → push event/[id]
          settings
  event/[id]                           push, deep link hackradar://event/<id>
sheets: filters (over Feed)
android back: default pop; Filters sheet closes first
max taps to any core screen: 2
```

## Commitments
- One accent (brand teal). Red/amber only for deadline urgency and warnings, always with a word or icon.
- One icon family: MaterialCommunityIcons, outline at rest, filled when active.
- One radius scale: card 12, button 10, sheet 16, chips fully rounded.
- Screen padding 16, card gap 12, card padding 16.
- System font (Roboto). Brief-listed muted color changed for contrast (see theme.js comments).
- No gradients, illustrations, emoji, stock images, exclamation marks (except the one welcome line).
- Deviations from the mobile-taste skill, on purpose: Settings is a tab (App Flow doc decides).
- Deviation from the brief, user's choice (29 Sep): tab header titles are centered ("HackRadar" on Feed), not left.

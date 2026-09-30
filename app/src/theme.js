// HackRadar design tokens. Source of truth: docs/UI UX Design Brief HackRadar.md.
// Screens and components read everything from here. No hex values anywhere else.
import { Platform } from 'react-native';

// Light only (user's call, 30 Sep 2026: the dark look felt "AI-made"). One set of colours, so switching,
// delays and "match device" problems can't happen.
const colors = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceSoft: '#EEF1F4', // summary box, skeletons, pressed rows, segmented track
  textPrimary: '#111418',
  textSecondary: '#5B6470',
  border: '#E3E6EA',
  brand: '#0E7C66',
  onBrand: '#FFFFFF',
  brandSoft: '#E1F2EE', // selected chip background alternative, focus rings
  urgent: '#C62828', // deadline <= 2 days, warnings. Never decoration.
  soon: '#9A5B00', // deadline 3-7 days, check details. Never decoration.
  muted: '#697280', // stale, closed. Brief had #8A929C (2.96:1); darkened to pass 4.5:1
  urgentSoft: '#FBEAEA', // warning box fill
  inverseSurface: '#111418', // toast
  inverseText: '#F7F8FA',
  inverseBrand: '#3DD6B0', // toast action on the dark toast
  scrim: 'rgba(0,0,0,0.45)', // behind sheets and popups
};

// 4-point grid from the brief
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const layout = { screenPadding: 16, cardGap: 12, cardPadding: 16, minTouch: 48 };
export const radius = { card: 12, button: 10, sheet: 16, pill: 999 };

// Roboto (Android system font): nothing to load, no font-swap flash.
// To switch to Inter later: install @expo-google-fonts/inter and set family here.
const family = undefined;
const base = { fontFamily: family, includeFontPadding: false };
export const type = {
  screenTitle: { ...base, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  cardTitle: { ...base, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { ...base, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { ...base, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  meta: { ...base, fontSize: 12, lineHeight: 16, fontWeight: '400' },
  countdown: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
};
// custom chrome text (buttons, chips) scales with system font size, but capped so it can't break layout
export const CHROME_MAX_SCALE = 1.4;

// Brief: every animation under 250 ms; skipped entirely when the system says "remove animations"
export const motion = {
  fast: 120,
  base: 180,
  max: 240,
  pressScale: 0.97,
  spring: { damping: 20, stiffness: 320, mass: 0.6 },
};

// A very light shadow; iOS shadow props and Android elevation always travel together.
const elevation = {
  card: Platform.select({
    android: { elevation: 1 },
    default: { shadowColor: '#111418', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  }),
};

// Kept as a hook so screens don't change; scheme is always 'light'
export function useAppTheme() {
  return { scheme: 'light', colors, elevation };
}

export { colors };

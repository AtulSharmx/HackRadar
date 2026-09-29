// HackRadar design tokens. Source of truth: docs/UI UX Design Brief HackRadar.md.
// Screens and components read everything from here. No hex values anywhere else.
import { Platform, useColorScheme } from 'react-native';

const palette = {
  light: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceSoft: '#EEF1F4', // summary box, skeletons, pressed rows
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
    inverseBrand: '#3DD6B0', // toast action: the dark-mode brand reads on the dark toast
    scrim: 'rgba(0,0,0,0.45)', // behind bottom sheets
  },
  dark: {
    background: '#0D1117',
    surface: '#161B22',
    surfaceSoft: '#1E252E',
    textPrimary: '#E6EDF3',
    textSecondary: '#9AA4B2',
    border: '#2A313C',
    brand: '#3DD6B0',
    onBrand: '#0D1117',
    brandSoft: '#123A33',
    urgent: '#FF6B6B',
    soon: '#F2B84B',
    muted: '#7D8793', // brief had #6B7480 (4.0:1); lightened to pass 4.5:1
    urgentSoft: '#2A1618',
    inverseSurface: '#E6EDF3',
    inverseText: '#0D1117',
    inverseBrand: '#0E7C66',
    scrim: 'rgba(0,0,0,0.6)',
  },
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

// Brief: no shadow in dark mode (border instead), a very light one in light mode.
// iOS shadow props and Android elevation always travel together.
function elevation(scheme) {
  if (scheme === 'dark') return { card: {} };
  return {
    card: Platform.select({
      android: { elevation: 1 },
      default: { shadowColor: '#111418', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    }),
  };
}

export function useAppTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: palette[scheme], elevation: elevation(scheme) };
}

export { palette };

// Search, filters and sort for the Feed. Filtering reuses match.matches, so the feed and the alerts
// apply a filter the same way (same rules as shared/match_cases.json).
import { matches, score } from './match';
import { THEME_NAMES } from './labels';

export const SORTS = [
  ['best', 'Best match'],
  ['closing', 'Closing soonest'],
  ['newest', 'Newest'],
  ['nearest', 'Nearest'],
  ['prize', 'Highest prize'],
];

// Feed opens with my onboarding answers applied (App Flow: onboarding Finish)
export function defaultFilters(prefs) {
  return {
    themes: prefs?.themes || [],
    modes: prefs?.modes || ['online', 'offline', 'hybrid'],
    fee_max: prefs?.fee_max ?? null,
    max_km: prefs?.max_km ?? null,
    closing_within_days: null,
    solo_only: false,
    exclude_warnings: !!prefs?.hide_warnings,
  };
}

// The device-row shape match.js expects
export function asDevice(prefs, filters) {
  return {
    prefs: prefs || {},
    alert_filter: filters,
    lat_rounded: prefs?.lat ?? null,
    lng_rounded: prefs?.lng ?? null,
  };
}

const ALL_MODES = ['online', 'offline', 'hybrid'];

// One removable chip per active filter: [{ key, label, clear(filters) -> filters }]
export function activeChips(f, hasLocation) {
  const chips = [];
  if (f.themes?.length) {
    const names = f.themes.map((t) => THEME_NAMES[t] || t);
    chips.push({ key: 'themes', label: names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', '), clear: (x) => ({ ...x, themes: [] }) });
  }
  if (f.modes?.length && f.modes.length < ALL_MODES.length) {
    chips.push({ key: 'modes', label: f.modes.includes('online') ? 'Online only' : 'Offline and hybrid', clear: (x) => ({ ...x, modes: ALL_MODES }) });
  }
  if (f.fee_max === 0) chips.push({ key: 'fee', label: 'Free', clear: (x) => ({ ...x, fee_max: null }) });
  if (f.max_km != null && hasLocation && (!f.modes?.length || f.modes.includes('offline'))) {
    chips.push({ key: 'km', label: `Within ${f.max_km} km`, clear: (x) => ({ ...x, max_km: null }) });
  }
  if (f.closing_within_days != null) {
    chips.push({ key: 'closing', label: `Closing in ${f.closing_within_days} days`, clear: (x) => ({ ...x, closing_within_days: null }) });
  }
  if (f.solo_only) chips.push({ key: 'solo', label: 'Solo allowed', clear: (x) => ({ ...x, solo_only: false }) });
  if (f.exclude_warnings) chips.push({ key: 'warnings', label: 'No warnings', clear: (x) => ({ ...x, exclude_warnings: false }) });
  return chips;
}

const byDeadline = (a, b) => {
  if (!a.registration_deadline) return b.registration_deadline ? 1 : 0;
  if (!b.registration_deadline) return -1;
  return a.registration_deadline.localeCompare(b.registration_deadline);
};

// Search (title + organizer) -> filters -> sort. Returns the list the Feed renders.
export function applyView(events, { query = '', filters, sort = 'best', prefs, now = new Date() }) {
  const device = asDevice(prefs, filters);
  const q = query.trim().toLowerCase();
  let list = events.filter((e) => {
    if (q && !`${e.title} ${e.organizer || ''}`.toLowerCase().includes(q)) return false;
    return matches(e, device, now);
  });

  const km = (e) => (e.mode === 'online' ? Infinity : e.lat == null || device.lat_rounded == null ? Infinity
    : Math.hypot(e.lat - device.lat_rounded, (e.lng - device.lng_rounded) * Math.cos((e.lat * Math.PI) / 180)));

  if (sort === 'best') {
    const scored = new Map(list.map((e) => [e.id, score(e, device, now)[0]]));
    // many events tie at 100: the closer deadline wins the tie
    list = [...list].sort((a, b) => scored.get(b.id) - scored.get(a.id) || byDeadline(a, b));
  } else if (sort === 'closing') {
    list = list.filter((e) => e.registration_deadline).sort(byDeadline); // unknown deadlines excluded (App Flow)
  } else if (sort === 'newest') {
    list = [...list].sort((a, b) => (b.first_seen_at || '').localeCompare(a.first_seen_at || ''));
  } else if (sort === 'nearest') {
    list = [...list].sort((a, b) => km(a) - km(b) || byDeadline(a, b));
  } else if (sort === 'prize') {
    list = [...list].sort((a, b) => (b.prize_amount_inr || 0) - (a.prize_amount_inr || 0) || byDeadline(a, b));
  }
  return list;
}

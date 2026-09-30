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

const ALL_MODES = ['online', 'offline', 'hybrid'];

// Feed opens with my onboarding answers applied (App Flow: onboarding Finish)
export function defaultFilters(prefs) {
  const located = prefs?.lat != null;
  return {
    themes: prefs?.themes || [],
    // no location yet: online only until a city is set (App Flow, onboarding step 4), not saved as a choice
    modes: located ? prefs?.modes || ALL_MODES : ['online'],
    fee_max: prefs?.fee_max === 0 ? 0 : null, // onboarding asks Free only / Free and paid
    paid_only: false,
    // a distance means nothing without my location; applied anyway it would hide every offline event
    max_km: located ? prefs?.max_km ?? null : null,
    closing_within_days: null,
    solo_only: false,
    exclude_warnings: !!prefs?.hide_warnings,
  };
}

// Fee filter as one choice: 'free' | 'paid' | 'both', and back
export const feeChoice = (f) => (f.paid_only ? 'paid' : f.fee_max === 0 ? 'free' : 'both');
export const FEE_CHOICES = {
  free: { fee_max: 0, paid_only: false },
  paid: { fee_max: null, paid_only: true },
  both: { fee_max: null, paid_only: false },
};

// The device-row shape match.js expects
export function asDevice(prefs, filters) {
  return {
    prefs: prefs || {},
    alert_filter: filters,
    lat_rounded: prefs?.lat ?? null,
    lng_rounded: prefs?.lng ?? null,
  };
}

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
  if (feeChoice(f) !== 'both') {
    chips.push({ key: 'fee', label: feeChoice(f) === 'free' ? 'Free' : 'Paid', clear: (x) => ({ ...x, ...FEE_CHOICES.both }) });
  }
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
    // when the source published it; first_seen_at only says when HackRadar found it
    const posted = (e) => Date.parse(e.posted_at || e.first_seen_at) || 0;
    list = [...list].sort((a, b) => posted(b) - posted(a) || byDeadline(a, b));
  } else if (sort === 'nearest') {
    list = [...list].sort((a, b) => km(a) - km(b) || byDeadline(a, b));
  } else if (sort === 'prize') {
    list = [...list].sort((a, b) => (b.prize_amount_inr || 0) - (a.prize_amount_inr || 0) || byDeadline(a, b));
  }
  return list;
}

// Search, filters and sort for the Feed. Filtering reuses match.matches, so the feed and the alerts
// apply a filter the same way (same rules as shared/match_cases.json).
import { matches, score } from './match';
import { PLATFORM_NAMES, THEME_NAMES } from './labels';

export const SORTS = [
  ['best', 'Best match'],
  ['closing', 'Closing soonest'],
  ['newest', 'Newest'],
  ['nearest', 'Nearest'],
  ['prize', 'Highest prize'],
];

const ALL_MODES = ['online', 'offline', 'hybrid'];

// The Feed opens with every open hackathon (launch audit, 10 Oct 2026: interests as a hard filter showed
// "43 of 260"). My answers rank it instead: "Best match" scores interests, distance, fee and deadline
// (match.score), and new-match alerts still use them as a filter (prefs.toDeviceRow). The one thing hidden
// by default is what I asked to hide: events with warnings.
// Degree eligibility is opt-in too (user, 20 Oct 2026): no "Open to BCA" filter on the first open; the
// Filters sheet can still turn it on.
export function defaultFilters(prefs) {
  return { ...clearedFilters(), exclude_warnings: !!prefs?.hide_warnings };
}

// "Clear" in the Filters sheet: no filter at all, every open hackathon.
// eligible_only drops only listings closed to my degree (school-only, postgraduate-only for a BTech...).
export function clearedFilters() {
  return {
    themes: [], modes: ALL_MODES, fee_max: null, paid_only: false, max_km: null,
    closing_within_days: null, solo_only: false, exclude_warnings: false, eligible_only: false, platforms: [],
  };
}

// Feed pages: 10 cards each (user's choice, 30 Sep). page is 1-based and clamped to what exists.
export const PAGE_SIZE = 10;
export function pageOf(list, page) {
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  return { items: list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, pages };
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
// degreeLabel: "BCA" etc. when my degree is known (the eligibility chip)
export function activeChips(f, hasLocation, degreeLabel = null) {
  const chips = [];
  if (f.eligible_only !== false && degreeLabel) {
    chips.push({ key: 'eligible', label: `Open to ${degreeLabel}`, clear: (x) => ({ ...x, eligible_only: false }) });
  }
  if (f.themes?.length) {
    const names = f.themes.map((t) => THEME_NAMES[t] || t);
    chips.push({ key: 'themes', label: names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', '), clear: (x) => ({ ...x, themes: [] }) });
  }
  if (f.platforms?.length) {
    const names = f.platforms.map((p) => PLATFORM_NAMES[p] || p);
    chips.push({ key: 'platforms', label: names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', '), clear: (x) => ({ ...x, platforms: [] }) });
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

// The platform an event is credited to: the other one when Unstop isn't the only place listing it.
export const platformOf = (e) => (e.sources || []).find((s) => s !== 'unstop') || e.sources?.[0] || null;

// About 9 in 10 listings are on Unstop, so plain ranking shows a wall of one site (user, 30 Oct 2026). Never more
// than 2 in a row from one platform while another still has an event that can be lifted.
export function mixPlatforms(list, canLift = () => true) {
  const rest = [...list];
  const out = [];
  let last = null;
  let run = 0;
  while (rest.length) {
    let i = 0;
    if (run >= 2 && platformOf(rest[0]) === last) {
      const other = rest.findIndex((e) => platformOf(e) !== last && canLift(e));
      if (other > 0) i = other;
    }
    const [e] = rest.splice(i, 1);
    const p = platformOf(e);
    run = p === last ? run + 1 : 1;
    last = p;
    out.push(e);
  }
  return out;
}

// Search (title + organizer) -> filters -> sort. Returns the list the Feed renders.
// only: a Set of event ids from a tapped notification; then exactly those show (search and filters
// don't apply: the collector already matched them to this person), in the chosen order.
export function applyView(events, { query = '', filters, sort = 'best', prefs, now = new Date(), only = null }) {
  const device = asDevice(prefs, filters);
  const q = query.trim().toLowerCase();
  let list = events.filter((e) => {
    if (only) return only.has(e.id);
    if (q && !`${e.title} ${e.organizer || ''}`.toLowerCase().includes(q)) return false;
    if (filters?.platforms?.length && !(e.sources || []).some((s) => filters.platforms.includes(s))) return false;
    return matches(e, device, now);
  });

  const km = (e) => (e.mode === 'online' ? Infinity : e.lat == null || device.lat_rounded == null ? Infinity
    : Math.hypot(e.lat - device.lat_rounded, (e.lng - device.lng_rounded) * Math.cos((e.lat * Math.PI) / 180)));

  if (sort === 'best') {
    const scored = new Map(list.map((e) => [e.id, score(e, device, now)]));
    // many events tie at 100: the closer deadline wins the tie
    list = [...list].sort((a, b) => scored.get(b.id)[0] - scored.get(a.id)[0] || byDeadline(a, b));
    list = mixPlatforms(list, (e) => scored.get(e.id)[1].distance > 0); // never lift one I can't get to
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

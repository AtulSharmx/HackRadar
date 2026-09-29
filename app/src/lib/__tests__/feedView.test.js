import { activeChips, applyView, defaultFilters } from '../feedView';

const NOW = new Date('2026-09-29T06:30:00Z');
const PREFS = { themes: ['ai_ml'], modes: ['online', 'offline', 'hybrid'], fee_max: null, max_km: 50, hide_warnings: false, lat: 28.46, lng: 77.03 };
const base = { status: 'open', trust_label: 'trusted_source', fee_amount: 0, themes: ['ai_ml'], mode: 'online', first_seen_at: '2026-09-20T00:00:00Z' };
const E = [
  { ...base, id: 'a', title: 'CyberX CTF', organizer: 'IIT Delhi', themes: ['cybersecurity'], registration_deadline: '2026-10-03T18:29:00Z' },
  { ...base, id: 'b', title: 'AI Build Sprint', organizer: 'GDG Gurugram', registration_deadline: '2026-10-04T18:29:00Z', prize_amount_inr: 50000 },
  { ...base, id: 'c', title: 'HackNCR', mode: 'offline', lat: 28.50, lng: 77.08, registration_deadline: '2026-10-20T18:29:00Z', first_seen_at: '2026-09-28T00:00:00Z', prize_amount_inr: 100000 },
  { ...base, id: 'd', title: 'Mumbai AI Meet', mode: 'offline', lat: 19.05, lng: 72.87, registration_deadline: '2026-10-05T18:29:00Z' },
  { ...base, id: 'e', title: 'No Deadline AI', registration_deadline: null },
];
const ids = (list) => list.map((e) => e.id);

test('defaults come from my onboarding answers', () => {
  const f = defaultFilters(PREFS);
  expect(ids(applyView(E, { filters: f, prefs: PREFS, now: NOW }))).toEqual(['b', 'c', 'e']); // AI only, Mumbai too far
});

test('search matches title or organizer', () => {
  const f = defaultFilters({ ...PREFS, themes: [] });
  expect(ids(applyView(E, { query: 'gdg', filters: f, prefs: PREFS, now: NOW }))).toEqual(['b']);
  expect(ids(applyView(E, { query: '  ctf ', filters: f, prefs: PREFS, now: NOW }))).toEqual(['a']);
});

test('sorts', () => {
  const f = defaultFilters({ ...PREFS, themes: [], max_km: null });
  const run = (sort) => ids(applyView(E, { filters: f, sort, prefs: PREFS, now: NOW }));
  expect(run('closing')).toEqual(['a', 'b', 'd', 'c']); // unknown deadline left out
  expect(run('newest')[0]).toBe('c');
  expect(run('nearest').slice(0, 2)).toEqual(['c', 'd']); // offline by distance, online last
  expect(run('prize').slice(0, 2)).toEqual(['c', 'b']);
});

test('best match: higher score first, closer deadline breaks ties', () => {
  const f = defaultFilters({ ...PREFS, themes: [], max_km: null });
  const list = ids(applyView(E, { filters: f, sort: 'best', prefs: PREFS, now: NOW }));
  expect(list.indexOf('b')).toBeLessThan(list.indexOf('a')); // AI theme match beats cyber
});

test('chips: one per active filter, each removable', () => {
  const f = { ...defaultFilters(PREFS), fee_max: 0, closing_within_days: 7, exclude_warnings: true, modes: ['online'] };
  const chips = activeChips(f, true);
  expect(chips.map((c) => c.label)).toEqual(['AI/ML', 'Online only', 'Free', 'Closing in 7 days', 'No warnings']);
  expect(chips.find((c) => c.key === 'fee').clear(f).fee_max).toBeNull();
  expect(activeChips({ ...defaultFilters(PREFS), themes: [] }, true).map((c) => c.label)).toEqual(['Within 50 km']);
  expect(activeChips({ ...defaultFilters(PREFS), themes: [] }, false)).toEqual([]); // no location: km chip means nothing
});

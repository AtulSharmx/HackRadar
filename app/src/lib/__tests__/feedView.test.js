import { activeChips, applyView, clearedFilters, defaultFilters, FEE_CHOICES, feeChoice, pageOf } from '../feedView';

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

test('the Feed opens with every open hackathon, my interests ranked first', () => {
  const f = defaultFilters(PREFS);
  const list = ids(applyView(E, { filters: f, prefs: PREFS, now: NOW }));
  expect(list.sort()).toEqual(['a', 'b', 'c', 'd', 'e']); // nothing hidden: cyber and far Mumbai too
  const ranked = ids(applyView(E, { filters: f, prefs: PREFS, now: NOW }));
  expect(ranked.indexOf('b')).toBeLessThan(ranked.indexOf('a')); // AI (my interest) above cyber
  expect(ranked.indexOf('c')).toBeLessThan(ranked.indexOf('d')); // near Gurugram above far Mumbai
  expect(defaultFilters({ ...PREFS, hide_warnings: true }).exclude_warnings).toBe(true); // an explicit "hide" stays
});

test('from a notification: exactly those events, filters and search set aside, still sorted', () => {
  const f = defaultFilters(PREFS); // would hide a (cybersecurity) and d (Mumbai)
  const only = new Set(['d', 'a', 'gone']); // 'gone' closed since the push: simply not shown
  expect(ids(applyView(E, { query: 'zzz', filters: f, sort: 'closing', prefs: PREFS, now: NOW, only }))).toEqual(['a', 'd']);
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
  // "Newest" = published on the source; HackRadar finding it later (a new source) doesn't make it new
  const posted = E.map((e) => ({ ...e, first_seen_at: '2026-09-29T00:00:00Z', posted_at: e.id === 'd' ? '2026-09-27T00:00:00Z' : '2026-09-01T00:00:00Z' }));
  expect(ids(applyView(posted, { filters: f, sort: 'newest', prefs: PREFS, now: NOW }))[0]).toBe('d');
  expect(run('nearest').slice(0, 2)).toEqual(['c', 'd']); // offline by distance, online last
  expect(run('prize').slice(0, 2)).toEqual(['c', 'b']);
});

test('best match: higher score first, closer deadline breaks ties', () => {
  const f = defaultFilters({ ...PREFS, themes: [], max_km: null });
  const list = ids(applyView(E, { filters: f, sort: 'best', prefs: PREFS, now: NOW }));
  expect(list.indexOf('b')).toBeLessThan(list.indexOf('a')); // AI theme match beats cyber
});

test('no location yet: offline events still show, ranked after online ones', () => {
  const noCity = { ...PREFS, lat: null, lng: null };
  const f = defaultFilters(noCity);
  expect(f.modes).toEqual(['online', 'offline', 'hybrid']);
  expect(f.max_km).toBeNull();
  const list = ids(applyView(E, { filters: f, prefs: noCity, now: NOW }));
  expect(list).toContain('c');
  expect(list.indexOf('b')).toBeLessThan(list.indexOf('c'));
});

test('fee: Free, Paid, Both', () => {
  const paid = { ...base, id: 'p', title: 'Paid Hack', fee_amount: 300, registration_deadline: '2026-10-03T18:29:00Z' };
  const paidNoAmount = { ...paid, id: 'q', fee_amount: null, is_paid: true };
  const unknown = { ...paid, id: 'u', fee_amount: null };
  const list = [E[1], paid, paidNoAmount, unknown];
  const run = (choice) => ids(applyView(list, { filters: { ...defaultFilters({ ...PREFS, themes: [] }), ...FEE_CHOICES[choice] }, sort: 'closing', prefs: PREFS, now: NOW })).sort();
  expect(run('free')).toEqual(['b', 'u']); // free, plus "fee not listed" (shown with that label)
  expect(run('paid')).toEqual(['p', 'q']);
  expect(run('both')).toEqual(['b', 'p', 'q', 'u']);
  expect(feeChoice(FEE_CHOICES.paid)).toBe('paid');
});

test('chips: one per active filter, each removable', () => {
  const f = { ...defaultFilters(PREFS), themes: ['ai_ml'], max_km: 50, fee_max: 0, closing_within_days: 7, exclude_warnings: true, modes: ['online'] };
  const chips = activeChips(f, true);
  expect(chips.map((c) => c.label)).toEqual(['AI/ML', 'Online only', 'Free', 'Closing in 7 days', 'No warnings']);
  expect(chips.find((c) => c.key === 'fee').clear(f).fee_max).toBeNull();
  const paid = activeChips({ ...defaultFilters(PREFS), max_km: 50, ...FEE_CHOICES.paid }, true);
  expect(paid.map((c) => c.label)).toEqual(['Paid', 'Within 50 km']);
  expect(feeChoice(paid[0].clear(FEE_CHOICES.paid))).toBe('both');
  expect(activeChips(defaultFilters(PREFS), true)).toEqual([]); // the default Feed has no filter chips
  expect(activeChips({ ...defaultFilters(PREFS), max_km: 50 }, true).map((c) => c.label)).toEqual(['Within 50 km']);
  expect(activeChips({ ...defaultFilters(PREFS), max_km: 50 }, false)).toEqual([]); // no location: km chip means nothing
});

test('Clear removes every filter: all open hackathons, no chips', () => {
  const all = applyView(E, { filters: clearedFilters(), sort: 'closing', prefs: PREFS, now: NOW });
  expect(ids(all).sort()).toEqual(['a', 'b', 'c', 'd']); // 'e' has no deadline, so Closing soonest leaves it out
  expect(activeChips(clearedFilters(), true)).toEqual([]);
});

test('pages of 10, clamped to the pages that exist', () => {
  const list = Array.from({ length: 23 }, (_, i) => i);
  expect(pageOf(list, 1)).toEqual({ items: list.slice(0, 10), page: 1, pages: 3 });
  expect(pageOf(list, 3).items).toEqual([20, 21, 22]);
  expect(pageOf(list, 9).page).toBe(3); // filters shrank the list under the page I was on
  expect(pageOf([], 1)).toEqual({ items: [], page: 1, pages: 1 });
});

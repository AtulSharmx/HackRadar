import { emptyCache, loadCache, mergeRows, saveCache, syncEvents, visibleEvents } from '../feed';

const ev = (id, over = {}) => ({
  id, title: `Event ${id}`, status: 'open', updated_at: `2026-09-29T0${id}:00:00+00:00`,
  registration_deadline: `2026-10-1${id}T18:29:00+00:00`, ...over,
});
const NOW = new Date('2026-09-29T12:00:00Z');

test('merge adds, updates, and drops closed rows; lastSync is the newest updated_at', () => {
  let c = mergeRows(emptyCache, [ev(1), ev(2)], 'x');
  expect(Object.keys(c.events)).toEqual(['1', '2']);
  c = mergeRows(c, [ev(1, { title: 'Renamed', updated_at: '2026-09-29T05:00:00+00:00' }), ev(2, { status: 'closed', updated_at: '2026-09-29T06:00:00+00:00' })], 'y');
  expect(c.events['1'].title).toBe('Renamed');
  expect(c.events['2']).toBeUndefined();
  expect(c.lastSync).toBe('2026-09-29T06:00:00+00:00');
});

test('visible: open, not passed, soonest first, unknown deadline last', () => {
  const c = mergeRows(emptyCache, [
    ev(3), ev(1), ev(2, { registration_deadline: null }),
    ev(4, { registration_deadline: '2026-09-28T18:29:00+00:00' }), // already passed
  ], 'x');
  expect(visibleEvents(c, NOW).map((e) => String(e.id))).toEqual(['1', '3', '2']);
});

test('corrupt or missing cache falls back to empty instead of crashing', () => {
  expect(loadCache({ getItem: () => '{not json' })).toEqual(emptyCache);
  expect(loadCache(undefined)).toEqual(emptyCache);
  const store = {};
  const fake = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  saveCache({ events: { 1: ev(1) }, lastSync: 'a', fetchedAt: 'b' }, fake);
  expect(loadCache(fake).lastSync).toBe('a');
});

// minimal stand-in for supabase.from('events') query chains
function fakeSupabase(pages) {
  const calls = [];
  const q = {
    select() { return q; },
    gt(col, v) { calls.push(['gt', col, v]); return q; },
    eq(col, v) { calls.push(['eq', col, v]); return q; },
    order() { return q; },
    async range(from) { calls.push(['range', from]); return { data: pages.shift() ?? [], error: null }; },
  };
  return { from: () => q, calls };
}

test('first sync asks only for open events and pages until a short page', async () => {
  const big = Array.from({ length: 500 }, (_, i) => ev(1, { id: `a${i}` }));
  const sb = fakeSupabase([big, [ev(2)]]);
  const c = await syncEvents(sb, emptyCache, NOW);
  expect(Object.keys(c.events)).toHaveLength(501);
  expect(sb.calls).toEqual([['eq', 'status', 'open'], ['range', 0], ['eq', 'status', 'open'], ['range', 500]]);
});

test('later syncs ask only for rows changed since lastSync', async () => {
  const sb = fakeSupabase([[ev(3, { status: 'closed' })]]);
  const start = mergeRows(emptyCache, [ev(3)], 'x');
  const c = await syncEvents(sb, start, NOW);
  expect(sb.calls[0]).toEqual(['gt', 'updated_at', start.lastSync]);
  expect(c.events['3']).toBeUndefined();
});

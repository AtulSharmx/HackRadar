jest.mock('../supabase', () => ({ supabase: {} }));

import { isPast, refreshSnapshots, sections } from '../saved';

const NOW = new Date('2026-09-29T06:30:00Z');
const ev = (id, deadline, extra = {}) => ({ id, status: 'open', registration_deadline: deadline, updated_at: 'u1', ...extra });

test('sections: interested by closest deadline, registered by start date, closed ones under past', () => {
  const state = {
    pending: {},
    entries: {
      a: { status: 'interested', event: ev('a', '2026-10-10T18:29:00Z') },
      b: { status: 'interested', event: ev('b', '2026-10-02T18:29:00Z') },
      c: { status: 'interested', event: ev('c', null) },
      r1: { status: 'registered', event: ev('r1', '2026-10-01T00:00:00Z', { start_date: '2026-10-20T03:30:00Z' }) },
      r2: { status: 'registered', event: ev('r2', '2026-10-03T00:00:00Z', { start_date: '2026-10-12T03:30:00Z' }) },
      old: { status: 'interested', event: ev('old', '2026-09-20T18:29:00Z') },
      shut: { status: 'registered', event: ev('shut', '2026-10-30T18:29:00Z', { status: 'closed' }) },
    },
  };
  const s = sections(state, NOW);
  expect(s.interested.map((e) => e.id)).toEqual(['b', 'a', 'c']);
  expect(s.registered.map((e) => e.id)).toEqual(['r2', 'r1']);
  expect(s.past.map((e) => e.id).sort()).toEqual(['old', 'shut']);
});

test('isPast', () => {
  expect(isPast(ev('x', '2026-09-28T00:00:00Z'), NOW)).toBe(true);
  expect(isPast(ev('x', null), NOW)).toBe(false);
  expect(isPast(ev('x', '2026-12-01T00:00:00Z', { status: 'stale' }), NOW)).toBe(true);
  expect(isPast(null, NOW)).toBe(true); // event deleted on the server
});

test('fresh feed data replaces old snapshots; unchanged state is returned as-is', () => {
  const state = { pending: {}, entries: { a: { status: 'interested', event: ev('a', '2026-10-10T18:29:00Z') } } };
  const moved = refreshSnapshots(state, { a: ev('a', '2026-10-15T18:29:00Z', { updated_at: 'u2' }) });
  expect(moved.entries.a.event.registration_deadline).toBe('2026-10-15T18:29:00Z');
  expect(refreshSnapshots(state, { a: ev('a', '2026-10-10T18:29:00Z') })).toBe(state);
});

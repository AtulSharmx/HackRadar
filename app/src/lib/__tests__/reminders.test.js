jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { diff, outsideQuiet, planFor, reminderWords, tapTarget } from '../reminders';

const NOW = new Date('2026-10-01T06:30:00Z').getTime(); // Thu 1 Oct, 12 pm IST
const at = (iso) => new Date(iso).getTime();
const ev = (extra) => ({ id: 'e1', title: 'HackX', status: 'open', ...extra });

test('quiet hours (11 pm to 8 am IST) move a reminder to 9 pm before, never later', () => {
  expect(outsideQuiet(at('2026-10-03T18:29:00Z'))).toBe(at('2026-10-03T15:30:00Z')); // 11:59 pm -> 9 pm same day
  expect(outsideQuiet(at('2026-10-09T01:30:00Z'))).toBe(at('2026-10-08T15:30:00Z')); // 7 am -> 9 pm the day before
  expect(outsideQuiet(at('2026-10-09T06:30:00Z'))).toBe(at('2026-10-09T06:30:00Z')); // noon stays
});

test('interested: 7 days, 48 h and 24 h before a 11:59 pm deadline, worded by calendar day', () => {
  const plan = planFor('e1', { status: 'interested', event: ev({ registration_deadline: '2026-10-10T18:29:00Z' }) }, NOW);
  expect(plan.map((p) => [p.key, p.at, p.title])).toEqual([
    ['7d', at('2026-10-03T15:30:00Z'), 'HackX closes in 7 days'],
    ['48h', at('2026-10-08T15:30:00Z'), 'HackX closes in 2 days'],
    ['24h', at('2026-10-09T15:30:00Z'), 'HackX closes tomorrow'],
  ]);
  expect(plan[0].body).toBe('Registration ends Sat, 10 Oct, 11:59 pm. Tap to open.');
  expect(plan[0].eventId).toBe('e1');
});

test('past slots are skipped; no deadline, closed or stale means no reminders', () => {
  const soon = ev({ registration_deadline: '2026-10-03T06:30:00Z' }); // Sat noon: only 24 h is still ahead
  expect(planFor('e1', { status: 'interested', event: soon }, NOW).map((p) => p.key)).toEqual(['24h']);
  expect(reminderWords(soon, NOW)).toEqual(['24 h']);
  expect(planFor('e1', { status: 'interested', event: ev({ registration_deadline: null }) }, NOW)).toEqual([]);
  expect(planFor('e1', { status: 'interested', event: ev({ registration_deadline: '2026-10-10T18:29:00Z', status: 'closed' }) }, NOW)).toEqual([]);
  expect(planFor('e1', { status: 'interested', event: null }, NOW)).toEqual([]);
});

test('registered: one reminder at 7 pm IST the evening before it starts, even after registration closed', () => {
  const e = ev({ status: 'closed', start_date: '2026-10-05T03:30:00Z', mode: 'offline', city: 'Gurugram' });
  const plan = planFor('e1', { status: 'registered', event: e }, NOW);
  expect(plan.map((p) => [p.key, p.at, p.title, p.body])).toEqual([
    ['start', at('2026-10-04T13:30:00Z'), 'HackX starts tomorrow', 'Mon, 5 Oct, 9:00 am · Gurugram. Tap to open.'],
  ]);
  const online = planFor('e1', { status: 'registered', event: ev({ start_date: '2026-10-04T18:30:00Z', mode: 'online' }) }, NOW);
  expect(online[0].body).toBe('Mon, 5 Oct · Online. Tap to open.'); // a date-only start shows no time
  expect(planFor('e1', { status: 'registered', event: ev({ start_date: '2026-10-01T09:30:00Z' }) }, NOW)).toEqual([]); // starts today: its eve has passed
});

test('diff cancels what is no longer wanted and adds only what is missing', () => {
  const want = [{ id: 'rem:a:24h:1' }, { id: 'rem:b:7d:2' }];
  expect(diff(['rem:a:24h:1', 'rem:old:7d:0'], want)).toEqual({ cancel: ['rem:old:7d:0'], add: [{ id: 'rem:b:7d:2' }] });
  expect(diff(['rem:a:24h:1'], [])).toEqual({ cancel: ['rem:a:24h:1'], add: [] }); // notifications off or logged out
});

test('a tapped notification opens the right place', () => {
  expect(tapTarget({ eventId: 'e1' })).toBe('/event/e1'); // reminder or a saved event that changed
  expect(tapTarget({ kind: 'new_match', ids: ['e2'] })).toBe('/event/e2');
  expect(tapTarget({ kind: 'new_match', ids: ['a', 'b'] })).toEqual({ pathname: '/', params: { from: 'a,b' } });
  expect(tapTarget({ kind: 'change', saved: true })).toBe('/saved');
  expect(tapTarget({})).toBe(null);
  expect(tapTarget(undefined)).toBe(null);
});

import { countdown, daysLeft, dateShort, feeLong, feeShort, inr, prizeShort, timeShort, whereShort } from '../format';

// 29 Sep 2026, 11:00 pm IST
const NOW = new Date('2026-09-29T17:30:00Z');

test('countdown counts IST calendar days, not 24-hour blocks', () => {
  // closes tomorrow 10 am IST: less than 24 h away but it is "1 day left", not "Closes today"
  expect(countdown({ registration_deadline: '2026-09-30T04:30:00Z', status: 'open' }, NOW))
    .toEqual({ text: '1 day left', tone: 'urgent' });
  expect(countdown({ registration_deadline: '2026-09-29T18:29:00Z', status: 'open' }, NOW).text).toBe('Closes today');
  expect(daysLeft('2026-10-04T18:29:00Z', NOW)).toBe(5);
});

test('countdown tones follow the brief: <=2 urgent, 3-7 soon', () => {
  const at = (iso) => countdown({ registration_deadline: iso, status: 'open' }, NOW);
  expect(at('2026-10-01T18:29:00Z')).toEqual({ text: '2 days left', tone: 'urgent' });
  expect(at('2026-10-02T18:29:00Z')).toEqual({ text: '3 days left', tone: 'soon' });
  expect(at('2026-10-06T18:29:00Z')).toEqual({ text: '7 days left', tone: 'soon' });
  expect(at('2026-10-07T18:29:00Z')).toEqual({ text: '8 days left', tone: 'neutral' });
});

test('countdown closed, stale, unknown', () => {
  expect(countdown({ registration_deadline: '2026-09-28T18:29:00Z', status: 'open' }, NOW).text).toBe('Closed');
  expect(countdown({ registration_deadline: null, status: 'open' }, NOW).text).toBe('Deadline not listed');
  expect(countdown({ registration_deadline: '2026-10-10T00:00:00Z', status: 'stale' }, NOW))
    .toEqual({ text: 'Outdated', tone: 'muted' });
});

test('Indian money formats', () => {
  expect(inr(100000)).toBe('1,00,000');
  expect(inr(12345678)).toBe('1,23,45,678');
  expect(inr(999)).toBe('999');
  expect(prizeShort(100000)).toBe('₹1L');
  expect(prizeShort(250000)).toBe('₹2.5L');
  expect(prizeShort(12000000)).toBe('₹1.2Cr');
  expect(prizeShort(50000)).toBe('₹50,000');
  expect(prizeShort(65120000, true)).toBe('~₹6.5Cr');
  expect(prizeShort(null)).toBeNull();
});

test('fee wording', () => {
  expect(feeShort(0)).toBe('Free');
  expect(feeShort(null)).toBe('Fee not listed');
  expect(feeShort(300)).toBe('₹300');
  expect(feeLong(1000)).toBe('₹1,000 per team');
});

test('where: online, exact, approximate, unknown', () => {
  expect(whereShort({ mode: 'online' }, null)).toBe('Online');
  expect(whereShort({ mode: 'offline' }, 7.4)).toBe('7 km');
  expect(whereShort({ mode: 'offline' }, 33.2)).toBe('35 km');
  expect(whereShort({ mode: 'offline', location_approximate: true }, 21)).toBe('about 20 km (approx.)');
  expect(whereShort({ mode: 'offline', city: 'Pune' }, null)).toBe('Pune');
});

test('dates in the brief format', () => {
  expect(dateShort('2026-09-30T18:29:00Z')).toBe('Wed, 30 Sep');
  expect(timeShort('2026-09-30T18:29:00Z')).toBe('11:59 pm');
  expect(timeShort('2026-09-30T03:30:00Z')).toBe('9:00 am');
});

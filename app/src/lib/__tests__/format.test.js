import { countdown, daysLeft, dateShort, feeLong, feeShort, inr, joinAnd, prizeLong, prizeShort, timeShort, whereShort } from '../format';

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

test('prize line on the detail screen: one figure, Indian grouping, source figure kept when converted', () => {
  // Unstop's generated text ("₹150,000 in prizes") repeated the amount in western grouping
  expect(prizeLong({ prize_amount_inr: 150000, prize_text: '₹150,000 in prizes' })).toBe('₹1,50,000 in prizes');
  expect(prizeLong({ prize_amount_inr: 880000, prize_approximate: true, prize_text: '$10,000' })).toBe('About ₹8,80,000 in prizes ($10,000)');
  expect(prizeLong({ prize_amount_inr: null, prize_text: 'Internships and goodies' })).toBe('Internships and goodies');
  expect(prizeLong({})).toBeNull();
  expect(joinAnd(['Unstop'])).toBe('Unstop');
  expect(joinAnd(['Unstop', 'Devfolio'])).toBe('Unstop and Devfolio');
  expect(joinAnd(['A', 'B', 'C'])).toBe('A, B and C');
});

test('fee wording', () => {
  expect(feeShort(0)).toBe('Free');
  expect(feeShort(null)).toBe('Fee not listed');
  expect(feeShort(300)).toBe('₹300');
  expect(feeLong(1000)).toBe('₹1,000 fee');
  // Hack2Skill "PAID" with no amount: never shown as free or as unknown
  expect(feeShort(null, true)).toBe('Paid');
  expect(feeLong(null, true)).toBe('Paid, amount not listed');
  expect(feeShort(null, false)).toBe('Free');
});

test('where: online, exact, approximate, unknown', () => {
  expect(whereShort({ mode: 'online' }, null)).toBe('Online');
  expect(whereShort({ mode: 'offline' }, 7.4)).toBe('7 km');
  expect(whereShort({ mode: 'offline' }, 33.2)).toBe('35 km');
  expect(whereShort({ mode: 'offline', location_approximate: true }, 21)).toBe('about 20 km (approx.)');
  expect(whereShort({ mode: 'offline', city: 'Pune' }, null)).toBe('Pune');
  expect(whereShort({ mode: 'offline' }, 1161)).toBe('1,160 km');
  // hybrid says so, so a far one under "Within 50 km" is explained
  expect(whereShort({ mode: 'hybrid', city: 'Pune' }, 1161)).toBe('Hybrid · 1,160 km');
  expect(whereShort({ mode: 'hybrid', city: 'Pune' }, null)).toBe('Hybrid · Pune');
  expect(whereShort({ mode: 'hybrid' }, null)).toBe('Hybrid');
});

test('dates in the brief format', () => {
  expect(dateShort('2026-09-30T18:29:00Z')).toBe('Wed, 30 Sep');
  expect(timeShort('2026-09-30T18:29:00Z')).toBe('11:59 pm');
  expect(timeShort('2026-09-30T03:30:00Z')).toBe('9:00 am');
});

test('ago', () => {
  const { ago } = require('../format');
  expect(ago('2026-09-29T17:29:40Z', NOW)).toBe('just now');
  expect(ago('2026-09-29T17:25:00Z', NOW)).toBe('5 min ago');
  expect(ago('2026-09-29T15:10:00Z', NOW)).toBe('2 h ago');
  expect(ago('2026-09-28T17:00:00Z', NOW)).toBe('1 day ago');
  expect(ago('2026-09-26T17:00:00Z', NOW)).toBe('3 days ago');
});

test('detail helpers', () => {
  const { dateTime, dateRange, teamSize, safeUrl, hostOf } = require('../format');
  expect(dateTime('2026-09-30T18:29:00Z')).toBe('Wed, 30 Sep, 11:59 pm');
  expect(dateRange('2026-10-09T18:30:00Z', '2026-10-10T18:30:00Z')).toBe('Sat, 10 Oct to Sun, 11 Oct');
  expect(dateRange(null, '2026-10-10T18:30:00Z')).toBe('Sun, 11 Oct');
  expect(dateRange(null, null)).toBeNull();
  expect(teamSize(1, 1)).toBe('Solo');
  expect(teamSize(2, 4)).toBe('2 to 4 members');
  expect(teamSize(1, 4)).toBe('Solo or up to 4');
  expect(teamSize(null, null)).toBeNull();
  expect(safeUrl('https://unstop.com/x')).toBe(true);
  expect(safeUrl('javascript:alert(1)')).toBe(false);
  expect(safeUrl('intent://x')).toBe(false);
  expect(hostOf('https://www.Unstop.com/hackathons/x?y=1')).toBe('unstop.com');
  expect(hostOf('https://hack-x.devpost.com/')).toBe('hack-x.devpost.com');
});

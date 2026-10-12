import { checkSubmission, emptySubmission, parseDay } from '../submission';

const NOW = new Date('2026-10-12T06:00:00Z');
const good = {
  ...emptySubmission, title: 'HackSGT 2026', registration_url: 'https://forms.gle/abc', organizer: 'SGT University',
  mode: 'offline', city: 'Gurugram', deadline: '20/10/2026', start: '25/10/2026', fee: 'paid', fee_amount: '₹ 200',
};

test('days are read as India time: a deadline is the end of that day', () => {
  expect(parseDay('20/10/2026', 23, 59).toISOString()).toBe('2026-10-20T18:29:00.000Z');
  expect(parseDay('5-1-2027').toISOString()).toBe('2027-01-04T18:30:00.000Z');
  expect(parseDay('31/02/2026')).toBe(null);
  expect(parseDay('2026-10-20')).toBe(null);
});

test('a complete form becomes the row the database expects', () => {
  const { errors, row } = checkSubmission(good, NOW);
  expect(errors).toEqual({});
  expect(row).toMatchObject({
    title: 'HackSGT 2026', city: 'Gurugram', fee_amount: 200,
    registration_deadline: '2026-10-20T18:29:00.000Z', start_date: '2026-10-25T03:30:00.000Z', end_date: null,
  });
});

test('every problem is named, so the person knows what to fix', () => {
  const { errors, row } = checkSubmission({
    ...emptySubmission, title: 'H', registration_url: 'forms.gle/abc', mode: 'offline', deadline: '01/10/2026',
    start: '30/10/2026', end: '29/10/2026', fee: 'paid', fee_amount: '',
  }, NOW);
  expect(row).toBe(null);
  expect(Object.keys(errors).sort()).toEqual(['city', 'deadline', 'end', 'fee_amount', 'organizer', 'registration_url', 'title']);
  expect(errors.deadline).toMatch(/passed/);
});

test('online events need no city, and an online row never carries one', () => {
  const { row } = checkSubmission({ ...good, mode: 'online', city: 'Gurugram' }, NOW);
  expect(row.city).toBe(null);
});

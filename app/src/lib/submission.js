// "Submit a hackathon" (launch audit, 10 Oct 2026): the form's checks, mirroring the database's (migration
// 0016), so a person sees what to fix instead of a failed insert. Dates are typed as DD/MM/YYYY and read
// as India time: a deadline means the end of that day (11:59 pm), a start date its morning.

const IST_MS = 330 * 60000;

// "25/10/2026" -> Date (UTC) at hh:mm India time on that day; null if it isn't a real date
export function parseDay(text, hh = 0, mm = 0) {
  const m = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(text || '');
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d, hh, mm) - IST_MS;
  const check = new Date(utc + IST_MS);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null; // 31/02
  return new Date(utc);
}

export const emptySubmission = {
  title: '', registration_url: '', organizer: '', mode: 'online', city: null,
  deadline: '', start: '', end: '', fee: 'free', fee_amount: '', prize_text: '', eligibility_text: '', themes: [],
};

// -> { errors: { field: message }, row: the submissions row to insert (only when there are no errors) }
export function checkSubmission(f, now = new Date()) {
  const errors = {};
  const title = f.title.trim();
  const url = f.registration_url.trim();
  const organizer = f.organizer.trim();
  if (title.length < 3) errors.title = 'Give the hackathon its name.';
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(url)) errors.registration_url = 'Paste the full registration link, starting with https://';
  if (organizer.length < 2) errors.organizer = 'Who runs it? A college, club or company.';
  if (f.mode !== 'online' && !f.city) errors.city = 'Pick the city it happens in.';

  const deadline = parseDay(f.deadline, 23, 59);
  if (!deadline) errors.deadline = 'Use DD/MM/YYYY, for example 25/10/2026.';
  else if (deadline <= now) errors.deadline = 'This date has already passed.';
  const start = f.start.trim() ? parseDay(f.start, 9, 0) : null;
  const end = f.end.trim() ? parseDay(f.end, 18, 0) : null;
  if (f.start.trim() && !start) errors.start = 'Use DD/MM/YYYY, or leave it empty.';
  if (f.end.trim() && !end) errors.end = 'Use DD/MM/YYYY, or leave it empty.';
  if (start && end && end < start) errors.end = 'The event can’t end before it starts.';

  let fee = 0;
  if (f.fee === 'paid') {
    fee = Number(String(f.fee_amount).replace(/[^\d]/g, ''));
    if (!fee || fee > 100000) errors.fee_amount = 'Enter the fee in rupees.';
  }
  if (f.prize_text.length > 200) errors.prize_text = 'Keep it under 200 characters.';
  if (f.eligibility_text.length > 300) errors.eligibility_text = 'Keep it under 300 characters.';

  if (Object.keys(errors).length) return { errors, row: null };
  return {
    errors,
    row: {
      title, registration_url: url, organizer, mode: f.mode,
      city: f.mode === 'online' ? null : f.city,
      registration_deadline: deadline.toISOString(),
      start_date: start ? start.toISOString() : null,
      end_date: end ? end.toISOString() : null,
      fee_amount: fee,
      prize_text: f.prize_text.trim() || null,
      eligibility_text: f.eligibility_text.trim() || null,
      themes: f.themes,
    },
  };
}

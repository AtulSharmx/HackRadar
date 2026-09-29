// Every user-facing number and date on cards goes through here, so wording stays identical everywhere.
// Strings follow the "Writing style" section of the design brief.

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86400000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A Date shifted so its UTC fields read as Indian time
function ist(date) {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS);
}

function istDayNumber(date) {
  return Math.floor(ist(date).getTime() / DAY_MS);
}

// Calendar days between today and the deadline, both in IST. 0 = closes today.
export function daysLeft(deadline, now = new Date()) {
  if (!deadline) return null;
  return istDayNumber(deadline) - istDayNumber(now);
}

// { text, tone } for the countdown badge. tone: urgent | soon | neutral | muted
export function countdown(event, now = new Date()) {
  if (event.status === 'stale') return { text: 'Outdated', tone: 'muted' };
  if (event.status === 'closed') return { text: 'Closed', tone: 'muted' };
  if (!event.registration_deadline) return { text: 'Deadline not listed', tone: 'neutral' };
  if (new Date(event.registration_deadline) < now) return { text: 'Closed', tone: 'muted' };
  const d = daysLeft(event.registration_deadline, now);
  if (d <= 0) return { text: 'Closes today', tone: 'urgent' };
  const text = d === 1 ? '1 day left' : `${d} days left`;
  return { text, tone: d <= 2 ? 'urgent' : d <= 7 ? 'soon' : 'neutral' };
}

// 100000 -> "1,00,000" (Indian grouping; not relying on Intl being present in Hermes)
export function inr(n) {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

function trim1(x) {
  return (Math.round(x * 10) / 10).toString();
}

// "₹1L", "₹2.5L", "₹1.2Cr", "₹50,000"; null when there is no cash prize (card hides the item)
export function prizeShort(amount, approximate = false) {
  if (!amount) return null;
  const pre = approximate ? '~₹' : '₹';
  if (amount >= 1e7) return `${pre}${trim1(amount / 1e7)}Cr`;
  if (amount >= 1e5) return `${pre}${trim1(amount / 1e5)}L`;
  return `${pre}${inr(amount)}`;
}

export function feeShort(fee) {
  if (fee === 0) return 'Free';
  if (fee == null) return 'Fee not listed';
  return `₹${inr(fee)}`;
}

export function feeLong(fee) {
  if (fee === 0) return 'Free';
  if (fee == null) return 'Fee not listed';
  return `₹${inr(fee)} per team`;
}

// Card meta: "Online", "12 km", "about 20 km (approx.)", or the city when we can't measure
export function whereShort(event, km) {
  if (event.mode === 'online') return 'Online';
  if (km != null) {
    const n = km < 10 ? Math.max(1, Math.round(km)) : Math.round(km / 5) * 5 || Math.round(km);
    return event.location_approximate ? `about ${n} km (approx.)` : `${n} km`;
  }
  return event.city || (event.mode === 'hybrid' ? 'Hybrid' : 'Offline');
}

// "Tue, 30 Sep"
export function dateShort(date) {
  const d = ist(date);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// "11:59 pm"
export function timeShort(date) {
  const d = ist(date);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

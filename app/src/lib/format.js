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

// Detail "Prizes": one line. A converted amount keeps the source's own figure next to it.
export function prizeLong(event) {
  if (!event.prize_amount_inr) return event.prize_text || null;
  const cash = `₹${inr(event.prize_amount_inr)} in prizes`;
  return event.prize_approximate ? `About ${cash}${event.prize_text ? ` (${event.prize_text})` : ''}` : cash;
}

// "Unstop", "Unstop and Devfolio", "Unstop, Devfolio and Hack2Skill"
export function joinAnd(items) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// paid: the source's own "paid" flag, for listings that charge but give no amount (events.is_paid)
export function feeShort(fee, paid = null) {
  if (fee === 0) return 'Free';
  if (fee == null) return paid ? 'Paid' : paid === false ? 'Free' : 'Fee not listed';
  return `₹${inr(fee)}`;
}

// Sources don't say whether a fee is per person or per team, so neither is claimed
export function feeLong(fee, paid = null) {
  if (fee === 0) return 'Free';
  if (fee == null) return paid ? 'Paid, amount not listed' : paid === false ? 'Free' : 'Fee not listed';
  return `₹${inr(fee)} fee`;
}

// Card meta: "Online", "12 km", "about 20 km (approx.)", or the city when we can't measure.
// Hybrid says so first: distance filters skip hybrid events (they can be joined online), so a far one
// under "Within 50 km" must not look like a broken filter.
export function whereShort(event, km) {
  if (event.mode === 'online') return 'Online';
  let place = event.city || null;
  if (km != null) {
    const n = km < 10 ? Math.max(1, Math.round(km)) : Math.round(km / 5) * 5 || Math.round(km);
    place = event.location_approximate ? `about ${inr(n)} km (approx.)` : `${inr(n)} km`;
  }
  if (event.mode === 'hybrid') return place ? `Hybrid · ${place}` : 'Hybrid';
  return place || 'Offline';
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

// "just now", "5 min ago", "2 h ago", "3 days ago" (footer and offline banner)
export function ago(iso, now = new Date()) {
  const min = Math.floor((now - new Date(iso)) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

// "Wed, 30 Sep, 11:59 pm"
export function dateTime(date) {
  return `${dateShort(date)}, ${timeShort(date)}`;
}

// "Sat, 10 Oct to Sun, 11 Oct", one date when both are the same day, null when unknown
export function dateRange(start, end) {
  if (!start && !end) return null;
  if (!start || !end) return dateShort(start || end);
  const a = dateShort(start);
  const b = dateShort(end);
  return a === b ? a : `${a} to ${b}`;
}

// "Solo", "2 to 4 members", "Solo or up to 4", "Up to 4 members", null when the source says nothing
export function teamSize(min, max) {
  if (!min && !max) return null;
  if (min === 1 && max === 1) return 'Solo';
  if (min === 1 && max) return `Solo or up to ${max}`;
  if (min && max) return min === max ? `${min} members` : `${min} to ${max} members`;
  return max ? `Up to ${max} members` : `At least ${min} members`;
}

// Only http(s) links may open (App Flow, edge case 13)
export function safeUrl(url) {
  return typeof url === 'string' && /^https?:\/\/[^\s/]+/i.test(url);
}

// "https://www.unstop.com/x" -> "unstop.com"
export function hostOf(url) {
  const m = /^https?:\/\/([^/?#:]+)/i.exec(url || '');
  return m ? m[1].toLowerCase().replace(/^www\./, '') : null;
}

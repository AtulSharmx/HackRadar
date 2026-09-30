// Port of collector/match.py. Both must pass shared/match_cases.json, so the app and the alerts never disagree.
//
// Rules not spelled out in the TRD (same as the Python):
// - Unknown data never excludes an event (unknown fee passes fee_max), EXCEPT filters the user made
//   narrow on purpose: solo_only, paid_only and closing_within_days need a known value.
// - Fee: fee_max 0 = "Free" (drops events known to charge, even with no amount listed);
//   paid_only = "Paid" (only events known to charge). Neither = both.
// - closing_within_days counts calendar days in India, the same days the card's countdown shows.
// - Hybrid events can be joined online, so the distance filter doesn't apply to them.
// - Offline event with no coordinates (or no device location) fails max_km: we can't claim it's near.
import { daysLeft as calendarDaysLeft, inr } from './format';
import { haversineKm } from './geo';
import { THEME_NAMES } from './labels';

const W_THEME = 35;
const W_DISTANCE = 25;
const W_FEE = 15;
const W_URGENCY = 15;
const W_TRUST = 10;
const FEE_PARTIAL = 8;
const FEE_LIMIT = 500; // collector/config.py FEE_LIMIT
const URGENT_DAYS = [2, 10];
const SOON_DAYS = 30;
const TRUST_POINTS = { trusted_source: W_TRUST, check_details: 5, warning: 0 };

// device: { prefs, alert_filter, lat_rounded, lng_rounded } (a devices row shape)
export function filterOf(device) {
  if (device.alert_filter) return device.alert_filter;
  const p = device.prefs || {};
  return { themes: p.themes, modes: p.modes, fee_max: p.fee_max, max_km: p.max_km, exclude_warnings: p.hide_warnings ?? false };
}

export function distanceKm(event, device) {
  if (event.lat == null || device.lat_rounded == null) return null;
  return haversineKm(Number(device.lat_rounded), Number(device.lng_rounded), event.lat, event.lng);
}

export function daysLeft(event, now) {
  return event.registration_deadline ? (new Date(event.registration_deadline) - now) / 86400000 : null;
}

const overlap = (a, b) => (a || []).some((x) => (b || []).includes(x));

// true/false when known: a listed amount, else the source's own paid flag. null = unknown.
export function isPaid(event) {
  return event.fee_amount != null ? event.fee_amount > 0 : event.is_paid ?? null;
}

export function matches(event, device, now = new Date()) {
  const f = filterOf(device);
  const left = daysLeft(event, now);
  if ((event.status ?? 'open') !== 'open' || (left != null && left < 0)) return false;
  if (f.themes?.length && !overlap(f.themes, event.themes)) return false;
  if (f.modes?.length && event.mode && !f.modes.includes(event.mode)) return false;
  const fee = event.fee_amount;
  const paid = isPaid(event);
  if (f.fee_max != null && (fee != null ? fee > f.fee_max : paid === true && f.fee_max === 0)) return false;
  if (f.paid_only && paid !== true) return false;
  if (f.max_km != null && event.mode === 'offline') {
    const km = distanceKm(event, device);
    if (km == null || km > f.max_km) return false;
  }
  if (f.closing_within_days != null
    && (left == null || calendarDaysLeft(event.registration_deadline, now) > f.closing_within_days)) return false;
  if (f.solo_only && event.solo_allowed !== true) return false;
  if (f.exclude_warnings && event.trust_label === 'warning') return false;
  return true;
}

// [0-100 total, points per part]. Uses prefs, not the alert filter: this ranks the whole feed.
export function score(event, device, now = new Date()) {
  const prefs = device.prefs || {};
  const parts = {};
  parts.theme = overlap(prefs.themes, event.themes) ? W_THEME : 0;

  const maxKm = prefs.max_km || 50;
  if (event.mode === 'online' || event.mode === 'hybrid') {
    parts.distance = W_DISTANCE;
  } else {
    const km = distanceKm(event, device);
    if (km == null || km >= 2 * maxKm) parts.distance = 0;
    else if (km <= maxKm) parts.distance = W_DISTANCE;
    else parts.distance = (W_DISTANCE * (2 * maxKm - km)) / maxKm; // 25 at max_km down to 0 at 2x
  }

  const fee = event.fee_amount;
  parts.fee = fee === 0 ? W_FEE : fee != null && fee <= FEE_LIMIT ? FEE_PARTIAL : 0;

  const left = daysLeft(event, now);
  if (left != null && left >= URGENT_DAYS[0] && left <= URGENT_DAYS[1]) parts.urgency = W_URGENCY;
  else if (left != null && left > URGENT_DAYS[1] && left <= SOON_DAYS) parts.urgency = 8;
  else parts.urgency = 0;

  parts.trust = TRUST_POINTS[event.trust_label] ?? 0;
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return [Math.floor(total + 0.5), parts]; // half up, identical to the Python
}

// Top two human reasons, e.g. ["Matches AI/ML", "about 12 km away"]
export function reasons(event, device, parts, now = new Date()) {
  const order = [['theme', W_THEME], ['distance', W_DISTANCE], ['fee', W_FEE], ['urgency', W_URGENCY]];
  const ranked = order
    .map(([k, w], i) => [parts[k] / w, i, k])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]); // ties keep this order: theme first
  const out = [];
  for (const [share, , part] of ranked) {
    if (share <= 0 || out.length === 2) break;
    if (part === 'theme') {
      const hit = (device.prefs?.themes || []).filter((t) => (event.themes || []).includes(t)).sort();
      out.push('Matches ' + hit.slice(0, 2).map((t) => THEME_NAMES[t] || t).join(', '));
    } else if (part === 'distance') {
      const km = distanceKm(event, device);
      out.push(event.mode === 'online' ? 'Online'
        : event.mode === 'hybrid' ? 'Hybrid, can join online'
        : `about ${Math.round(km)} km away${event.location_approximate ? ' (approx.)' : ''}`);
    } else if (part === 'fee') {
      out.push(event.fee_amount === 0 ? 'Free' : `Fee ₹${inr(event.fee_amount)}`);
    } else if (part === 'urgency') {
      out.push(`Closes in ${Math.trunc(daysLeft(event, now) || 0)} days`);
    }
  }
  return out;
}

import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { dateShort, dateTime, daysLeft, timeShort } from './format';
import { usePrefs } from './prefs';
import { useSaved } from './saved';

// Local reminders for saved events (App Flow "Save and reminders"). The phone schedules them itself:
// no server, no internet needed when they fire, and they survive a reboot.
const HOUR = 3600000;
const IST = 330 * 60000;
const CHANNEL = 'deadlines';
// before a deadline: [key, hours before, words for the Saved toast]
export const SLOTS = [['7d', 168, '7 days'], ['48h', 48, '48 h'], ['24h', 24, '24 h']];

// t (ms) at an Indian clock time on the same IST day, shifted by `days`
function istAt(t, hour, days = 0) {
  const d = new Date(t + IST); // its UTC fields read as Indian time
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, 0, 0, 0);
  return d.getTime() - IST;
}

// Quiet hours 11 pm to 8 am: the reminder comes at 9 pm that evening instead (earlier, never later)
export function outsideQuiet(t) {
  const h = new Date(t + IST).getUTCHours();
  if (h >= 8 && h < 23) return t;
  return istAt(t, 21, h < 8 ? -1 : 0);
}

function closesIn(at, end) {
  const d = daysLeft(end, new Date(at));
  return d <= 0 ? 'closes today' : d === 1 ? 'closes tomorrow' : `closes in ${d} days`;
}

// "Sat, 10 Oct, 9:00 am · Gurugram" (no time when the source gave only a date)
function startLine(e) {
  const t = timeShort(e.start_date);
  const when = t === '12:00 am' ? dateShort(e.start_date) : `${dateShort(e.start_date)}, ${t}`;
  const where = e.mode === 'online' ? 'Online' : e.city;
  return `${when}${where ? ` · ${where}` : ''}. Tap to open.`;
}

// The reminders one saved entry should have: [{ id, key, at, eventId, title, body }]
// Interested: 7 days, 48 h and 24 h before the deadline. Registered: the evening before it starts.
export function planFor(eventId, entry, now = Date.now()) {
  const e = entry?.event;
  if (!e || e.status === 'stale') return [];
  const make = (key, at, title, body) => ({ id: `rem:${eventId}:${key}:${at}`, key, at, eventId, title, body });
  if (entry.status === 'registered') {
    if (!e.start_date) return [];
    const at = istAt(new Date(e.start_date).getTime(), 19, -1);
    return at > now ? [make('start', at, `${e.title} starts tomorrow`, startLine(e))] : [];
  }
  if (!e.registration_deadline || (e.status && e.status !== 'open')) return [];
  const end = new Date(e.registration_deadline).getTime();
  return SLOTS
    .map(([key, hours]) => [key, outsideQuiet(end - hours * HOUR)])
    .filter(([, at]) => at > now)
    .map(([key, at]) => make(key, at, `${e.title} ${closesIn(at, end)}`, `Registration ends ${dateTime(end)}. Tap to open.`));
}

// For the Saved toast: ['7 days', '48 h', '24 h'], only the ones still ahead
export function reminderWords(event, now = Date.now()) {
  const words = Object.fromEntries(SLOTS.map(([k, , w]) => [k, w]));
  return planFor(event.id, { status: 'interested', event }, now).map((p) => words[p.key]);
}

// What to cancel and what to add, given the scheduled ids and the wanted plan
export function diff(scheduledIds, wanted) {
  const want = new Set(wanted.map((w) => w.id));
  const have = new Set(scheduledIds);
  return { cancel: scheduledIds.filter((id) => !want.has(id)), add: wanted.filter((w) => !have.has(w.id)) };
}

// expo-notifications, only where it runs: an Android build (Expo Go dropped it, the web has none)
let N;
function native() {
  if (N !== undefined) return N;
  N = null;
  if (Platform.OS !== 'android' || Constants.executionEnvironment === 'storeClient') return N;
  try {
    N = require('expo-notifications');
    // while the app is open a reminder shows as a banner on top (App Flow)
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  } catch {
    N = null;
  }
  return N;
}

export const remindersWork = () => !!native();

async function apply(entries, enabled) {
  const n = native();
  if (!n) return;
  const now = Date.now();
  const wanted = enabled ? Object.entries(entries).flatMap(([id, e]) => planFor(id, e, now)) : [];
  const scheduled = (await n.getAllScheduledNotificationsAsync()).map((r) => r.identifier).filter((id) => id.startsWith('rem:'));
  const { cancel, add } = diff(scheduled, wanted);
  for (const id of cancel) await n.cancelScheduledNotificationAsync(id);
  if (add.length) await n.setNotificationChannelAsync(CHANNEL, { name: 'Deadlines', importance: n.AndroidImportance.HIGH });
  for (const w of add) {
    await n.scheduleNotificationAsync({
      identifier: w.id,
      content: { title: w.title, body: w.body, data: { eventId: w.eventId } },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: w.at, channelId: CHANNEL },
    });
  }
}

// one sync at a time, in order
let queue = Promise.resolve();
export function syncReminders(entries, enabled) {
  queue = queue.then(() => apply(entries, enabled)).catch(() => {});
  return queue;
}

// Mounted once inside the providers: keeps the phone's schedule equal to Saved (save, unsave, Registered,
// a deadline that moved, notifications switched off) and opens the event when a reminder is tapped.
export function useReminders() {
  const { entries } = useSaved();
  const { prefs } = usePrefs();
  const enabled = !!prefs?.notifications;
  useEffect(() => {
    const t = setTimeout(() => syncReminders(entries, enabled), 400);
    return () => clearTimeout(t);
  }, [entries, enabled]);

  useEffect(() => {
    const n = native();
    if (!n) return;
    let handled = null; // the cold-start tap can arrive both ways
    const open = (response) => {
      const req = response?.notification?.request;
      const id = req?.content?.data?.eventId;
      const key = `${req?.identifier}@${response?.notification?.date}`;
      if (!id || key === handled) return;
      handled = key;
      router.push(`/event/${id}`);
    };
    const last = n.getLastNotificationResponse();
    if (last) {
      n.clearLastNotificationResponse();
      open(last);
    }
    const sub = n.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}

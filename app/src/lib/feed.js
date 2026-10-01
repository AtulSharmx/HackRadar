// Feed data: incremental sync from Supabase (updated_at paging) + a local cache that shows instantly and offline.
// Cache lives in localStorage, which expo-sqlite installs (see lib/supabase.js).

const CACHE_KEY = 'hackradar.feed.v1';
const PAGE = 500;

export const emptyCache = { events: {}, lastSync: null, fetchedAt: null };

// The phone's copy is read from storage once and then kept in memory: it's a few hundred KB of JSON, and
// parsing it again on every event opened made opening a card feel slow.
let inMemory = null;

export function loadCache(storage = globalThis.localStorage) {
  const shared = storage === globalThis.localStorage;
  if (shared && inMemory) return inMemory;
  let cache = emptyCache;
  try {
    const raw = storage?.getItem(CACHE_KEY);
    if (raw) cache = { ...emptyCache, ...JSON.parse(raw) };
  } catch {
    cache = emptyCache; // a corrupt cache must never stop the app; the next sync rebuilds it
  }
  if (shared) inMemory = cache;
  return cache;
}

export function saveCache(cache, storage = globalThis.localStorage) {
  if (storage === globalThis.localStorage) inMemory = cache;
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full or unavailable: the feed still works from memory this session
  }
}

// Apply a batch of changed rows. Closed/stale rows leave the cache; lastSync = newest updated_at seen.
export function mergeRows(cache, rows, fetchedAt) {
  const events = { ...cache.events };
  let lastSync = cache.lastSync;
  for (const row of rows) {
    if (row.status === 'open') events[row.id] = row;
    else delete events[row.id];
    if (!lastSync || row.updated_at > lastSync) lastSync = row.updated_at;
  }
  return { events, lastSync, fetchedAt };
}

// What the feed shows: open, deadline not passed, closest deadline first, unknown deadlines last.
export function visibleEvents(cache, now = new Date()) {
  const iso = now.toISOString();
  return Object.values(cache.events)
    .filter((e) => e.status === 'open' && (!e.registration_deadline || e.registration_deadline >= iso))
    .sort((a, b) => {
      if (!a.registration_deadline) return b.registration_deadline ? 1 : a.title.localeCompare(b.title);
      if (!b.registration_deadline) return -1;
      return a.registration_deadline.localeCompare(b.registration_deadline) || a.title.localeCompare(b.title);
    });
}

// First sync: only open events. Later: every row changed since lastSync, so closures reach the phone too.
export async function syncEvents(supabase, cache, now = new Date()) {
  let next = cache;
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from('events').select('*');
    q = cache.lastSync ? q.gt('updated_at', cache.lastSync) : q.eq('status', 'open');
    // id breaks ties: the collector writes many rows with one timestamp, and paging over an unstable
    // order can skip or repeat rows between pages
    const { data, error } = await q.order('updated_at', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    next = mergeRows(next, data, now.toISOString());
    if (data.length < PAGE) return next;
  }
}

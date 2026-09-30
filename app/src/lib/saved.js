import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { loadCache } from './feed';
import { useSession } from './session';
import { supabase } from './supabase';

// Saved events. The phone is the source of truth for the UI (instant, offline); saved_events on the
// server follows. Each entry keeps an event snapshot, so a saved event that closes and leaves the feed
// still shows under "Past".
const KEY = 'hackradar.saved.v1';

// entries: { [eventId]: { status: 'interested'|'registered', saved_at, event } }
// pending:  { [eventId]: 'upsert:<n>' | 'delete:<n>' } changes not yet on the server; <n> is unique per change,
//           so a change made while a sync is running is never cleared by that sync
export const emptySaved = { entries: {}, pending: {} };

export function isPast(event, now = new Date()) {
  if (!event) return true;
  if (event.status && event.status !== 'open') return true;
  return !!event.registration_deadline && new Date(event.registration_deadline) < now;
}

const byDeadline = (a, b) => {
  const x = a.event?.registration_deadline;
  const y = b.event?.registration_deadline;
  if (!x) return y ? 1 : 0;
  if (!y) return -1;
  return x.localeCompare(y);
};
// Registered events sort by when they start (App Flow), falling back to the deadline
const byStart = (a, b) =>
  (a.event?.start_date || a.event?.registration_deadline || '9').localeCompare(b.event?.start_date || b.event?.registration_deadline || '9');

// { interested: [...], registered: [...], past: [...] }, each sorted for its section
export function sections(state, now = new Date()) {
  const all = Object.entries(state.entries).map(([id, e]) => ({ id, ...e }));
  const live = all.filter((e) => !isPast(e.event, now));
  return {
    interested: live.filter((e) => e.status === 'interested').sort(byDeadline),
    registered: live.filter((e) => e.status === 'registered').sort(byStart),
    past: all.filter((e) => isPast(e.event, now)).sort((a, b) => byDeadline(b, a)),
  };
}

// Fresh event data from the feed cache replaces old snapshots (deadline changes etc.)
export function refreshSnapshots(state, feedEvents) {
  let changed = false;
  const entries = { ...state.entries };
  for (const [id, e] of Object.entries(entries)) {
    const fresh = feedEvents[id];
    if (fresh && fresh.updated_at !== e.event?.updated_at) {
      entries[id] = { ...e, event: fresh };
      changed = true;
    }
  }
  return changed ? { ...state, entries } : state;
}

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...emptySaved, ...JSON.parse(raw) } : emptySaved;
  } catch {
    return emptySaved;
  }
}

function write(v) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(v));
  } catch {
    // keep working from memory
  }
}

const SavedContext = createContext(null);

export function useSaved() {
  return useContext(SavedContext);
}

export function SavedProvider({ children }) {
  const { user } = useSession();
  const [state, setState] = useState(() => refreshSnapshots(read(), loadCache().events));
  const stateRef = useRef(state);
  const busy = useRef(false);
  const counter = useRef(0);

  const commit = useCallback((next) => {
    stateRef.current = next;
    write(next);
    setState(next);
  }, []);

  // Push pending changes, pull anything saved on the server but missing here (e.g. after login on a new
  // phone), and refresh every saved event's copy, so one that closed or moved its deadline shows that.
  const sync = useCallback(async () => {
    if (!user || busy.current) return;
    busy.current = true;
    let again = false;
    try {
      const { entries, pending } = stateRef.current;
      const done = [];
      for (const [id, token] of Object.entries(pending)) {
        const e = entries[id];
        const { error } = token.startsWith('delete') || !e
          ? await supabase.from('saved_events').delete().eq('device_id', user.id).eq('event_id', id)
          : await supabase.from('saved_events').upsert(
            { device_id: user.id, event_id: id, status: e.status, saved_at: e.saved_at },
            { onConflict: 'device_id,event_id' },
          );
        if (!error || error.code === '23503') done.push(id); // 23503: event deleted on the server, nothing to keep
      }
      const { data: rows } = await supabase.from('saved_events').select('event_id,status,saved_at').eq('device_id', user.id);
      const seen = stateRef.current;
      const missing = (rows || []).filter((r) => !seen.entries[r.event_id] && !seen.pending[r.event_id]);
      const ids = [...new Set([...Object.keys(seen.entries), ...missing.map((r) => r.event_id)])];
      let events = {};
      if (ids.length) {
        const { data } = await supabase.from('events').select('*').in('id', ids);
        events = Object.fromEntries((data || []).map((e) => [e.id, e]));
      }
      // build on the latest state: a save or remove made while the requests ran must not be undone
      const cur = stateRef.current;
      const entries2 = { ...cur.entries };
      for (const r of missing) {
        if (!cur.entries[r.event_id] && !cur.pending[r.event_id]) {
          entries2[r.event_id] = { status: r.status, saved_at: r.saved_at, event: events[r.event_id] || null };
        }
      }
      const pending2 = { ...cur.pending };
      for (const id of done) if (pending2[id] === pending[id]) delete pending2[id];
      commit(refreshSnapshots({ entries: entries2, pending: pending2 }, events));
      // a change made while this ran is still pending: send it now, not at the next app open
      again = Object.entries(pending2).some(([id, token]) => pending[id] !== token);
    } catch {
      // offline: pending stays, next sync retries
    } finally {
      busy.current = false;
    }
    if (again) sync();
  }, [user, commit]);

  useEffect(() => {
    sync();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => sub.remove();
  }, [sync]);

  // signed in to an account that already existed: everything saved on this phone is uploaded to it
  // (the next sync also brings down what the account saved elsewhere)
  const owner = useRef(null);
  useEffect(() => {
    if (!user) return;
    if (owner.current && owner.current !== user.id) {
      const cur = stateRef.current;
      counter.current += 1;
      const pending = { ...cur.pending };
      for (const id of Object.keys(cur.entries)) pending[id] = `upsert:${Date.now()}.${counter.current}`;
      commit({ ...cur, pending });
    }
    owner.current = user.id;
  }, [user, commit]);

  const change = useCallback((id, entry) => {
    const cur = stateRef.current;
    const entries = { ...cur.entries };
    if (entry) entries[id] = entry;
    else delete entries[id];
    counter.current += 1;
    commit({ entries, pending: { ...cur.pending, [id]: `${entry ? 'upsert' : 'delete'}:${Date.now()}.${counter.current}` } });
    sync();
  }, [commit, sync]);

  const api = {
    entries: state.entries,
    isSaved: (id) => !!state.entries[id],
    statusOf: (id) => state.entries[id]?.status || null,
    save: (event, status = 'interested') =>
      change(event.id, { status, saved_at: stateRef.current.entries[event.id]?.saved_at || new Date().toISOString(), event }),
    setStatus: (id, status) => {
      const e = stateRef.current.entries[id];
      if (e) change(id, { ...e, status });
    },
    remove: (id) => {
      const before = stateRef.current.entries[id];
      change(id, null);
      return before; // for Undo
    },
    restore: (id, entry) => change(id, entry),
    // log out: the account keeps its saves on the server; this phone starts empty for the next guest
    clearLocal: () => commit(emptySaved),
    flush: sync, // send unsent changes now (before logging out)
    sections: (now) => sections(state, now),
  };
  return createElement(SavedContext.Provider, { value: api }, children);
}

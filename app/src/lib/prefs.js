import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';

import { useSession } from './session';
import { supabase } from './supabase';

// My preferences: saved on the phone first (instant, offline), then copied to my devices row.
const KEY = 'hackradar.prefs.v1';

export const DEFAULT_PREFS = {
  themes: [],
  modes: ['online', 'offline', 'hybrid'],
  fee_max: null, // null = any fee
  degree: null,
  year: null,
  max_km: 50, // null = anywhere
  hide_warnings: false,
  city: null,
  state: null,
  lat: null, // rounded to 2 decimals (~1 km); raw GPS is never stored (Backend Schema doc)
  lng: null,
  notifications: false,
};

export const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

// Phone prefs -> devices row. The alert filter starts equal to the onboarding answers (App Flow: Finish).
export function toDeviceRow(p) {
  return {
    prefs: {
      themes: p.themes, modes: p.modes, fee_max: p.fee_max, degree: p.degree,
      year: p.year, max_km: p.max_km, hide_warnings: p.hide_warnings,
    },
    alert_filter: {
      themes: p.themes, modes: p.modes, fee_max: p.fee_max, max_km: p.max_km,
      closing_within_days: null, solo_only: false, exclude_warnings: p.hide_warnings,
    },
    city: p.city,
    state: p.state,
    lat_rounded: round2(p.lat),
    lng_rounded: round2(p.lng),
    alerts_enabled: !!p.notifications,
  };
}

function read() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? JSON.parse(raw) : { prefs: null, dirty: false };
  } catch {
    return { prefs: null, dirty: false };
  }
}

function write(v) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(v));
  } catch {
    // keep going from memory
  }
}

const PrefsContext = createContext({ prefs: null, onboarded: false, save: () => {} });

export function usePrefs() {
  return useContext(PrefsContext);
}

export function PrefsProvider({ children }) {
  const { user } = useSession();
  const [state, setState] = useState(read);

  const push = useCallback(async (prefs) => {
    if (!user || !prefs) return false;
    const { error } = await supabase.from('devices').update(toDeviceRow(prefs)).eq('id', user.id);
    return !error;
  }, [user]);

  // Offline when saving? Retry as soon as we have a session again.
  useEffect(() => {
    if (!state.dirty || !user) return;
    push(state.prefs).then((ok) => {
      if (!ok) return;
      setState((s) => {
        const next = { ...s, dirty: false };
        write(next);
        return next;
      });
    });
  }, [state.dirty, state.prefs, user, push]);

  const save = useCallback((prefs) => {
    const next = { prefs: { ...DEFAULT_PREFS, ...prefs }, dirty: true };
    write(next);
    setState(next);
  }, []);

  return createElement(
    PrefsContext.Provider,
    { value: { prefs: state.prefs, onboarded: !!state.prefs, save } },
    children,
  );
}

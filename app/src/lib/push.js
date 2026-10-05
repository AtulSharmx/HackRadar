import Constants from 'expo-constants';
import { useEffect, useSyncExternalStore } from 'react';

import { usePrefs } from './prefs';
import { ensureChannels, notificationsModule } from './reminders';
import { useSession } from './session';
import { supabase } from './supabase';

// B3: this phone's Expo push token goes to push_tokens (through register_push_token), so the collector
// can send new-match and saved-change pushes. Runs after sign-in while new hackathon alerts are on.
//
// The outcome is kept in `status` so Profile can say what is really going on instead of a switch that
// looks on while nothing arrives (1 Oct: a restored account had alerts on but this phone never allowed
// notifications). state: idle | ok | blocked (Android permission not given) | error (with a message).
let status = { state: 'idle', message: null };
const listeners = new Set();
const setStatus = (s) => {
  status = s;
  listeners.forEach((l) => l());
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const usePushStatus = () => useSyncExternalStore(subscribe, () => status);

let registered = null; // "<user>|<token>" done this app session

const reason = (e) => `${e?.code ? `${e.code}: ` : ''}${e?.message || e}`.slice(0, 200);

export async function registerPush(userId) {
  const n = notificationsModule();
  if (!n || !userId) return false; // Expo Go, web: no push here
  const { status: permission } = await n.getPermissionsAsync();
  if (permission !== 'granted') {
    setStatus({ state: 'blocked', message: null });
    return false;
  }
  let token;
  try {
    await ensureChannels(n);
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    token = (await n.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    setStatus({ state: 'error', message: `This phone couldn't get a push address (${reason(e)}).` });
    return false;
  }
  if (registered !== `${userId}|${token}`) {
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: 'android' });
    if (error) {
      setStatus({ state: 'error', message: `Couldn't save this phone for alerts (${reason(error)}).` });
      return false;
    }
    registered = `${userId}|${token}`;
  }
  setStatus({ state: 'ok', message: null });
  return true;
}

export function usePushRegistration() {
  const { user } = useSession();
  const { prefs } = usePrefs();
  const on = !!(prefs?.match_alerts ?? prefs?.notifications);
  useEffect(() => {
    // the device row is written by prefs right after this; register_push_token creates it if needed
    if (on && user) registerPush(user.id).catch((e) => setStatus({ state: 'error', message: reason(e) }));
    else setStatus({ state: 'idle', message: null });
  }, [on, user]);
}

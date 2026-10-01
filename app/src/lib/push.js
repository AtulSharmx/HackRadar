import Constants from 'expo-constants';
import { useEffect } from 'react';

import { usePrefs } from './prefs';
import { ensureChannels, notificationsModule } from './reminders';
import { useSession } from './session';
import { supabase } from './supabase';

// B3: this phone's Expo push token goes to push_tokens (through register_push_token), so the collector
// can send new-match and saved-change pushes. Runs after sign-in while new hackathon alerts are on.
// Without Firebase in the build (or in Expo Go / on the web) getting a token fails, quietly.
let registered = null; // "<user>|<token>" done this app session

export async function registerPush(userId) {
  const n = notificationsModule();
  if (!n || !userId) return false;
  const { status } = await n.getPermissionsAsync();
  if (status !== 'granted') return false;
  await ensureChannels(n);
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await n.getExpoPushTokenAsync({ projectId })).data;
  if (registered === `${userId}|${token}`) return true;
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: 'android' });
  if (error) return false;
  registered = `${userId}|${token}`;
  return true;
}

export function usePushRegistration() {
  const { user } = useSession();
  const { prefs } = usePrefs();
  const on = !!(prefs?.match_alerts ?? prefs?.notifications);
  useEffect(() => {
    // the device row is written by prefs right after this; register_push_token creates it if needed
    if (on && user) registerPush(user.id).catch(() => {});
  }, [on, user]);
}

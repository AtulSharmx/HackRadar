// Supabase client, per Expo's guide (docs.expo.dev/guides/using-supabase, SDK 57):
// expo-sqlite provides localStorage so the guest session survives app restarts.
import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// Public values from app/.env.local. Row-level security is what protects data, not these.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no URL to read a session from on Android
  },
});

// Only refresh tokens while the app is in the foreground
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

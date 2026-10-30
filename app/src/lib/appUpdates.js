import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useToast } from '../components/Toast';

// EAS Update (release builds only): a new version downloads in the background; this says so and offers
// a restart instead of waiting for the next cold start. Also checks when the app comes back to the
// front, so an app that stays in memory for days still gets updates.
export function useAppUpdates() {
  const toast = useToast();
  const { isUpdatePending } = Updates.useUpdates();
  const told = useRef(false);

  useEffect(() => {
    if (!Updates.isEnabled) return undefined; // dev server, Expo Go, web
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      Updates.checkForUpdateAsync()
        .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch(() => {}); // offline or a check already running: the next launch checks again
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isUpdatePending || told.current) return;
    told.current = true;
    toast('A new version of HackRadar is ready.', {
      action: { label: 'Restart', onPress: () => Updates.reloadAsync().catch(() => {}) },
      duration: 10000,
    });
  }, [isUpdatePending, toast]);
}

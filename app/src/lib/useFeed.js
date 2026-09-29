import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { loadCache, saveCache, syncEvents, visibleEvents } from './feed';
import { useSession } from './session';
import { supabase } from './supabase';

// Cached events show instantly; a sync runs once the guest session is ready, on every return to the
// foreground, and on pull to refresh. Only one sync at a time.
export function useFeed() {
  const { user, error: sessionError } = useSession();
  const [cache, setCache] = useState(loadCache);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const cacheRef = useRef(cache);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const next = await syncEvents(supabase, cacheRef.current);
      cacheRef.current = next;
      saveCache(next);
      setCache(next);
      setSyncError(null);
    } catch (e) {
      setSyncError(e);
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  const events = useMemo(() => visibleEvents(cache), [cache]);
  return {
    events,
    fetchedAt: cache.fetchedAt,
    hasCache: cache.fetchedAt != null,
    syncing,
    // not signed in yet because we're offline counts as a failed sync too
    error: syncError || (!user && sessionError) || null,
    refresh,
  };
}

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from './supabase';

// Guest first (docs/auth-plan.md): a silent anonymous sign-in gives a real user id,
// and devices.id = that user id. Google / email linking comes later and keeps the same id.
export async function ensureGuest() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let user = session?.user;
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    user = data.user;
  }
  // RLS lets a user insert only the row whose id is their own; existing row is left untouched
  const { error } = await supabase.from('devices').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  return user;
}

const SessionContext = createContext({ user: null, error: null, retry: () => {} });

export function useSession() {
  return useContext(SessionContext);
}

// Never blocks the UI: cached content can show while this runs; failures retry when the app comes back.
export function SessionProvider({ children }) {
  const [state, setState] = useState({ user: null, error: null });
  const ready = useRef(false);

  const retry = useCallback(() => {
    ensureGuest()
      .then((user) => {
        ready.current = true;
        setState({ user, error: null });
      })
      .catch((error) => setState((s) => ({ ...s, error })));
  }, []);

  useEffect(() => {
    retry();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && !ready.current) retry();
    });
    return () => sub.remove();
  }, [retry]);

  return createElement(SessionContext.Provider, { value: { ...state, retry } }, children);
}

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from './supabase';

// Guest first (docs/auth-plan.md): a silent anonymous sign-in gives a real user id, and devices.id = that id.
// Signing in with an email code (lib/account.js) keeps that id when the email is new, so nothing moves.

// RLS lets a user insert only the row whose id is their own; an existing row is left untouched
async function ensureDevice(user) {
  const { error } = await supabase.from('devices').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  return user;
}

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
  return ensureDevice(user);
}

const SessionContext = createContext({ user: null, error: null, retry: () => {}, isGuest: true, email: null });

export function useSession() {
  return useContext(SessionContext);
}

const sameUser = (a, b) => a?.id === b?.id && a?.email === b?.email && a?.phone === b?.phone
  && a?.is_anonymous === b?.is_anonymous && (a?.identities?.length ?? 0) === (b?.identities?.length ?? 0);

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
    // follow the account that is really signed in: email sign-in, email confirmed on the guest, log out
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      // supabase-js: no awaited supabase calls inside this callback, so the follow-up work is deferred
      setTimeout(() => {
        if (event === 'SIGNED_OUT') {
          ready.current = false;
          setState({ user: null, error: null });
          retry(); // back to a fresh guest
          return;
        }
        const user = session?.user;
        if (!user || !['SIGNED_IN', 'USER_UPDATED'].includes(event)) return;
        setState((s) => (sameUser(s.user, user) ? s : { user, error: null }));
        ensureDevice(user).catch(() => {});
      }, 0);
    });
    return () => {
      sub.remove();
      auth.subscription.unsubscribe();
    };
  }, [retry]);

  const meta = state.user?.user_metadata || {};
  const value = {
    ...state,
    retry,
    isGuest: state.user ? !!state.user.is_anonymous : true,
    email: state.user?.email || null,
    phone: state.user?.phone ? `+${state.user.phone}` : null,
    name: meta.full_name || meta.name || meta.user_name || null, // from Google or GitHub
    avatar: meta.avatar_url || meta.picture || null,
  };
  return createElement(SessionContext.Provider, { value }, children);
}

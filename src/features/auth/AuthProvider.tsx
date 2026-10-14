import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { savedSession, supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** True until the saved session has been read from the phone. */
  initializing: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, initializing: false });

/** How long to wait for Supabase to renew an old sign-in before opening on the saved one. */
export const OPEN_SAVED_AFTER_MS = 2500;

/** Keeps the Supabase session in React state and follows sign-in / sign-out events. */
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let openedOnSaved = false;
    const settle = (next: Session | null) => {
      if (!active) return;
      setSession(next);
      setInitializing(false);
    };
    // A sign-in more than an hour old needs renewing, and with no connection Supabase keeps
    // trying for up to half a minute. Don't hold the app behind the splash screen for that:
    // open on the saved sign-in (and saved data) while it carries on.
    const wait = setTimeout(() => {
      const saved = savedSession();
      if (!saved) return;
      openedOnSaved = true;
      settle(saved);
    }, OPEN_SAVED_AFTER_MS);
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        // Offline, Supabase can't renew it and says there's no session; keep the saved one.
        if (data.session) settle(data.session);
        else if (!isAuthRetryableFetchError(error)) settle(null);
        else if (!openedOnSaved) settle(savedSession());
      })
      .catch(() => {
        if (!openedOnSaved) settle(savedSession());
      })
      .finally(() => clearTimeout(wait));
    // The first reading is getSession's above, which also covers being offline.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event !== 'INITIAL_SESSION') setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, initializing }), [session, initializing]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

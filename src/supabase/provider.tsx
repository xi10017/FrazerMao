'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './client';
import { toAppUser, type AppUser } from './types';

type SupabaseContextValue = {
  supabase: SupabaseClient;
  auth: SupabaseClient['auth'];
  user: AppUser | null;
  isAdmin: boolean;
  isUserLoading: boolean;
  userError: Error | null;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(
  undefined
);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    const applyUser = (nextUser: AppUser | null) => {
      setUser(previous => {
        // Supabase can emit SIGNED_IN again on tab focus. Preserve the user
        // reference so account-dependent effects do not restart the arena.
        if (previous?.id === nextUser?.id &&
            previous?.email === nextUser?.email &&
            JSON.stringify(previous?.user_metadata) === JSON.stringify(nextUser?.user_metadata)) {
          return previous;
        }
        return nextUser;
      });
      setIsUserLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      authEventReceived = true;
      setUserError(null);
      applyUser(toAppUser(session?.user ?? null));
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      // A newer auth event takes precedence over this initial request.
      if (!active || authEventReceived) return;
      if (error && error.code !== 'auth_session_missing') setUserError(error);
      applyUser(toAppUser(data.user));
    }).catch((error: unknown) => {
      if (!active || authEventReceived) return;
      setUserError(error instanceof Error ? error : new Error(String(error)));
      setIsUserLoading(false);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  // Database requests run outside the auth callback and only when account
  // identity/profile data changes, rather than on every session refresh.
  useEffect(() => {
    let active = true;
    setIsAdmin(false);
    if (!user) return;

    void supabase.from('profiles').upsert({
      id: user.uid,
      display_name: user.displayName || 'Anonymous User',
      email: user.email,
      photo_url: user.photoURL,
    });
    void supabase.from('admins').select('user_id').eq('user_id', user.uid)
      .maybeSingle().then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('Failed to load Supabase admin status:', error);
        setIsAdmin(!error && Boolean(data));
      });

    return () => { active = false; };
  }, [user]);

  const value = useMemo(
    () => ({
      supabase,
      auth: supabase.auth,
      user,
      isAdmin,
      isUserLoading,
      userError,
    }),
    [user, isAdmin, isUserLoading, userError]
  );

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider.');
  }
  return context;
}

/** Compatibility name used while the Firebase data modules are being ported. */
export const useFirebase = useSupabase;
export const useAuth = () => useSupabase().auth;
export const useFirestore = () => useSupabase().supabase;
export const useUser = () => {
  const { user, isAdmin, isUserLoading, userError } = useSupabase();
  return { user, isAdmin, isUserLoading, userError };
};

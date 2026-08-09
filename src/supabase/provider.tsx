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
  isUserLoading: boolean;
  userError: Error | null;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(
  undefined
);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  const syncProfile = (nextUser: AppUser | null) => {
    if (!nextUser) return;
    void supabase.from('profiles').upsert({
      id: nextUser.uid,
      display_name: nextUser.displayName || 'Anonymous User',
      email: nextUser.email,
      photo_url: nextUser.photoURL,
    });
  };

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!active) return;
        if (error && error.code !== 'auth_session_missing') {
          setUserError(error);
        }
        const nextUser = toAppUser(data.user);
        setUser(nextUser);
        syncProfile(nextUser);
        setIsUserLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setUserError(error instanceof Error ? error : new Error(String(error)));
        setIsUserLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = toAppUser(session?.user ?? null);
      setUser(nextUser);
      syncProfile(nextUser);
      setIsUserLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      supabase,
      auth: supabase.auth,
      user,
      isUserLoading,
      userError,
    }),
    [user, isUserLoading, userError]
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
  const { user, isUserLoading, userError } = useSupabase();
  return { user, isUserLoading, userError };
};

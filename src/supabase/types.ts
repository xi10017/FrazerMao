import type { User as SupabaseUser } from '@supabase/supabase-js';

/** User shape consumed by the existing MuPractice UI and data modules. */
export type AppUser = SupabaseUser & {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
};

export function toAppUser(user: SupabaseUser | null): AppUser | null {
  if (!user) return null;
  return Object.assign(user, {
    uid: user.id,
    displayName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split('@')[0] ??
      null,
    photoURL:
      (user.user_metadata?.avatar_url as string | undefined) ??
      (user.user_metadata?.picture as string | undefined) ??
      null,
  });
}

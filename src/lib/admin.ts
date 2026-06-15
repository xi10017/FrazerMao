/** Comma-separated Firebase Auth UIDs with admin access (client UI gating). */
export function getAdminUids(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_UIDS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminUid(uid: string | undefined | null): boolean {
  if (!uid) return false;
  return getAdminUids().includes(uid);
}

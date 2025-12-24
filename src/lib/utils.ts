import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates initials from a name string for use in avatars.
 * @param name The full name string.
 * @returns A 1 or 2 character string of initials, or '?' if no name is provided.
 */
export function getInitials(name?: string | null) {
  if (!name) return '?';
  const names = name.split(' ');
  const initials = names.map((n) => n[0]).join('');
  return initials.length > 2 ? initials.substring(0, 2) : initials;
}

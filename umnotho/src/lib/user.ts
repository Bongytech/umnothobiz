import type { User } from 'firebase/auth';

/**
 * A display name that is safe for Firestore rules (max 60 characters) and
 * always has a sensible fallback when Google does not provide a name.
 */
export function displayNameFor(user: Pick<User, 'displayName' | 'email'> | null | undefined): string {
  const name = user?.displayName?.trim() || user?.email?.split('@')[0]?.trim() || 'Trader';
  return name.slice(0, 60);
}

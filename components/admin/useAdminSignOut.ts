'use client';

import { getAuth, signOut } from 'firebase/auth';

import { getFirebaseApp } from '@/lib/firebase';

/**
 * Sign-out flow lifted unchanged from the old AdminNav, now used by AdminPill: the server-side cookie clear must run
 * even if the Firebase client call throws, so it is try/finally, not a bare sequential await.
 */
export async function signOutAdmin(): Promise<void> {
  try {
    await signOut(getAuth(getFirebaseApp()));
  } catch (error) {
    console.error('Admin sign-out: Firebase signOut() failed', {
      operation: 'admin sign-out',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
  } finally {
    await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => undefined);
  }
}

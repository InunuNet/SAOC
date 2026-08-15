'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';

import { getFirebaseApp } from '@/lib/firebase';
import { GoogleSignInButton } from './GoogleSignInButton';

const SESSION_ERROR_MESSAGE = 'Session creation failed';
const GENERIC_SIGN_IN_ERROR = 'Sign-in failed. Please try again.';

/**
 * The one function both the password path and the Google path converge on — takes an
 * idToken and POSTs it to the existing /api/admin/session route. No second, parallel
 * session-mint path (see F4 A-STRUCT-02). The gate's reason for a 403 stays server-side
 * (see docs/admin-access.md "Reading the reason field") — the browser only ever learns
 * that sign-in failed.
 */
async function mintSession(idToken: string): Promise<void> {
  const response = await fetch('/api/admin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error(SESSION_ERROR_MESSAGE);
  }
}

function googleSignInErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled before it completed. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Please allow popups for this site and try again.';
    case 'auth/admin-restricted-operation':
      return 'This sign-in method is restricted for this account. Contact an administrator.';
    default:
      return GENERIC_SIGN_IN_ERROR;
  }
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const auth = getAuth(getFirebaseApp());
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      await mintSession(idToken);
      router.push('/admin');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : GENERIC_SIGN_IN_ERROR;
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setGoogleLoading(true);

    try {
      const auth = getAuth(getFirebaseApp());
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const idToken = await userCredential.user.getIdToken();
      await mintSession(idToken);
      router.push('/admin');
    } catch (err: unknown) {
      setError(googleSignInErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  const disabled = loading || googleLoading;

  return (
    <main style={{ maxWidth: '400px', margin: '4rem auto', fontFamily: 'sans-serif' }}>
      <h1>Admin Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={disabled}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password">Password</label>
          <br />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={disabled}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {error && (
          <p role="alert" style={{ color: 'red' }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={disabled} style={{ padding: '0.5rem 1.5rem' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <GoogleSignInButton onClick={handleGoogleSignIn} disabled={disabled} loading={googleLoading} />
    </main>
  );
}

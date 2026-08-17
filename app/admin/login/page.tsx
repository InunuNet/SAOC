'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  type AuthProvider,
} from 'firebase/auth';

import { getFirebaseApp } from '@/lib/firebase';
import { FederatedSignInButtons } from './FederatedSignInButtons';
import { LoginFormFields } from './LoginFormFields';

const SESSION_ERROR_MESSAGE = 'Session creation failed';
const GENERIC_SIGN_IN_ERROR = 'Sign-in failed. Please try again.';

export type FederatedProviderId = 'google.com' | 'microsoft.com' | 'apple.com';

/**
 * The one function every sign-in path converges on — POSTs an idToken to the existing
 * /api/admin/session route. No second, parallel session-mint path (F4 A-STRUCT-02 / F5
 * A-STRUCT-01). The refusal reason stays server-side (docs/admin-access.md).
 */
async function mintSession(idToken: string): Promise<void> {
  const response = await fetch('/api/admin/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    // Status only — the body may carry the gate's refusal reason; keep it server-side.
    console.error('mintSession failed', { status: response.status });
    throw new Error(SESSION_ERROR_MESSAGE);
  }
}

function firebaseErrorCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

/**
 * This file intentionally exceeds the project's 150-line component cap. Below this point
 * are module-level auth helpers, not JSX — `contracts/checks/admin-auth-f5-federated/
 * check-login-microsoft-apple-structural.sh` (A-STRUCT-01) greps THIS FILE specifically for
 * the OAuthProvider literals and the /api/admin/session call; moving them into an imported
 * helper module would let the check pass against an import that is never actually invoked
 * on the sign-in path, which is exactly the failure the file-scoped grep exists to catch. A
 * strong assertion beats a tidy line count here. Decided 2026-08-17, orchestrator.
 *
 * Explicit literal branch per provider — not a parametrised `new OAuthProvider(id)` — so
 * each provider's requirements (Apple's explicit scopes) stay grep-able in source (F5
 * A-STRUCT-01).
 */
function createFederatedProvider(id: FederatedProviderId): AuthProvider {
  switch (id) {
    case 'google.com':
      return new GoogleAuthProvider();
    case 'microsoft.com':
      return new OAuthProvider('microsoft.com');
    case 'apple.com': {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      return provider;
    }
  }
}

function federatedSignInErrorMessage(err: unknown): string {
  switch (firebaseErrorCode(err)) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled before it completed. Please try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Please allow popups for this site and try again.';
    case 'auth/admin-restricted-operation':
      return 'This sign-in method is restricted for this account. Contact an administrator.';
    case 'auth/unauthorized-domain':
      return "This site's domain is not authorised in Firebase Auth settings. An administrator must add it.";
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists for this email with a different sign-in method.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for this project. Contact an administrator.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in attempt is already in progress.';
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
  const [federatedLoading, setFederatedLoading] = useState<FederatedProviderId | null>(null);

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
      console.error('Password sign-in failed', { code: firebaseErrorCode(err), error: err });
      const message = err instanceof Error ? err.message : GENERIC_SIGN_IN_ERROR;
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFederatedSignIn(id: FederatedProviderId) {
    setError('');
    setFederatedLoading(id);

    try {
      const auth = getAuth(getFirebaseApp());
      const provider = createFederatedProvider(id);
      const userCredential = await signInWithPopup(auth, provider);
      const idToken = await userCredential.user.getIdToken();
      await mintSession(idToken);
      router.push('/admin');
    } catch (err: unknown) {
      const code = firebaseErrorCode(err);
      console.error('Federated sign-in failed', { provider: id, code, error: err });
      setError(federatedSignInErrorMessage(err));
    } finally {
      setFederatedLoading(null);
    }
  }

  const disabled = loading || federatedLoading !== null;

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-parchment px-4 py-16">
      <div className="w-full max-w-[400px] border border-rule bg-ivory p-8">
        <span className="eyebrow">Admin</span>
        <h1 className="mt-4 font-serif text-[28px] font-semibold leading-tight text-ink">
          Sign in
        </h1>

        <LoginFormFields
          email={email}
          onEmailChange={setEmail}
          password={password}
          onPasswordChange={setPassword}
          error={error}
          disabled={disabled}
          loading={loading}
          onSubmit={handleSubmit}
        />

        <FederatedSignInButtons
          onSignIn={handleFederatedSignIn}
          disabled={disabled}
          federatedLoading={federatedLoading}
        />
      </div>
    </div>
  );
}

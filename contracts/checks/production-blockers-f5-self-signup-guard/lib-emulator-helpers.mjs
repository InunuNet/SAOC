// Shared helpers for the F5 self-signup-guard emulator checks. Never touches the real
// saoc-webapp project — every check that imports this runs under
// `firebase emulators:exec --project demo-saoc-webapp`, and `demo-` project IDs are Firebase's
// documented convention for emulator-only projects that need no real credentials.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const GRACE_WINDOW_MS = 90_000;
export const MARGIN_MS = 30_000;
export const POLL_INTERVAL_MS = 3_000;

export function initEmulatorAdmin() {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      'FIREBASE_AUTH_EMULATOR_HOST is not set — this script must run under ' +
        '`firebase emulators:exec --only auth,functions`, never directly.',
    );
  }
  return initializeApp({ projectId: 'demo-saoc-webapp' });
}

/** Fixture email — never a real address, never allowlisted, never reused outside this check. */
export function fixtureEmail(label) {
  return `f5-fixture-${label}-${Date.now()}@example-fixture.invalid`;
}

const AUTH_EMULATOR_ORIGIN = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'localhost:9099'}`;

/** Mimics client-side accounts:signUp — a bare password account, no custom claim ever set. */
export async function signUpViaRestApi(email, password) {
  const res = await fetch(
    `${AUTH_EMULATOR_ORIGIN}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`signUp REST call failed: ${JSON.stringify(body)}`);
  }
  return body.localId;
}

/** Unconditional cleanup — never throws, safe to call in a finally block on any outcome. */
export async function safeDeleteUser(auth, uid) {
  if (!uid) return;
  try {
    await auth.deleteUser(uid);
  } catch {
    // Already gone (the deletion under test) or never existed — not an error for cleanup.
  }
}

export async function pollUntil(predicateAsync, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await predicateAsync();
    if (result !== undefined) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return undefined;
}

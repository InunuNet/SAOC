// Shared harness for the door-admission checks (A1–A4).
//
// These call lib/checkin.ts DIRECTLY rather than through POST /api/admin/checkin.
// Reason, verified 2026-08-11 against the real project: Firebase Auth is not
// provisioned on `saoc-webapp` — getAuth().listUsers() and createUser() both fail with
// `auth/configuration-not-found` — so no ID token and therefore no admin session cookie
// can be minted by anything, including the /admin login page. The decision path, the
// Firestore transaction and the persisted result are all exercised for real here; only
// the cookie-parsing layer is skipped, and that layer is covered separately by
// check-checkin-requires-auth.mjs (unauthenticated HTTP, needs no credentials).
//
// Every ticket created carries the sentinel email marker, and every check runs inside
// withCleanup() so the sweep happens whether the body passes, fails or throws.

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

// Imported lazily so dotenv runs before firebase-admin reads credentials.
export async function loadCheckin() {
  let mod;
  try {
    mod = await import('@/lib/checkin');
  } catch (error) {
    throw new Error(
      `lib/checkin.ts could not be imported (${(error as Error).message}). The door-admission logic must be extracted into lib/checkin.ts — see contracts/golden/ticketing-hardening/checkin-admission-rules.golden.md`
    );
  }
  if (typeof mod.checkInByBookingRef !== 'function') {
    throw new Error(
      'lib/checkin.ts does not export checkInByBookingRef — see contracts/golden/ticketing-hardening/checkin-admission-rules.golden.md'
    );
  }
  return mod;
}

export async function shared() {
  return import('./_shared.mjs');
}

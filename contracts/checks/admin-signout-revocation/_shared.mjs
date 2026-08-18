// admin-signout-revocation — shared helpers, owned exclusively by this contract.
//
// Deliberately thin: reuses contracts/checks/admin-auth-hardening/_shared.mjs and
// server-ctl.sh wholesale (fixture provisioning, session minting, the isolated
// port-3400 production build/server) rather than reinventing them — see that file's
// own header comment for why the isolated build exists and why node_modules is not
// rsync'd. This file adds only what admin-auth-hardening's _shared.mjs does not
// already provide: a client for the DELETE /api/admin/session sign-out endpoint this
// contract is about, in both its authenticated and unauthenticated/malformed forms.
//
// admin-auth-hardening's _shared.mjs is marked "owned exclusively by this contract" in
// its own header — this file does not edit it, only imports from it.

export {
  BASE_URL,
  ALLOWLISTED_FIXTURE_EMAIL,
  createAllowlistedFixtureUser,
  deleteAllowlistedFixtureUser,
  mintIdTokenForUid,
  setCustomClaims,
  setEmailVerified,
  revokeSessions,
  postSession,
  getAdminPage,
  getTicketsApi,
  getDoorPage,
  warmUp,
  runCheck,
  randomProbeEmail,
  PreconditionError,
} from '../admin-auth-hardening/_shared.mjs';

import { BASE_URL as BASE } from '../admin-auth-hardening/_shared.mjs';

// Calls DELETE /api/admin/session — the sign-out endpoint under test. `cookie` may be
// null (no session presented at all, the "already signed out" / no-cookie case) or any
// string (a real cookie, an expired one, or deliberately malformed garbage) — the
// contract's design constraint #1 requires the endpoint to respond 200 and clear the
// cookie in every one of those cases, never just the happy path.
//
// `body` lets a check attempt the crafted-uid attack (design constraint #2): passing a
// JSON body or query string naming a DIFFERENT uid than the one the cookie resolves to,
// to prove the endpoint ignores client-supplied identity entirely.
export async function deleteSession(cookie, { baseUrl = BASE, body, query } = {}) {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const res = await fetch(`${baseUrl}/api/admin/session${qs}`, {
    method: 'DELETE',
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie');
  // A clearing Set-Cookie header is one whose Max-Age is 0 (or an Expires in the past)
  // — parsed here rather than left to each check to reimplement, since "did it actually
  // clear the cookie" (not just "was some Set-Cookie header present") is the property
  // that matters. maxAge=0 is what the existing POST/DELETE handlers both use.
  const clearsCookie = Boolean(setCookie) && /max-age=0/i.test(setCookie);
  return { status: res.status, setCookie, clearsCookie };
}

// ---------------------------------------------------------------------------
// Admin SDK — a SECOND, independent revocation observable beyond "does the cookie
// still work". check-signout-replay-cannot-rerevoke.mjs needs to distinguish "DELETE
// returned 200 AND actually revoked again" from "DELETE returned 200 but revocation was
// correctly skipped" — both look identical from the HTTP response alone (constraint #1
// requires 200 either way). Firebase Admin SDK's getUser(uid).tokensValidAfterTime is
// the ground truth: it changes on every real revokeRefreshTokens(uid) call and only
// then, so comparing it before/after a replayed DELETE is the only way to observe the
// difference. A fresh, separately-named Admin app is used here (rather than importing
// admin-auth-hardening's private getAdminAuth(), which that file does not export) so
// this contract's env/credential wiring stays fully self-contained, matching the
// "owned exclusively by this contract" convention _shared.mjs files in this repo use.
// ---------------------------------------------------------------------------

let adminAppPromise;

async function getAdminAuth() {
  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const projectId = mustEnv('FIREBASE_ADMIN_PROJECT_ID');
      const clientEmail = mustEnv('FIREBASE_ADMIN_CLIENT_EMAIL');
      const privateKey = mustEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n');
      const app =
        getApps().find((a) => a.name === 'admin-signout-revocation-check') ??
        initializeApp(
          { credential: cert({ projectId, clientEmail, privateKey }) },
          'admin-signout-revocation-check',
        );
      return getAuth(app);
    })();
  }
  return adminAppPromise;
}

function mustEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FAIL: ${key} is not set in .env.local — this check cannot run without it.`);
  }
  return value;
}

// Returns the uid's current tokensValidAfterTime as a string (or null if the user has
// never been revoked). Two calls returning the SAME value means no revocation happened
// between them; different values means a revoke DID happen between them — this is the
// only way to tell "sign-out returned 200 and did nothing" apart from "sign-out
// returned 200 and revoked again" purely from the HTTP surface.
export async function getTokensValidAfterTime(uid) {
  const auth = await getAdminAuth();
  const user = await auth.getUser(uid);
  return user.tokensValidAfterTime ?? null;
}

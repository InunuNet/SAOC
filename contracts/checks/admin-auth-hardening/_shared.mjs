// admin-auth-hardening — shared helpers, owned exclusively by this contract.
//
// TARGET: http://127.0.0.1:3400 — a LOCALLY BUILT PRODUCTION server (`pnpm build &&
// PORT=3400 pnpm start`), plain HTTP, no TLS. Retargeted 2026-08-14 away from
// `https://dev.saoc.co.za:3333` (`pnpm dev:secure`), which was independently fatal two
// ways, both measured: (a) dev-mode first-hit compilation made simple requests take
// 75-120s, blowing through every check's timeout_seconds mid-run; (b) Node's fetch
// cannot complete a TLS handshake against it at all (UND_ERR_CONNECT_TIMEOUT) because
// the mkcert-issued cert is not in Node's trust store, even though `curl -k` succeeds.
// Port 3400 collides with neither `dev` (3002) nor `dev:secure` (3333) — see
// package.json. A production build compiles every route ahead of time, so there is no
// per-route first-hit compilation tax even without the warm-up phase below; the
// warm-up exists to absorb connection setup and any late compilation, not JIT compile.
// Override with ADMIN_AUTH_CHECK_BASE_URL if a different server is under test.
//
// Every check in this contract does real network I/O: real accounts:signUp against
// Identity Platform, real HTTP against the app server, real Admin SDK calls. Nothing
// here is a source grep pretending to be a behavioural proof — see
// contracts/golden/admin-auth-hardening/README.md for why that distinction matters on
// this project specifically.

import { config as loadDotenv } from 'dotenv';

// FIREBASE_ADMIN_PRIVATE_KEY is a real multi-line PEM inside a quoted .env.local value
// (confirmed 2026-08-14: it spans multiple physical lines, not a single line with
// literal \n escapes). A hand-rolled line-by-line parser splits it apart and
// Admin SDK's cert() then throws "Failed to parse private key" - measured directly.
// dotenv's own parser handles multi-line quoted values correctly, so it is used here
// exactly as contracts/checks/ticketing-hardening/_shared.mjs already does.
loadDotenv({ path: new URL('../../../.env.local', import.meta.url).pathname, quiet: true });

export const BASE_URL = process.env.ADMIN_AUTH_CHECK_BASE_URL ?? 'http://127.0.0.1:3400';

// The email a check must find ALREADY on the running server's ADMIN_EMAIL_ALLOWLIST in
// order to exercise the "allowlisted identity succeeds" checks. Documented precondition
// (README.md "Fixture accounts") — the check cannot set this itself, because the
// allowlist is read from the server PROCESS's env, which this script does not share.
export const ALLOWLISTED_FIXTURE_EMAIL =
  process.env.ADMIN_AUTH_CHECK_ALLOWLISTED_EMAIL ?? 'admin-auth-check-allowlisted@saoc.co.za';

// ---------------------------------------------------------------------------
// Env — loaded once, above, via dotenv's own parser (which correctly handles
// FIREBASE_ADMIN_PRIVATE_KEY's multi-line quoted PEM value; a hand-rolled line-by-line
// parser tried here first and silently truncated it — Admin SDK's cert() then throws
// "Failed to parse private key", measured directly 2026-08-14). Every helper below
// reads process.env directly.
// ---------------------------------------------------------------------------

export function loadEnvOrFail(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FAIL: ${key} is not set in .env.local — this check cannot run without it.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Identity Platform REST — the exact surface an unauthenticated attacker uses.
// ---------------------------------------------------------------------------

function apiKey() {
  return loadEnvOrFail('NEXT_PUBLIC_FIREBASE_API_KEY');
}

export function randomProbeEmail() {
  const rand = Math.random().toString(36).slice(2, 10);
  // .invalid is a reserved TLD (RFC 2606) — this address can never receive real mail
  // and can never collide with a real committee member's address.
  return `admin-auth-check-probe-${rand}@saoc-contract-check.invalid`;
}

// Reproduces the attack exactly: an unauthenticated POST to accounts:signUp with the
// PUBLIC web API key. Returns { idToken, localId, email }. This account is UNVERIFIED
// and UNPRIVILEGED by construction — no claim, not on any allowlist.
export async function signUpProbeAccount(email = randomProbeEmail(), password = randomPassword()) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`FAIL: accounts:signUp for probe account failed — ${JSON.stringify(body)}`);
  }
  return { idToken: body.idToken, localId: body.localId, email };
}

function randomPassword() {
  return `AuthCheck-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// Deletes a Firebase Auth user by idToken (self-delete — exactly what a departing probe
// account can do to itself, no admin privilege required). Used to clean up probes.
export async function deleteAccountByIdToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`FAIL: accounts:delete failed — ${JSON.stringify(body)}`);
  }
}

// Exchanges a Firebase custom token (minted server-side by Admin SDK) for a real
// idToken, the same way a client SDK's signInWithCustomToken would.
export async function exchangeCustomToken(customToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`FAIL: signInWithCustomToken failed — ${JSON.stringify(body)}`);
  }
  return body.idToken;
}

// Confirms an account no longer exists: accounts:lookup by idToken must fail once that
// token's user has been deleted. Used as the "assert it is gone" step.
export async function assertAccountGone(staleIdToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey()}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: staleIdToken }),
    },
  );
  if (res.ok) {
    throw new Error('FAIL: probe account still resolves via accounts:lookup after deletion');
  }
}

// ---------------------------------------------------------------------------
// Admin SDK — used only to provision/deprovision the allowlisted fixture account.
// Never used to bypass HTTP; every actual authorisation claim below is proved through
// the app's own HTTP surface, exactly like every other user of this account would hit.
// ---------------------------------------------------------------------------

let adminAppPromise;

async function getAdminAuth() {
  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const projectId = loadEnvOrFail('FIREBASE_ADMIN_PROJECT_ID');
      const clientEmail = loadEnvOrFail('FIREBASE_ADMIN_CLIENT_EMAIL');
      const privateKey = loadEnvOrFail('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n');
      const app =
        getApps().find((a) => a.name === 'admin-auth-hardening-check') ??
        initializeApp(
          { credential: cert({ projectId, clientEmail, privateKey }) },
          'admin-auth-hardening-check',
        );
      return getAuth(app);
    })();
  }
  return adminAppPromise;
}

// Creates (or reuses, if a prior run's cleanup failed) the allowlisted fixture user,
// verified email, admin:true claim, and returns a fresh idToken for it. Caller MUST
// call deleteAllowlistedFixtureUser() when done, in a finally.
export async function createAllowlistedFixtureUser(email = ALLOWLISTED_FIXTURE_EMAIL) {
  const auth = await getAdminAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    // Residue from a prior interrupted run — reuse the uid, do not error.
  } catch {
    user = await auth.createUser({ email, emailVerified: true, password: randomPassword() });
  }
  await auth.updateUser(user.uid, { emailVerified: true });
  await auth.setCustomUserClaims(user.uid, { admin: true });
  const customToken = await auth.createCustomToken(user.uid);
  const idToken = await exchangeCustomToken(customToken);
  return { uid: user.uid, email, idToken };
}

export async function deleteAllowlistedFixtureUser(uid) {
  const auth = await getAdminAuth();
  await auth.deleteUser(uid).catch(() => undefined);
}

// Mints a FRESH idToken for an existing uid, reflecting whatever custom claims are
// current AT THIS MOMENT. Firebase embeds claims in the token at mint time, not
// per-request — so any check that mutates a user's claims mid-run must call this again
// after each mutation, never reuse an idToken minted before the mutation.
export async function mintIdTokenForUid(uid) {
  const auth = await getAdminAuth();
  const customToken = await auth.createCustomToken(uid);
  return exchangeCustomToken(customToken);
}

// Sets an arbitrary (possibly malformed) claim set on a user — used by the
// fail-closed-states checks (malformed claim, missing claim) against a user who IS
// allowlisted and IS email-verified, isolating the claim itself as the only variable.
export async function setCustomClaims(uid, claims) {
  const auth = await getAdminAuth();
  await auth.setCustomUserClaims(uid, claims);
}

export async function revokeSessions(uid) {
  const auth = await getAdminAuth();
  await auth.revokeRefreshTokens(uid);
}

export async function setEmailVerified(uid, verified) {
  const auth = await getAdminAuth();
  await auth.updateUser(uid, { emailVerified: verified });
}

// ---------------------------------------------------------------------------
// Warm-up — run BEFORE any assertion in a check, so first-hit connection setup or
// late compilation is never charged against an assertion's own timeout_seconds budget.
// Failure here means "the server was not ready", not "the security check failed" — the
// two must never be confused, so warm-up failures throw a distinct error type that
// runCheck() reports as a precondition failure, never as a failing assertion.
// ---------------------------------------------------------------------------

const WARMUP_TIMEOUT_MS = 10_000;

export class PreconditionError extends Error {}

// requests: array of path strings (GET) or { path, method } objects. Each gets its own
// WARMUP_TIMEOUT_MS budget, separate from any assertion timeout.
export async function warmUp(requests, { baseUrl = BASE_URL, timeoutMs = WARMUP_TIMEOUT_MS } = {}) {
  for (const req of requests) {
    const p = typeof req === 'string' ? req : req.path;
    const method = typeof req === 'string' ? 'GET' : (req.method ?? 'GET');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(`${baseUrl}${p}`, { method, redirect: 'manual', signal: controller.signal });
    } catch (err) {
      throw new PreconditionError(
        `warm-up ${method} ${baseUrl}${p} did not complete within ${timeoutMs}ms — ${err.message}. ` +
          'The server was not ready; this is NOT a security assertion failure. Confirm the target ' +
          'server (see BASE_URL in _shared.mjs) is up and re-run.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// App HTTP surface
// ---------------------------------------------------------------------------

export async function postSession(idToken, { baseUrl = BASE_URL } = {}) {
  const res = await fetch(`${baseUrl}/api/admin/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie');
  const cookie = setCookie ? setCookie.split(';')[0] : null;
  return { status: res.status, cookie, setCookieHeaderPresent: Boolean(setCookie) };
}

export async function getAdminPage(cookie, { baseUrl = BASE_URL } = {}) {
  const res = await fetch(`${baseUrl}/admin`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  return { status: res.status, location: res.headers.get('location') };
}

export async function getDoorPage(cookie, { baseUrl = BASE_URL } = {}) {
  const res = await fetch(`${baseUrl}/admin/door`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  const body = res.status === 200 ? await res.text() : '';
  return { status: res.status, location: res.headers.get('location'), body };
}

export async function getTicketsApi(cookie, { baseUrl = BASE_URL } = {}) {
  const res = await fetch(`${baseUrl}/api/admin/tickets`, {
    headers: cookie ? { cookie } : {},
  });
  const body = await res.text();
  return { status: res.status, body };
}

export async function getExportCsvApi(cookie, { baseUrl = BASE_URL } = {}) {
  const res = await fetch(`${baseUrl}/api/admin/export-csv`, {
    headers: cookie ? { cookie } : {},
  });
  const body = await res.text();
  return { status: res.status, body };
}

export async function postCheckinApi(cookie, bookingRef = 'SAOC-2027-000000', { baseUrl = BASE_URL } = {}) {
  const res = await fetch(`${baseUrl}/api/admin/checkin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ bookingRef }),
  });
  const body = await res.text();
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Reporting — same shape as show-visitor-info's reporter, for consistency across
// contracts.
// ---------------------------------------------------------------------------

export function makeReporter(checkName) {
  const failures = [];
  return {
    check(condition, label, detail) {
      if (condition) {
        console.log(`  PASS  ${label}`);
      } else {
        console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
        failures.push(label);
      }
      return condition;
    },
    fail(label, detail) {
      console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
      failures.push(label);
    },
    finish() {
      if (failures.length === 0) {
        console.log(`PASS: ${checkName}`);
        return 0;
      }
      console.error(`FAIL: ${checkName} — ${failures.length} failing assertion(s):`);
      for (const f of failures) console.error(`  - ${f}`);
      return 1;
    },
  };
}

export async function runCheck(checkName, fn) {
  const reporter = makeReporter(checkName);
  let exitCode = 1;
  try {
    await fn(reporter);
    exitCode = reporter.finish();
  } catch (err) {
    if (err instanceof PreconditionError) {
      // Never let "server wasn't ready" masquerade as "the gate refused me" — a
      // distinct, unmistakable report, not a FAIL line indistinguishable from an
      // assertion failure.
      console.error(`PRECONDITION FAILED: ${checkName} — ${err.message}`);
    } else {
      console.error(`FAIL: ${checkName} threw — ${err.stack ?? err.message}`);
    }
    exitCode = 1;
  }
  process.exit(exitCode);
}

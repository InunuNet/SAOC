// admin-session-refusal-log-enforcement-f1 — shared helpers, owned exclusively by this
// contract. See contracts/golden/admin-session-refusal-log-enforcement-f1/README.md for
// the full decision record, in particular "Why this reuses, and departs from,
// admin-auth-hardening's harness pattern" for why this file spawns and owns its own
// `next start` server process instead of targeting an externally-already-running one:
// this contract's whole point is to capture that server PROCESS's own stdout/stderr
// (the `console.warn(...)` line `classifyRefusal` emits) and assert on its content,
// which is impossible against a server this script did not itself spawn.
//
// Account/claim/idToken plumbing below reuses the technique already established by
// contracts/checks/admin-auth-hardening/_shared.mjs (not imported — each contract's
// goldens are owned exclusively by that contract, per this contract's contract.yaml).

import { config as loadDotenv } from 'dotenv';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// FIREBASE_ADMIN_PRIVATE_KEY is a real multi-line PEM inside a quoted .env.local value.
// dotenv's own parser handles that correctly; a hand-rolled line-by-line parser does not
// (see admin-auth-hardening/_shared.mjs's comment on the same issue, measured 2026-08-14).
loadDotenv({ path: new URL('../../../.env.local', import.meta.url).pathname, quiet: true });

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export const PORT = process.env.ADMIN_SESSION_REFUSAL_CHECK_PORT ?? '3411';
export const BASE_URL = `http://127.0.0.1:${PORT}`;

const READY_TIMEOUT_MS = 60_000;
const READY_POLL_INTERVAL_MS = 250;
const SHUTDOWN_TIMEOUT_MS = 10_000;

export class PreconditionError extends Error {}

export function loadEnvOrFail(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FAIL: ${key} is not set in .env.local — this check cannot run without it.`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Build precondition — `next start` requires a production build. Always rebuilds, even
// if a `.next/BUILD_ID` already exists: this contract's whole point is to mechanically
// enforce that a future refactor can't silently delete the classifyRefusal call site,
// and nothing else in the gate forces a fresh build before these checks run. Reusing a
// stale build would let that call site be deleted from source while A1-A3 keep passing
// against the old compiled output. See README "Build precondition".
// ---------------------------------------------------------------------------

export function ensureBuilt() {
  console.log('[admin-session-refusal-check] running `pnpm build` to ensure the server under test reflects current source...');
  const result = spawnSync('pnpm', ['build'], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`FAIL: \`pnpm build\` exited ${result.status} — cannot start a production server.`);
  }
}

// ---------------------------------------------------------------------------
// Spawned server — owns its own stdout/stderr, captured into an in-memory buffer this
// script can read a slice of. mark() before a request, since(mark) after it, so each
// check only ever inspects output produced by its own request.
// ---------------------------------------------------------------------------

class LogBuffer {
  constructor() {
    this.data = '';
  }
  append(chunk) {
    this.data += chunk.toString('utf8');
  }
  mark() {
    return this.data.length;
  }
  since(markPos) {
    return this.data.slice(markPos);
  }
}

// extraEnv is merged on top of this script's own process.env before spawning, so a
// value set here is never overridden by Next's own .env.local loading inside the child
// (env vars already present in a child's process.env take priority over .env files) —
// this is how A4 grants one probe account allowlist membership for the spawned
// server's lifetime only, without ever touching .env.local on disk.
export async function startServer(extraEnv = {}) {
  ensureBuilt();
  const nextBin = path.join(REPO_ROOT, 'node_modules', '.bin', 'next');
  const buffer = new LogBuffer();
  const proc = spawn(nextBin, ['start', '-p', PORT], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...extraEnv },
  });
  proc.stdout.on('data', (chunk) => buffer.append(chunk));
  proc.stderr.on('data', (chunk) => buffer.append(chunk));

  let exited = false;
  proc.once('exit', () => {
    exited = true;
  });

  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited) {
      throw new PreconditionError(
        `spawned \`next start -p ${PORT}\` exited before becoming ready — captured output:\n${buffer.data}`,
      );
    }
    try {
      await fetch(`${BASE_URL}/api/admin/session`, { method: 'GET', redirect: 'manual' });
      return { proc, buffer, baseUrl: BASE_URL, exited: () => exited };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, READY_POLL_INTERVAL_MS));
    }
  }
  throw new PreconditionError(
    `spawned \`next start -p ${PORT}\` did not become ready within ${READY_TIMEOUT_MS}ms. ` +
      `This is NOT an assertion failure — confirm port ${PORT} is free (or override via ` +
      'ADMIN_SESSION_REFUSAL_CHECK_PORT) and re-run.',
  );
}

// Kills the spawned server and waits for its ACTUAL exit (not just a signal sent)
// before resolving — required so A4 can confirm the process is genuinely gone before
// it exits (see contract.yaml A5 cleanup requirement).
export async function stopServer(server) {
  if (server.exited()) {
    return;
  }
  server.proc.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!server.exited()) {
        server.proc.kill('SIGKILL');
      }
    }, SHUTDOWN_TIMEOUT_MS);
    server.proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Log assertions
// ---------------------------------------------------------------------------

export function countRefusalLines(text) {
  return (text.match(/\[admin-auth\] refused/g) ?? []).length;
}

// True only if a "[admin-auth] refused" occurrence's own logged object (the text up to
// the NEXT such occurrence, or a generous window if this is the last one) contains both
// the exact reason and the exact email — not merely that some refusal line appeared
// somewhere in the window, and not residue from a different occurrence.
export function refusalLogMatches(text, reason, email) {
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf('[admin-auth] refused', searchFrom);
    if (idx === -1) return false;
    const nextIdx = text.indexOf('[admin-auth] refused', idx + 1);
    const windowEnd = nextIdx === -1 ? Math.min(text.length, idx + 2000) : nextIdx;
    const block = text.slice(idx, windowEnd);
    const reasonOk = new RegExp(`reason:\\s*['"]${reason}['"]`).test(block);
    const emailOk = block.includes(email);
    if (reasonOk && emailOk) return true;
    searchFrom = idx + 1;
  }
}

// ---------------------------------------------------------------------------
// App HTTP surface
// ---------------------------------------------------------------------------

export async function postSession(idToken, baseUrl = BASE_URL) {
  const res = await fetch(`${baseUrl}/api/admin/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie');
  const bodyText = await res.text();
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = null;
  }
  return {
    status: res.status,
    json,
    rawBody: bodyText,
    setCookieHeaderPresent: Boolean(setCookie),
  };
}

// ---------------------------------------------------------------------------
// Identity Platform REST — real accounts, same technique as
// admin-auth-hardening/_shared.mjs.
// ---------------------------------------------------------------------------

function apiKey() {
  return loadEnvOrFail('NEXT_PUBLIC_FIREBASE_API_KEY');
}

export function randomProbeEmail(label) {
  const rand = Math.random().toString(36).slice(2, 10);
  // .invalid is a reserved TLD (RFC 2606) — can never receive real mail and can never
  // collide with a real committee member's address.
  return `admin-session-refusal-check-${label}-${rand}@saoc-contract-check.invalid`;
}

function randomPassword() {
  return `RefusalCheck-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export async function signUpProbeAccount(email, password = randomPassword()) {
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

// ---------------------------------------------------------------------------
// Admin SDK — used only to set claims/verification state on probe accounts. Every
// actual authorisation decision is still proved through the app's own HTTP surface.
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
        getApps().find((a) => a.name === 'admin-session-refusal-check') ??
        initializeApp(
          { credential: cert({ projectId, clientEmail, privateKey }) },
          'admin-session-refusal-check',
        );
      return getAuth(app);
    })();
  }
  return adminAppPromise;
}

export async function setCustomClaims(uid, claims) {
  const auth = await getAdminAuth();
  await auth.setCustomUserClaims(uid, claims);
}

export async function setEmailVerified(uid, verified) {
  const auth = await getAdminAuth();
  await auth.updateUser(uid, { emailVerified: verified });
}

// Mints a FRESH idToken for a uid, reflecting whatever custom claims are current AT
// THIS MOMENT — Firebase embeds claims in the token at mint time, not per-request, so
// any check that mutates claims mid-run must call this again after each mutation.
export async function mintIdTokenForUid(uid) {
  const auth = await getAdminAuth();
  const customToken = await auth.createCustomToken(uid);
  return exchangeCustomToken(customToken);
}

// ---------------------------------------------------------------------------
// Reporting — same shape as admin-auth-hardening's reporter, for consistency.
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
      console.error(`PRECONDITION FAILED: ${checkName} — ${err.message}`);
    } else {
      console.error(`FAIL: ${checkName} threw — ${err.stack ?? err.message}`);
    }
    exitCode = 1;
  }
  process.exit(exitCode);
}

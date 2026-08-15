// admin-auth-f3-provisioning — shared helpers. Reuses F1/F2's HTTP + Admin SDK helpers from
// contracts/checks/admin-auth-hardening/_shared.mjs directly rather than duplicating them —
// same target server, same env loading, same fixture conventions. This file adds only what F3
// needs on top: running the provisioning scripts as real child processes and reading back
// Admin SDK state after they exit.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export {
  BASE_URL,
  loadEnvOrFail,
  postSession,
  getAdminPage,
  getTicketsApi,
  warmUp,
  runCheck,
  PreconditionError,
} from '../admin-auth-hardening/_shared.mjs';

// Dedicated F3 fixture email, deliberately separate from F1/F2's
// ADMIN_AUTH_CHECK_ALLOWLISTED_EMAIL — see README.md "Design decisions" #5. Must be present in
// the running server's ADMIN_EMAIL_ALLOWLIST for A-REVOKE-01 to pass.
export const F3_ALLOWLISTED_FIXTURE_EMAIL =
  process.env.ADMIN_AUTH_F3_CHECK_ALLOWLISTED_EMAIL ?? 'admin-auth-f3-check-allowlisted@saoc.co.za';

export function randomGrantFixtureEmail() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `admin-auth-f3-check-grant-${rand}@saoc-contract-check.invalid`;
}

export function randomPreExistingFixtureEmail() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `admin-auth-f3-check-preexisting-${rand}@saoc-contract-check.invalid`;
}

export function neverCreatedEmail() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `admin-auth-f3-check-nonexistent-${rand}@saoc-contract-check.invalid`;
}

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

// Runs `pnpm exec tsx scripts/<name>.ts <args...>` as a real child process — proving the
// SCRIPT itself (arg parsing, its own error handling), not a helper function that merely calls
// the same Admin SDK methods the script happens to also call. Captures stdout/stderr so checks
// can assert on printed reminders without ever letting a secret value leak into a check's own
// console output — checks only assert PRESENCE of expected reminder text, never print secrets
// themselves.
export function runScript(name, args, { timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'tsx', `scripts/${name}.ts`, ...args], {
      cwd: REPO_ROOT,
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`FAIL: scripts/${name}.ts did not exit within ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

let adminAppPromise;

async function getAdminAuth() {
  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const { initializeApp, getApps, cert } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const { loadEnvOrFail } = await import('../admin-auth-hardening/_shared.mjs');
      const projectId = loadEnvOrFail('FIREBASE_ADMIN_PROJECT_ID');
      const clientEmail = loadEnvOrFail('FIREBASE_ADMIN_CLIENT_EMAIL');
      const privateKey = loadEnvOrFail('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n');
      const app =
        getApps().find((a) => a.name === 'admin-auth-f3-provisioning-check') ??
        initializeApp(
          { credential: cert({ projectId, clientEmail, privateKey }) },
          'admin-auth-f3-provisioning-check',
        );
      return getAuth(app);
    })();
  }
  return adminAppPromise;
}

// Readback only — every mutation in these checks goes through the scripts under test, never
// through this function, so a check can never accidentally prove the Admin SDK works instead
// of proving the script works.
export async function readUserByEmail(email) {
  const auth = await getAdminAuth();
  try {
    return await auth.getUser((await auth.getUserByEmail(email)).uid);
  } catch {
    return null;
  }
}

export async function mintIdTokenForUid(uid) {
  const { exchangeCustomToken } = await import('../admin-auth-hardening/_shared.mjs');
  const auth = await getAdminAuth();
  const customToken = await auth.createCustomToken(uid);
  return exchangeCustomToken(customToken);
}

// Creates an account the way a self-registered attacker's would look: password provider,
// NOT created by scripts/admin-grant.ts, NOT verified, NO custom claims. This is the
// pre-hijacking / account pre-registration fixture — A-GRANT-02 and A-GRANT-03 run
// scripts/admin-grant.ts against an account created THIS way, never one the script itself
// created, to prove the existing-account branch behaves safely when the script cannot know
// who actually controls the mailbox.
export async function createPreExistingUnverifiedFixture(email) {
  const auth = await getAdminAuth();
  const { randomBytes } = await import('node:crypto');
  const password = randomBytes(24).toString('base64url');
  const user = await auth.createUser({ email, password, emailVerified: false });
  return user.uid;
}

export async function deleteUserIfExists(email) {
  const auth = await getAdminAuth();
  try {
    const user = await auth.getUserByEmail(email);
    await auth.deleteUser(user.uid);
  } catch {
    // Already gone — fine, this is cleanup.
  }
}

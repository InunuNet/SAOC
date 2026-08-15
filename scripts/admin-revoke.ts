/**
 * F3 admin provisioning: revoke admin access from an email address.
 *
 * Clears the `admin` custom claim to an explicit `false` (not removal — a readback should
 * show a deliberate revoke, not an ambiguous "never had one") and revokes all refresh tokens
 * for the account, so an already-open session cookie fails immediately: lib/admin-auth.ts
 * already calls `verifySessionCookie(cookie, true)` with `checkRevoked` true. The claim clear
 * additionally refuses a FRESH session-mint attempt for the same identity, independent of the
 * session revoke. Never deletes the underlying Firebase Auth account — revoking admin
 * capability and removing the account are different operations.
 *
 * Revoking an email with no account behind it is a safe no-op (exit 0) — an operator removing
 * a committee member under time pressure must not be blocked by a typo or a person who never
 * signed up.
 *
 * This script does NOT touch ADMIN_EMAIL_ALLOWLIST — removing the email there is a recommended
 * second step (defence in depth), printed as a reminder below; the claim clear and session
 * revoke above already end access on their own.
 *
 * Run with: pnpm exec tsx scripts/admin-revoke.ts <email>
 *
 * Required env (from .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import { config } from 'dotenv';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

config({ path: '.env.local', quiet: true });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function initAdminApp(): App {
  const projectId = requireEnv('FIREBASE_ADMIN_PROJECT_ID');
  const clientEmail = requireEnv('FIREBASE_ADMIN_CLIENT_EMAIL');
  const privateKey = requireEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n');
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

function isUserNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'auth/user-not-found'
  );
}

function printAllowlistReminder(email: string): void {
  console.log(
    `\nReminder: as defence in depth, also remove "${email}" from ADMIN_EMAIL_ALLOWLIST in\n` +
      'the deployed environment (Secret Manager) or .env.local (local). The claim clear and\n' +
      "session revoke above already end this identity's admin access on their own.",
  );
}

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: pnpm exec tsx scripts/admin-revoke.ts <email>');
    process.exitCode = 1;
    return;
  }

  const auth = getAuth(initAdminApp());

  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch (err: unknown) {
    if (!isUserNotFound(err)) {
      throw err;
    }
    console.log(`No such account for ${email} — nothing to revoke.`);
    return;
  }

  await auth.setCustomUserClaims(uid, { admin: false });
  await auth.revokeRefreshTokens(uid);

  const revokedUser = await auth.getUser(uid);
  console.log(`Revoked admin access for ${email} (uid ${uid}).`);
  console.log(`tokensValidAfterTime: ${revokedUser.tokensValidAfterTime ?? '(not set)'}`);

  printAllowlistReminder(email);
}

main().catch((err: unknown) => {
  console.error(`admin-revoke failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

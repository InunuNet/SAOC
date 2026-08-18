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
 * F4 (ticketing-foundation) extends this script with role-scoped revokes (spec §5.5, §5.6):
 * passing `--role <name> --show <showId>` removes only that role from that show's array,
 * leaving `admin` and every other role/show grant untouched. Every revoke path — full or
 * scoped — still calls `revokeRefreshTokens()` immediately (spec §5.5 treats a revoke as
 * security-critical). Planned by lib/admin-revoke-plan.ts's computeRevokePlan() — this
 * script's real planning path, not a re-implementation.
 *
 * Run with: pnpm exec tsx scripts/admin-revoke.ts <email>
 *       or: pnpm exec tsx scripts/admin-revoke.ts <email> --role <role> --show <showId>
 *
 * Required env (from .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import { config } from 'dotenv';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { computeRevokePlan } from '@/lib/admin-revoke-plan';
import type { RolesClaim } from '@/lib/admin-auth';
import { assertClaimSizeOrThrow } from '@/lib/claim-size-guard';

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

interface ParsedArgs {
  email?: string;
  role?: string;
  show?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let email: string | undefined;
  let role: string | undefined;
  let show: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--role') {
      i += 1;
      role = argv[i];
    } else if (arg === '--show') {
      i += 1;
      show = argv[i];
    } else if (!arg.startsWith('--') && !email) {
      email = arg;
    }
  }

  return { email, role, show };
}

async function main(): Promise<void> {
  const { email, role, show } = parseArgs(process.argv.slice(2));
  if (!email) {
    console.log(
      'Usage: pnpm exec tsx scripts/admin-revoke.ts <email>\n' +
        '   or: pnpm exec tsx scripts/admin-revoke.ts <email> --role <role> --show <showId>',
    );
    process.exitCode = 1;
    return;
  }

  const target = role && show ? { role, show } : undefined;

  const auth = getAuth(initAdminApp());

  let uid: string;
  let existingRoles: RolesClaim | undefined;
  let existingAdmin: boolean;
  try {
    const user = await auth.getUserByEmail(email);
    uid = user.uid;
    existingRoles = user.customClaims?.roles as RolesClaim | undefined;
    existingAdmin = user.customClaims?.admin === true;
  } catch (err: unknown) {
    if (!isUserNotFound(err)) {
      throw err;
    }
    console.log(`No such account for ${email} — nothing to revoke.`);
    return;
  }

  const plan = computeRevokePlan(existingRoles, target);

  // A scoped revoke removes only the named role/show grant — `admin` and every other
  // role/show grant already held are left exactly as they were. A full revoke (no target)
  // clears `admin` to an explicit `false`, matching this script's original behaviour.
  const claims = plan.fullRevoke ? { admin: false } : { admin: existingAdmin, roles: plan.newRoles };
  await auth.setCustomUserClaims(uid, claims);

  // computeRevokePlan().revokeRefreshTokens is unconditionally true on every path (full,
  // scoped, or a no-op target) — this call is not gated on it, it always runs.
  await auth.revokeRefreshTokens(uid);

  const revokedUser = await auth.getUser(uid);
  if (plan.fullRevoke) {
    console.log(`Revoked admin access for ${email} (uid ${uid}).`);
  } else {
    console.log(`Revoked role '${target?.role}' scoped to '${target?.show}' for ${email} (uid ${uid}).`);
  }
  console.log(`tokensValidAfterTime: ${revokedUser.tokensValidAfterTime ?? '(not set)'}`);

  if (plan.fullRevoke) {
    printAllowlistReminder(email);
  }
}

main().catch((err: unknown) => {
  console.error(`admin-revoke failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

/**
 * F3 admin provisioning: list every Firebase Auth user currently holding the `admin` custom
 * claim. Read-only audit helper — makes no mutation of any kind. Lets an operator answer "who
 * currently holds admin" without a console click-through.
 *
 * F4 (ticketing-foundation) additionally flags orphan role names (spec §5.6): a role name held
 * in an account's `roles` claim that no longer exists in lib/admin-roles.ts's mapping — the
 * shape a role rename leaves behind on any account still holding the old name. Flagged by
 * lib/admin-orphan-roles.ts's findOrphanRoles() — this script's real check path, not a
 * re-implementation, checked live against ROLE_NAMES.
 *
 * Run with: pnpm exec tsx scripts/admin-list.ts
 *
 * Required env (from .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import { config } from 'dotenv';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth';

import { findOrphanRoles } from '@/lib/admin-orphan-roles';
import type { RolesClaim } from '@/lib/admin-auth';

config({ path: '.env.local', quiet: true });

const LIST_PAGE_SIZE = 1000;

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

async function listAllUsers(auth: Auth): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(LIST_PAGE_SIZE, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function main(): Promise<void> {
  const auth = getAuth(initAdminApp());
  const users = await listAllUsers(auth);
  const admins = users.filter((user) => user.customClaims?.admin === true);

  if (admins.length === 0) {
    console.log('No admins currently provisioned.');
    return;
  }

  console.log(`${admins.length} account(s) currently hold admin access:\n`);
  for (const admin of admins) {
    const roles = admin.customClaims?.roles as RolesClaim | undefined;
    console.log(`- ${admin.email} (uid ${admin.uid})`);
    console.log(`  emailVerified: ${admin.emailVerified}`);
    console.log(`  tokensValidAfterTime: ${admin.tokensValidAfterTime ?? '(not set)'}`);
    console.log(`  roles: ${roles ? JSON.stringify(roles) : '(none)'}`);

    const orphans = findOrphanRoles(roles);
    if (orphans.length > 0) {
      console.warn(
        `  ORPHAN ROLE(S): ${orphans.join(', ')} — held in this account's claim but absent ` +
          'from lib/admin-roles.ts\'s current ROLE_NAMES (likely a stale name from a rename).',
      );
    }
  }
}

main().catch((err: unknown) => {
  console.error(`admin-list failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

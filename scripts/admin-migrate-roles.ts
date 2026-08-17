/**
 * F4 (ticketing-foundation): one-time migration that grants every existing `admin: true`
 * account a baseline `{'*': ['owner']}` `roles` claim (spec §5.6). See
 * contracts/golden/ticketing-f4-roles-claim/README.md, "The four live-migration-safety
 * decisions," for the full reasoning behind every choice below.
 *
 * Dry-run by default — prints the plan for every account (granted, skipped, and why) without
 * mutating anything. Only a literal `--apply` in argv mutates. Idempotent: re-running is safe,
 * an account already holding a `roles` claim (whether `{'*': ['owner']}` from a prior run, or
 * something richer) is always skipped, never overwritten.
 *
 * This script does NOT call `revokeRefreshTokens()` anywhere. The grant is purely additive to
 * the sole live admin account (`brad@inunu.net` at time of writing) — nothing that currently
 * works for that account stops working, so there is no reason to invalidate its already-open
 * session. Do not add a revoke call here; see the golden README for why that would be wrong
 * for an additive-only migration (unlike scripts/admin-revoke.ts, which must always revoke).
 *
 * Planned by lib/admin-migrate-roles-plan.ts's computeMigrationPlan() — this script's real
 * planning path, not a re-implementation.
 *
 * Run with: pnpm exec tsx scripts/admin-migrate-roles.ts          (dry-run)
 *       or: pnpm exec tsx scripts/admin-migrate-roles.ts --apply  (mutates)
 *
 * Required env (from .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import { config } from 'dotenv';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth';

import { computeMigrationPlan, parseMigrationArgs, type MigrationAccount } from '@/lib/admin-migrate-roles-plan';

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

function toMigrationAccount(user: UserRecord): MigrationAccount {
  return {
    uid: user.uid,
    admin: user.customClaims?.admin === true,
    roles: user.customClaims?.roles,
  };
}

async function main(): Promise<void> {
  const { apply } = parseMigrationArgs(process.argv.slice(2));

  const auth = getAuth(initAdminApp());
  const users = await listAllUsers(auth);
  const usersByUid = new Map(users.map((user) => [user.uid, user]));

  const plan = computeMigrationPlan(users.map(toMigrationAccount));

  console.log(`${apply ? 'APPLYING' : 'DRY-RUN'} — ${plan.length} account(s) evaluated:\n`);
  for (const action of plan) {
    const email = usersByUid.get(action.uid)?.email ?? '(unknown email)';
    if (action.action === 'grant') {
      console.log(`- GRANT  ${email} (uid ${action.uid}) -> ${JSON.stringify(action.newRoles)}`);
    } else {
      console.log(`- SKIP   ${email} (uid ${action.uid}) — ${action.reason}`);
    }
  }

  if (!apply) {
    console.log(
      '\nDry-run only — nothing was mutated. Re-run with --apply to grant the accounts listed ' +
        'above as GRANT.',
    );
    return;
  }

  const grants = plan.filter((action) => action.action === 'grant');
  console.log(`\nApplying ${grants.length} grant(s)...`);
  for (const action of grants) {
    // Additive-only: this is the sole mutation on the --apply path. No revokeRefreshTokens()
    // call anywhere in this script — see the header comment for why that is deliberate.
    await auth.setCustomUserClaims(action.uid, { admin: true, roles: action.newRoles });
    const email = usersByUid.get(action.uid)?.email ?? '(unknown email)';
    console.log(`  granted ${email} (uid ${action.uid}).`);
  }
  console.log('\nDone.');
}

main().catch((err: unknown) => {
  console.error(`admin-migrate-roles failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

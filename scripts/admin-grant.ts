/**
 * F3 admin provisioning: grant admin access to an email address.
 *
 * Looks the user up by email. If no account exists, creates one via the Admin SDK (a path
 * that stays available even after self-signup is disabled at the console level), sets
 * `{ admin: true }` as the sole custom claim, marks the email verified, and prints a one-time
 * password reset link for the operator to hand to the new admin out of band.
 *
 * If an account already exists, this script does NOT trust it by default: self-signup
 * (`accounts:signUp`) is still open in this project, and this script is the first code able to
 * promote an arbitrary existing account to admin. An attacker could pre-register the real
 * admin's email address and sit on it. So a pre-existing account always has its provenance
 * printed first (email, uid, creationTime, providerData, emailVerified) and is only mutated
 * when the operator passes `--existing` after reviewing that provenance — and even then,
 * emailVerified is never touched, since the operator confirming the account is not the same as
 * the operator controlling the mailbox.
 *
 * This script does NOT touch ADMIN_EMAIL_ALLOWLIST — that is a live env var on the deployed
 * server process, a separate manual step, printed as a reminder below.
 *
 * F4 (ticketing-foundation) extends this script with role-scoped grants (spec §5.6): passing
 * `--role <name>` (repeatable) and `--show <showId>` grants that role, scoped to that show, in
 * addition to `admin: true` (a role never does anything on its own — see
 * lib/admin-auth.ts's hasCapability()). Validated by lib/admin-grant-validation.ts's
 * validateGrantArgs() — this script's real validation path, not a re-implementation.
 *
 * Run with: pnpm exec tsx scripts/admin-grant.ts <email> [--existing]
 *       or: pnpm exec tsx scripts/admin-grant.ts <email> --role <role> [--role <role>...] \
 *             --show <showId> [--existing]
 *
 * Required env (from .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import { randomBytes } from 'node:crypto';

import { config } from 'dotenv';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';

import { validateGrantArgs } from '@/lib/admin-grant-validation';
import type { RolesClaim } from '@/lib/admin-auth';

config({ path: '.env.local', quiet: true });

const RANDOM_PASSWORD_BYTES = 24;

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

function generateRandomPassword(): string {
  // Never logged, never returned to the caller — the account's real credential handoff is
  // the one-time password reset link printed below for a freshly created user.
  return randomBytes(RANDOM_PASSWORD_BYTES).toString('base64url');
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
    `\nReminder: "${email}" must also be added to ADMIN_EMAIL_ALLOWLIST in the deployed\n` +
      'environment (Secret Manager) or .env.local (local). This script cannot do that step —\n' +
      'the allowlist is a live env var read by the running server process, not a record these\n' +
      'credentials can reach into the deployed process for.',
  );
}

function printProvenance(user: UserRecord): void {
  const providerIds = user.providerData.map((p) => p.providerId).join(', ') || '(none)';
  console.log(
    '\nPre-existing account found — provenance:\n' +
      `  email:         ${user.email ?? '(none)'}\n` +
      `  uid:           ${user.uid}\n` +
      `  creationTime:  ${user.metadata.creationTime}\n` +
      `  providerData:  ${providerIds}\n` +
      `  emailVerified: ${user.emailVerified}`,
  );
}

interface RoleGrant {
  roles: string[];
  show: string;
}

/** Adds `roleNames` to `show`'s array in `existing`, deduplicated. Preserves every other entry. */
function mergeRolesClaim(existing: RolesClaim | undefined, show: string, roleNames: string[]): RolesClaim {
  const merged: RolesClaim = { ...existing };
  const current = new Set(merged[show] ?? []);
  for (const name of roleNames) current.add(name);
  merged[show] = [...current];
  return merged;
}

/**
 * True for the exact shape a self-registered squatter necessarily has: no federated
 * provider (password only) and never verified by anyone (federated providers set
 * emailVerified: true automatically, so this project has no other way to end up
 * password-only AND unverified). See F4's provisioning-squatter-warning.golden.md.
 */
function isPasswordOnlyUnverified(user: UserRecord): boolean {
  const hasFederatedProvider = user.providerData.some((p) => p.providerId !== 'password');
  return !hasFederatedProvider && !user.emailVerified;
}

function printSquatterShapeWarning(): void {
  console.warn(
    '\nWARNING — password provider only, never verified: no federated identity provider has\n' +
      'ever asserted control of this mailbox. This is exactly the shape a self-registered\n' +
      "squatter has on this project's still-open signup endpoint (accounts:signUp). Before\n" +
      'passing --existing, check whether the person you intend to grant has already signed in\n' +
      'via a federated provider elsewhere (Google, etc.) — that would show up as an additional\n' +
      'entry in providerData above. If it has not, treat this account with real suspicion.',
  );
}

async function createAndGrantFreshUser(
  auth: ReturnType<typeof getAuth>,
  email: string,
  roleGrant?: RoleGrant,
): Promise<void> {
  const { uid } = await auth.createUser({ email, password: generateRandomPassword() });
  const claims: { admin: true; roles?: RolesClaim } = { admin: true };
  if (roleGrant) {
    claims.roles = mergeRolesClaim(undefined, roleGrant.show, roleGrant.roles);
  }
  await auth.setCustomUserClaims(uid, claims);
  await auth.updateUser(uid, { emailVerified: true });

  console.log(`Granted admin access to ${email} (uid ${uid}, newly created).`);
  if (roleGrant) {
    console.log(`Granted role(s) ${roleGrant.roles.join(', ')} scoped to '${roleGrant.show}'.`);
  }

  const resetLink = await auth.generatePasswordResetLink(email);
  console.log(
    '\nSENSITIVE — one-time password reset link. Hand this to the new admin over a secure\n' +
      'out-of-band channel (Signal, a phone call — never email in the clear, never commit or\n' +
      'paste it anywhere persistent). Never redirect this script\'s stdout to a file or run it\n' +
      'under anything that logs or persists its output — the link is usable by whoever reads\n' +
      'it later, not just the intended recipient. Single-use:',
  );
  console.log(resetLink);
}

/** Returns true if the run mutated anything (used only for the final reminder gate). */
async function grantExistingUser(
  auth: ReturnType<typeof getAuth>,
  user: UserRecord,
  allowExisting: boolean,
  roleGrant?: RoleGrant,
): Promise<boolean> {
  printProvenance(user);

  if (!allowExisting) {
    if (isPasswordOnlyUnverified(user)) {
      printSquatterShapeWarning();
    }
    console.error(
      '\nREFUSED — this account already existed before this run. Granting admin onto a\n' +
        'pre-existing account requires informed human confirmation: review the provenance\n' +
        'above, confirm this is genuinely the person you intend to onboard (not a\n' +
        'self-registered squatter on an open signup endpoint), then re-run with the explicit\n' +
        '--existing flag. Nothing was mutated.',
    );
    return false;
  }

  // Custom claims are replaced wholesale by setCustomUserClaims, not merged — any existing
  // roles claim not touched by this grant must be carried forward explicitly, or it is
  // silently wiped.
  const existingRoles = user.customClaims?.roles as RolesClaim | undefined;
  const claims: { admin: true; roles?: RolesClaim } = { admin: true };
  if (roleGrant) {
    claims.roles = mergeRolesClaim(existingRoles, roleGrant.show, roleGrant.roles);
  } else if (existingRoles) {
    claims.roles = existingRoles;
  }

  // Load-bearing: never call updateUser(uid, { emailVerified: true }) on this branch. The
  // account's emailVerified value is left exactly as found, whatever it is.
  await auth.setCustomUserClaims(user.uid, claims);

  console.log(
    `\nGranted admin access to ${user.email ?? '(unknown email)'} (uid ${user.uid}) —\n` +
      'PRE-EXISTING account, --existing confirmed. emailVerified was left unchanged\n' +
      `(currently ${user.emailVerified}). No credential material was generated for this account\n` +
      'on this branch — its password and verification state remain whatever they already were.',
  );
  if (roleGrant) {
    console.log(`Granted role(s) ${roleGrant.roles.join(', ')} scoped to '${roleGrant.show}'.`);
  }
  return true;
}

interface ParsedArgs {
  email?: string;
  existing: boolean;
  roles: string[];
  show?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  let email: string | undefined;
  let existing = false;
  const roles: string[] = [];
  let show: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--existing') {
      existing = true;
    } else if (arg === '--role') {
      i += 1;
      const value = argv[i];
      if (value) roles.push(value);
    } else if (arg === '--show') {
      i += 1;
      show = argv[i];
    } else if (!arg.startsWith('--') && !email) {
      email = arg;
    }
  }

  return { email, existing, roles, show };
}

async function main(): Promise<void> {
  const { email, existing: allowExisting, roles, show } = parseArgs(process.argv.slice(2));
  if (!email) {
    console.log(
      'Usage: pnpm exec tsx scripts/admin-grant.ts <email> [--existing]\n' +
        '   or: pnpm exec tsx scripts/admin-grant.ts <email> --role <role> [--role <role>...] ' +
        '--show <showId> [--existing]',
    );
    process.exitCode = 1;
    return;
  }

  let roleGrant: RoleGrant | undefined;
  const requestingRoleGrant = roles.length > 0 || show !== undefined;
  if (requestingRoleGrant) {
    const validation = validateGrantArgs({ roles, show: show ?? '' });
    if (!validation.ok) {
      console.error(`REFUSED — ${validation.reason}`);
      process.exitCode = 1;
      return;
    }
    // validateGrantArgs refuses an empty show (show ?? ''), so ok:true here guarantees `show`
    // was actually provided — TypeScript can't narrow that through the function call, hence
    // the assertion.
    roleGrant = { roles, show: show as string };
  }

  const auth = getAuth(initAdminApp());

  let existingUser: UserRecord | null;
  try {
    existingUser = await auth.getUserByEmail(email);
  } catch (err: unknown) {
    if (!isUserNotFound(err)) {
      throw err;
    }
    existingUser = null;
  }

  if (!existingUser) {
    await createAndGrantFreshUser(auth, email, roleGrant);
    printAllowlistReminder(email);
    return;
  }

  const mutated = await grantExistingUser(auth, existingUser, allowExisting, roleGrant);
  if (!mutated) {
    process.exitCode = 1;
    return;
  }
  printAllowlistReminder(email);
}

main().catch((err: unknown) => {
  console.error(`admin-grant failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

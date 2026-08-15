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
 * Run with: pnpm exec tsx scripts/admin-grant.ts <email> [--existing]
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
): Promise<void> {
  const { uid } = await auth.createUser({ email, password: generateRandomPassword() });
  await auth.setCustomUserClaims(uid, { admin: true });
  await auth.updateUser(uid, { emailVerified: true });

  console.log(`Granted admin access to ${email} (uid ${uid}, newly created).`);

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

  // Load-bearing: never call updateUser(uid, { emailVerified: true }) on this branch. The
  // account's emailVerified value is left exactly as found, whatever it is.
  await auth.setCustomUserClaims(user.uid, { admin: true });

  console.log(
    `\nGranted admin access to ${user.email ?? '(unknown email)'} (uid ${user.uid}) —\n` +
      'PRE-EXISTING account, --existing confirmed. emailVerified was left unchanged\n' +
      `(currently ${user.emailVerified}). No credential material was generated for this account\n` +
      'on this branch — its password and verification state remain whatever they already were.',
  );
  return true;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const allowExisting = args.includes('--existing');
  const email = args.find((a) => !a.startsWith('--'));
  if (!email) {
    console.log('Usage: pnpm exec tsx scripts/admin-grant.ts <email> [--existing]');
    process.exitCode = 1;
    return;
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
    await createAndGrantFreshUser(auth, email);
    printAllowlistReminder(email);
    return;
  }

  const mutated = await grantExistingUser(auth, existingUser, allowExisting);
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

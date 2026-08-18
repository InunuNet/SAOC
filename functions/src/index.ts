import * as functions from 'firebase-functions/v1';
import { initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';

initializeApp();

// Bounded grace window for a legitimate admin-provisioning run (scripts/admin-grant.ts) to
// call setCustomUserClaims() after createUser(). Both calls typically complete in well under a
// second; 90s leaves comfortable margin. Chosen for that race, not for attacker convenience —
// the capability gap during the window is zero regardless (see docs/admin-access.md).
const GRACE_WINDOW_MS = 90_000;
const POLL_INTERVAL_MS = 5_000;
const DELETE_RETRY_DELAY_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasAdminClaim(user: UserRecord): boolean {
  return user.customClaims?.admin === true;
}

/**
 * Polls the new user record for the admin custom claim, which is the only signal that
 * distinguishes an account provisioned by scripts/admin-grant.ts from a self-signup — see
 * docs/admin-access.md. Returns:
 *  - 'claimed'     the admin claim appeared within the grace window; leave the account alone.
 *  - 'unclaimed'   the grace window elapsed with no claim; the account should be deleted.
 *  - 'inconclusive' a getUser() call itself failed; never delete on an ambiguous read.
 */
async function waitForAdminClaim(uid: string): Promise<'claimed' | 'unclaimed' | 'inconclusive'> {
  const deadline = Date.now() + GRACE_WINDOW_MS;

  while (Date.now() < deadline) {
    let user: UserRecord;
    try {
      user = await getAuth().getUser(uid);
    } catch (error) {
      console.error('Self-signup guard: getUser() failed while polling for admin claim; treating as inconclusive, skipping deletion', {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
      return 'inconclusive';
    }

    if (hasAdminClaim(user)) {
      return 'claimed';
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return 'unclaimed';
}

async function deleteWithOneRetry(uid: string, email: string | undefined): Promise<void> {
  try {
    await getAuth().deleteUser(uid);
    console.log('Self-signup guard: deleted account with no admin claim within grace window', {
      uid,
      email,
      reason: 'no admin claim within grace window',
    });
    return;
  } catch (firstError) {
    console.warn('Self-signup guard: first deleteUser() attempt failed, retrying once', {
      uid,
      email,
      error: firstError instanceof Error ? firstError.message : String(firstError),
    });
  }

  await sleep(DELETE_RETRY_DELAY_MS);

  try {
    await getAuth().deleteUser(uid);
    console.log('Self-signup guard: deleted account with no admin claim within grace window (retry succeeded)', {
      uid,
      email,
      reason: 'no admin claim within grace window',
    });
  } catch (secondError) {
    console.error('Self-signup guard: deleteUser() failed twice; giving up, account remains until a human cleans it up', {
      uid,
      email,
      error: secondError instanceof Error ? secondError.message : String(secondError),
    });
  }
}

/**
 * Closes self-signup on saoc-webapp. Built from functions.auth.user().onCreate(), wrapped in
 * .runWith() below to extend the default Cloud Functions timeout comfortably past the polling
 * grace window. Fires on every account-creation path (password, federated, anonymous, or
 * Admin-SDK createUser). Deletes the new account unless the `admin` custom claim appears within
 * a bounded grace window — the only signal that distinguishes a scripts/admin-grant.ts
 * provisioning run from a self-signup, since an email is deliberately not yet on the admin
 * allowlist at creation time under this project's claim-first provisioning design (see
 * docs/admin-access.md). This function reads no Secret Manager value and has no dependency on
 * that allowlist.
 */
// timeoutSeconds must comfortably exceed GRACE_WINDOW_MS + the delete-retry backoff, or the
// invocation gets killed mid-poll before it can reach a deletion decision. No .region() call —
// 1st-gen Auth triggers are forced to us-central1 regardless (see docs/admin-access.md).
export const guardSelfSignup = functions
  .runWith({ timeoutSeconds: 180 })
  .auth.user()
  .onCreate(async (user) => {
    const outcome = await waitForAdminClaim(user.uid);

    if (outcome === 'claimed' || outcome === 'inconclusive') {
      return;
    }

    await deleteWithOneRetry(user.uid, user.email);
  });

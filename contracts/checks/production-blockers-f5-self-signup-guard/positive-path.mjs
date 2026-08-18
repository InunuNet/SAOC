// A-BEHAV-02 body — run only via check-behav-admin-grant-survives.sh under emulators:exec.
// Positive path: reproduces admin-grant.ts's createAndGrantFreshUser sequence exactly —
// createUser, THEN a separate, later setCustomUserClaims({ admin: true }) call (matching
// scripts/admin-grant.ts:143-149's ordering and timing shape) — and asserts the account
// survives the full grace window plus margin.
import { getAuth } from 'firebase-admin/auth';
import {
  initEmulatorAdmin,
  fixtureEmail,
  safeDeleteUser,
  GRACE_WINDOW_MS,
  MARGIN_MS,
} from './lib-emulator-helpers.mjs';

const app = initEmulatorAdmin();
const auth = getAuth(app);

const email = fixtureEmail('positive');
let uid;

try {
  // Mirrors scripts/admin-grant.ts:143 — createUser first.
  const { uid: createdUid } = await auth.createUser({
    email,
    password: 'throwaway-fixture-password-2',
  });
  uid = createdUid;
  console.log(`Created admin-grant-shaped fixture ${uid} — claim not yet set (mirrors admin-grant.ts's ordering).`);

  // Mirrors scripts/admin-grant.ts:149 — a SEPARATE, subsequent call, not atomic with creation.
  await auth.setCustomUserClaims(uid, { admin: true });
  console.log(`Set admin claim on ${uid} — this must protect it from deletion.`);

  await new Promise((resolve) => setTimeout(resolve, GRACE_WINDOW_MS + MARGIN_MS));

  const user = await auth.getUser(uid); // throws auth/user-not-found if deleted — test fails loudly
  if (user.email !== email) {
    console.error(`FAIL: fixture ${uid} survived but its email changed unexpectedly (${user.email} !== ${email})`);
    process.exitCode = 1;
  } else {
    console.log('PASS: admin-grant-shaped fixture survived the full grace window — claim protected it.');
  }
} catch (err) {
  if (err?.code === 'auth/user-not-found') {
    console.error(
      `FAIL: fixture ${uid} (${email}) was deleted despite receiving the admin custom claim — ` +
        'the onCreate trigger is deleting legitimately-provisioned admin-grant.ts accounts. ' +
        'This is exactly the regression README.md section 2 warns against.',
    );
    process.exitCode = 1;
  } else {
    throw err;
  }
} finally {
  await safeDeleteUser(auth, uid);
}

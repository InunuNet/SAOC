// A-BEHAV-01 body — run only via check-behav-self-signup-deleted.sh under emulators:exec.
// Negative path: an account created the same way accounts:signUp would (password only, no
// claim ever set) must be deleted by the onCreate trigger within the grace window plus margin.
import { getAuth } from 'firebase-admin/auth';
import {
  initEmulatorAdmin,
  fixtureEmail,
  signUpViaRestApi,
  safeDeleteUser,
  pollUntil,
  GRACE_WINDOW_MS,
  MARGIN_MS,
  POLL_INTERVAL_MS,
} from './lib-emulator-helpers.mjs';

const app = initEmulatorAdmin();
const auth = getAuth(app);

const email = fixtureEmail('negative');
let uid;

try {
  uid = await signUpViaRestApi(email, 'throwaway-fixture-password-1');
  console.log(`Created self-signup fixture ${uid} — expecting deletion within grace window.`);

  const deleted = await pollUntil(
    async () => {
      try {
        await auth.getUser(uid);
        return undefined; // still exists, keep polling
      } catch (err) {
        if (err.code === 'auth/user-not-found') return true;
        throw err;
      }
    },
    { timeoutMs: GRACE_WINDOW_MS + MARGIN_MS, intervalMs: POLL_INTERVAL_MS },
  );

  if (!deleted) {
    console.error(
      `FAIL: fixture ${uid} (${email}) was not deleted within ${GRACE_WINDOW_MS + MARGIN_MS}ms — ` +
        'the onCreate trigger did not remove an unclaimed self-signup account.',
    );
    process.exitCode = 1;
  } else {
    console.log('PASS: self-signup fixture was deleted by the onCreate trigger within the grace window.');
  }
} finally {
  await safeDeleteUser(auth, uid);
}

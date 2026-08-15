// A-GRANT-03 — with the explicit --existing opt-in, granting onto a pre-existing account must
// succeed (the operator has reviewed provenance and confirmed the account is the intended
// person) but must NEVER set emailVerified on an account the script did not itself create.
// This is the load-bearing fix for the pre-hijacking scenario: even a deliberately-confirmed
// grant cannot manufacture a verified email for a mailbox the operator does not control. No
// server dependency (Admin SDK only).

import {
  randomPreExistingFixtureEmail,
  createPreExistingUnverifiedFixture,
  runScript,
  readUserByEmail,
  deleteUserIfExists,
  runCheck,
} from './_shared.mjs';

await runCheck('A-GRANT-03 grant onto a pre-existing account with --existing sets admin claim but never forces emailVerified', async (r) => {
  const email = randomPreExistingFixtureEmail();
  try {
    await createPreExistingUnverifiedFixture(email);

    const result = await runScript('admin-grant', [email, '--existing']);
    r.check(result.code === 0, 'admin-grant.ts exits 0 when --existing is explicitly passed', `exit ${result.code} — stderr: ${result.stderr.slice(0, 500)}`);

    const after = await readUserByEmail(email);
    r.check(Boolean(after), 'fixture account still exists');
    if (after) {
      r.check(after.customClaims?.admin === true, 'admin claim IS set with explicit --existing opt-in', JSON.stringify(after.customClaims));
      r.check(
        after.emailVerified === false,
        'emailVerified stays FALSE — the script must never verify an email on an account it did not create',
        `emailVerified: ${after.emailVerified}`,
      );
    }

    r.check(
      !/SENSITIVE/.test(result.stdout) && !/password reset link/i.test(result.stdout),
      'no password reset link is printed on the pre-existing-account branch',
      `stdout: ${result.stdout.slice(0, 500)}`,
    );
  } finally {
    await deleteUserIfExists(email);
  }
});

// A-GRANT-02 — the pre-registration / pre-hijacking defence. Simulates the attack: an account
// exists that scripts/admin-grant.ts did NOT create (password provider, unverified — exactly
// what a self-registered squatter looks like, via the still-open accounts:signUp endpoint).
// Running admin-grant.ts on that email WITHOUT --existing must refuse: no mutation of any
// kind, non-zero exit, and it must print the account's provenance so an operator can see what
// they almost touched. No server dependency (Admin SDK only).

import {
  randomPreExistingFixtureEmail,
  createPreExistingUnverifiedFixture,
  runScript,
  readUserByEmail,
  deleteUserIfExists,
  runCheck,
} from './_shared.mjs';

await runCheck('A-GRANT-02 grant onto a pre-existing account without --existing is refused, no mutation', async (r) => {
  const email = randomPreExistingFixtureEmail();
  try {
    const uid = await createPreExistingUnverifiedFixture(email);

    const result = await runScript('admin-grant', [email]);
    r.check(result.code !== 0, 'admin-grant.ts exits non-zero when refusing a pre-existing account without --existing', `exit ${result.code}`);
    r.check(
      /--existing/.test(result.stdout) || /--existing/.test(result.stderr),
      'refusal message names the --existing flag',
      `stdout: ${result.stdout.slice(0, 500)} stderr: ${result.stderr.slice(0, 500)}`,
    );
    r.check(
      /creationTime/.test(result.stdout) || new RegExp(uid).test(result.stdout),
      'provenance (creationTime or uid) is printed before refusing',
      `stdout: ${result.stdout.slice(0, 500)}`,
    );

    const after = await readUserByEmail(email);
    r.check(Boolean(after), 'fixture account still exists (was not deleted)');
    if (after) {
      r.check(after.customClaims?.admin !== true, 'admin claim was NOT set by the refused run', JSON.stringify(after.customClaims));
      r.check(after.emailVerified === false, 'emailVerified was NOT flipped to true by the refused run');
    }
  } finally {
    await deleteUserIfExists(email);
  }
});

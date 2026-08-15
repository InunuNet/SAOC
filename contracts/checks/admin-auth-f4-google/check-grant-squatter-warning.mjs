// A-GRANT-04 — the claim-first defence's load-bearing enhancement (README.md "Decision
// reversed"). F3's admin-grant.ts already refuses a pre-existing account without --existing
// and prints its provenance (A-GRANT-02, unchanged, still green — this check does not
// duplicate it). What was missing: the provenance print does not distinguish "this looks like
// a self-registered squatter" (password provider only, never verified — exactly what the
// still-open accounts:signUp endpoint produces) from "this account already carries a
// federated provider" (which would mean SOME identity provider has already asserted mailbox
// control for it, a materially different and more trustworthy shape). An operator scanning
// provenance text for uid/creationTime alone can miss that distinction. This check proves the
// script prints an explicit, unambiguous warning for the dangerous shape specifically, so the
// operator's decision to pass --existing is informed by the one fact that actually matters
// for the account-linking hazard (see README.md "The residual risk, and how this closes it").
//
// No server dependency — Admin SDK + a real child process only. Reuses F3's
// createPreExistingUnverifiedFixture(), the same squatter-shape fixture A-GRANT-02/03 already
// use, so this check exercises the SAME fixture convention, not a new one.

import {
  randomPreExistingFixtureEmail,
  createPreExistingUnverifiedFixture,
  runScript,
  deleteUserIfExists,
  runCheck,
} from './_shared.mjs';

await runCheck('A-GRANT-04 pre-existing password-only unverified account triggers an explicit squatter-shape warning', async (r) => {
  const email = randomPreExistingFixtureEmail();
  try {
    await createPreExistingUnverifiedFixture(email);

    const result = await runScript('admin-grant', [email]);
    r.check(result.code !== 0, 'admin-grant.ts still exits non-zero without --existing (unchanged from A-GRANT-02)', `exit ${result.code}`);

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    r.check(
      /no federated provider|password-only|password provider only/i.test(combinedOutput),
      'output names the password-only/no-federated-provider shape explicitly, not just generic provenance',
      `stdout: ${result.stdout.slice(0, 800)} stderr: ${result.stderr.slice(0, 800)}`,
    );
    r.check(
      /already signed in|elsewhere|another provider/i.test(combinedOutput),
      'warning tells the operator what to check before trusting this account (whether the intended person has a federated sign-in elsewhere)',
      `stdout: ${result.stdout.slice(0, 800)}`,
    );
  } finally {
    await deleteUserIfExists(email);
  }
});

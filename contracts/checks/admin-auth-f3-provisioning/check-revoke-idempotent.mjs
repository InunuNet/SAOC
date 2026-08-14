// A-REVOKE-02 — revoking an email with NO Firebase Auth account behind it must never crash or
// hang. An operator removing a committee member under time pressure must not be blocked by a
// typo'd email or a person who never actually signed up. No server dependency.

import { neverCreatedEmail, runScript, runCheck } from './_shared.mjs';

await runCheck('A-REVOKE-02 revoking a nonexistent account is a safe no-op', async (r) => {
  const email = neverCreatedEmail();
  const result = await runScript('admin-revoke', [email]);
  r.check(result.code === 0, 'admin-revoke.ts exits 0 for an email with no account', `exit ${result.code} — stderr: ${result.stderr.slice(0, 500)}`);
  r.check(
    /no such account|nothing to revoke|not found/i.test(result.stdout),
    'stdout explains there was nothing to revoke, not a silent success',
    `stdout: ${result.stdout.slice(0, 500)}`,
  );
});

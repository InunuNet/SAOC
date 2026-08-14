// A-GRANT-01 — scripts/admin-grant.ts, run as a real child process against a fresh,
// never-before-seen email: creates the account, sets admin:true, sets emailVerified:true.
// Re-run on the SAME email proves idempotency: no error, no second account, same end state.
// No server dependency — this exercises the Admin SDK directly through the script, not HTTP.

import {
  randomGrantFixtureEmail,
  runScript,
  readUserByEmail,
  deleteUserIfExists,
  runCheck,
} from './_shared.mjs';

await runCheck('A-GRANT-01 grant script creates, claims and verifies; idempotent on re-run', async (r) => {
  const email = randomGrantFixtureEmail();
  try {
    const first = await runScript('admin-grant', [email]);
    r.check(first.code === 0, 'first grant run exits 0', `exit ${first.code} — stderr: ${first.stderr.slice(0, 500)}`);

    const afterFirst = await readUserByEmail(email);
    r.check(Boolean(afterFirst), 'user exists after first grant run');
    if (afterFirst) {
      r.check(afterFirst.customClaims?.admin === true, 'admin claim is true after first grant run', JSON.stringify(afterFirst.customClaims));
      r.check(afterFirst.emailVerified === true, 'emailVerified is true after first grant run');
    }

    const uidAfterFirst = afterFirst?.uid;

    const second = await runScript('admin-grant', [email]);
    r.check(second.code === 0, 'second (idempotent) grant run exits 0', `exit ${second.code} — stderr: ${second.stderr.slice(0, 500)}`);

    const afterSecond = await readUserByEmail(email);
    r.check(Boolean(afterSecond), 'user still exists after second grant run');
    if (afterSecond) {
      r.check(afterSecond.uid === uidAfterFirst, 'second grant run did not create a second account (same uid)', `${afterSecond.uid} vs ${uidAfterFirst}`);
      r.check(afterSecond.customClaims?.admin === true, 'admin claim still true after second grant run');
      r.check(afterSecond.emailVerified === true, 'emailVerified still true after second grant run');
    }
  } finally {
    await deleteUserIfExists(email);
  }
});

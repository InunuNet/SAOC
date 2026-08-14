// A-REVOKE-01 — the mission's real point. scripts/admin-revoke.ts, run as a real child
// process, must terminate an EXISTING session cookie immediately (not after 5 days) and
// prevent a FRESH session mint attempt for the same identity. Uses scripts/admin-grant.ts to
// provision the fixture too, so the whole grant->use->revoke->refused lifecycle runs through
// the actual scripts under test, not through Admin SDK calls a check wrote itself.
//
// PRECONDITION: F3_ALLOWLISTED_FIXTURE_EMAIL must already be present in the running server's
// ADMIN_EMAIL_ALLOWLIST — same precondition shape as F1/F2's A-ALLOW-01 / A-STATE-02.

import {
  F3_ALLOWLISTED_FIXTURE_EMAIL,
  runScript,
  readUserByEmail,
  mintIdTokenForUid,
  deleteUserIfExists,
  postSession,
  getAdminPage,
  getTicketsApi,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('A-REVOKE-01 revoke script terminates access immediately', async (r) => {
  await warmUp([{ path: '/api/admin/session', method: 'POST' }, '/admin', '/api/admin/tickets']);

  const email = F3_ALLOWLISTED_FIXTURE_EMAIL;
  try {
    const grant = await runScript('admin-grant', [email]);
    r.check(grant.code === 0, 'admin-grant.ts provisions the fixture successfully', `exit ${grant.code} — stderr: ${grant.stderr.slice(0, 500)}`);

    const user = await readUserByEmail(email);
    if (!user) {
      r.fail('fixture user exists after grant', 'readUserByEmail returned null — cannot continue');
      return;
    }

    const idToken = await mintIdTokenForUid(user.uid);
    const session = await postSession(idToken);
    if (session.status !== 200 || !session.cookie) {
      r.fail('session mint before revocation succeeded', `got ${session.status} — check ADMIN_EMAIL_ALLOWLIST contains ${email}`);
      return;
    }
    r.check(true, 'session cookie minted successfully before revocation');

    const before = await getTicketsApi(session.cookie);
    r.check(before.status === 200, '/api/admin/tickets succeeds with the cookie BEFORE revocation (sanity check)', `got ${before.status}`);

    const revoke = await runScript('admin-revoke', [email]);
    r.check(revoke.code === 0, 'admin-revoke.ts exits 0', `exit ${revoke.code} — stderr: ${revoke.stderr.slice(0, 500)}`);

    const afterAdmin = await getAdminPage(session.cookie);
    r.check(
      afterAdmin.status === 307 || afterAdmin.status === 302,
      '/admin refuses the SAME pre-revoke cookie immediately after admin-revoke.ts runs',
      `got ${afterAdmin.status}`,
    );

    const afterTickets = await getTicketsApi(session.cookie);
    r.check(
      afterTickets.status === 401 || afterTickets.status === 403,
      '/api/admin/tickets refuses the SAME pre-revoke cookie immediately after admin-revoke.ts runs',
      `got ${afterTickets.status}`,
    );

    const revokedUser = await readUserByEmail(email);
    r.check(revokedUser?.customClaims?.admin === false, 'admin claim is explicitly false after revoke', JSON.stringify(revokedUser?.customClaims));

    // A FRESH idToken (minted now, so it carries the current — cleared — claim) must also be
    // refused a NEW session, proving claim-clearing works independently of session revocation.
    const freshIdToken = await mintIdTokenForUid(user.uid);
    const freshSession = await postSession(freshIdToken);
    r.check(
      freshSession.status === 403 && !freshSession.cookie,
      'a FRESH session-mint attempt for the revoked identity is refused (claim cleared, not just session revoked)',
      `got ${freshSession.status}, cookie present: ${Boolean(freshSession.cookie)}`,
    );
  } finally {
    await deleteUserIfExists(email);
  }
});

// A-STATE-02 — a revoked session must fail closed immediately, not wait out the 5-day
// cookie lifetime. Mints a real session cookie for an allowlisted identity, confirms it
// works once, revokes the user's refresh tokens (what F3's "remove a committee member"
// procedure will call), and confirms the SAME cookie is refused on every surface
// afterwards. This is the behavioural proof that verifySessionCookie(cookie, true) —
// checkRevoked — is actually wired through, not just present as an argument.
//
// PRECONDITION: same fixture-email-on-allowlist precondition as A-ALLOW-01.

import {
  createAllowlistedFixtureUser,
  deleteAllowlistedFixtureUser,
  revokeSessions,
  postSession,
  getAdminPage,
  getTicketsApi,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('A-STATE-02 revoked session refused immediately', async (r) => {
  await warmUp([{ path: '/api/admin/session', method: 'POST' }, '/admin', '/api/admin/tickets']);

  const fixture = await createAllowlistedFixtureUser();
  try {
    const session = await postSession(fixture.idToken);
    if (session.status !== 200 || !session.cookie) {
      r.fail('session mint before revocation succeeded', `got ${session.status} — cannot test revocation without a working cookie first`);
      return;
    }
    r.check(true, 'session cookie minted successfully before revocation');

    const before = await getAdminPage(session.cookie);
    r.check(before.status === 200, '/admin renders with the cookie BEFORE revocation (sanity check)', `got ${before.status}`);

    await revokeSessions(fixture.uid);

    const afterAdmin = await getAdminPage(session.cookie);
    r.check(
      afterAdmin.status === 307 || afterAdmin.status === 302,
      '/admin refuses the SAME cookie after revokeRefreshTokens',
      `got ${afterAdmin.status}`,
    );

    const afterTickets = await getTicketsApi(session.cookie);
    r.check(
      afterTickets.status === 401 || afterTickets.status === 403,
      '/api/admin/tickets refuses the SAME cookie after revokeRefreshTokens',
      `got ${afterTickets.status}`,
    );
  } finally {
    await deleteAllowlistedFixtureUser(fixture.uid);
  }
});

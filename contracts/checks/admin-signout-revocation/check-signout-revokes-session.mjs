// R-CORE-01 — the load-bearing proof for this whole feature: signing out must
// actually revoke the session server-side, not merely clear the cookie in the
// responding browser. A grep for `revokeRefreshTokens` in the route source would pass
// on dead code, on a call in a branch that never executes, or on a call whose thrown
// error is silently swallowed with revocation never actually happening — none of that
// is ruled out by a source grep. The only proof that survives all three false states is
// behavioural: mint a REAL session cookie, confirm it is accepted, call DELETE
// /api/admin/session with it, then present that SAME captured cookie value again on a
// FRESH, independent request and prove it is now refused everywhere a session is
// checked.
//
// PRECONDITION: same fixture-email-on-allowlist precondition as admin-auth-hardening's
// A-ALLOW-01/A-STATE-02 — the fixture email must already be on the running server's
// ADMIN_EMAIL_ALLOWLIST.

import {
  createAllowlistedFixtureUser,
  deleteAllowlistedFixtureUser,
  postSession,
  deleteSession,
  getAdminPage,
  getTicketsApi,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('R-CORE-01 sign-out revokes the session, not just the local cookie', async (r) => {
  await warmUp([
    { path: '/api/admin/session', method: 'POST' },
    { path: '/api/admin/session', method: 'DELETE' },
    '/admin',
    '/api/admin/tickets',
  ]);

  const fixture = await createAllowlistedFixtureUser();
  try {
    const session = await postSession(fixture.idToken);
    if (session.status !== 200 || !session.cookie) {
      r.fail(
        'session mint before sign-out succeeded',
        `got ${session.status} — cannot test sign-out revocation without a working cookie first`,
      );
      return;
    }
    const capturedCookie = session.cookie; // the exact value re-presented below

    const before = await getAdminPage(capturedCookie);
    r.check(before.status === 200, '/admin renders with the cookie BEFORE sign-out (sanity check)', `got ${before.status}`);

    const signOut = await deleteSession(capturedCookie);
    r.check(signOut.status === 200, 'DELETE /api/admin/session with a valid cookie returns 200', `got ${signOut.status}`);
    r.check(signOut.clearsCookie, 'DELETE response clears the cookie for the calling browser', `Set-Cookie: ${signOut.setCookie}`);

    // The proof: re-present the SAME captured cookie value on a fresh, independent
    // request (simulating an attacker who exfiltrated the cookie before sign-out, or a
    // second tab that never received the clearing Set-Cookie). If this still succeeds,
    // sign-out only cleared the local browser's cookie and did nothing server-side.
    const afterAdmin = await getAdminPage(capturedCookie);
    r.check(
      afterAdmin.status === 307 || afterAdmin.status === 302,
      '/admin refuses the SAME captured cookie after sign-out (proves server-side revocation, not just a local clear)',
      `got ${afterAdmin.status}`,
    );

    const afterTickets = await getTicketsApi(capturedCookie);
    r.check(
      afterTickets.status === 401 || afterTickets.status === 403,
      '/api/admin/tickets refuses the SAME captured cookie after sign-out',
      `got ${afterTickets.status}`,
    );
  } finally {
    await deleteAllowlistedFixtureUser(fixture.uid);
  }
});

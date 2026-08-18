// R-NOATTACK-01 — design constraint #2: the uid revoked by sign-out must be derived
// ONLY from the verified session cookie presented in the request, never from any
// client-supplied body or query parameter. Revocation is global (design constraint #3
// — it kills that user's other sessions too), which is exactly why an attacker being
// able to name an arbitrary victim uid would be a real, high-impact denial-of-service:
// one crafted DELETE could sign out every session of any admin on the team, repeatedly,
// with no authentication as that victim required.
//
// Provisions TWO real allowlisted fixture users (A, B), mints a real session cookie for
// each, then calls DELETE authenticated as A's cookie while the request body/query
// claims to be acting on B's uid. The proof is behavioural, not a source grep: B's
// separately-captured cookie must remain VALID afterward — confirmed by successfully
// loading /admin with it — which is impossible if the endpoint honoured the
// client-supplied uid over the cookie's own verified subject.
//
// PRECONDITION: same fixture-email-on-allowlist precondition as the other checks in
// this contract. Uses two DIFFERENT random-suffixed emails so the two fixtures never
// collide with each other or with admin-auth-hardening's own fixtures.

import {
  createAllowlistedFixtureUser,
  deleteAllowlistedFixtureUser,
  postSession,
  deleteSession,
  getAdminPage,
  randomProbeEmail,
  warmUp,
  runCheck,
} from './_shared.mjs';

// randomProbeEmail() mints @saoc-contract-check.invalid addresses, which are never on
// the allowlist by construction — these two fixtures instead reuse the allowlisted
// fixture email's local part with a random suffix, matching the ALLOWLISTED_FIXTURE_EMAIL
// convention closely enough to stay on an allowlist that (per _shared.mjs's own
// documented precondition) matches by exact email, so both must be explicitly
// provisioned. See this contract's golden README "Fixture accounts" for the two emails
// this check requires to already be present on the running server's
// ADMIN_EMAIL_ALLOWLIST.
const FIXTURE_A_EMAIL = process.env.ADMIN_SIGNOUT_CHECK_FIXTURE_A_EMAIL
  ?? 'admin-signout-check-a@saoc.co.za';
const FIXTURE_B_EMAIL = process.env.ADMIN_SIGNOUT_CHECK_FIXTURE_B_EMAIL
  ?? 'admin-signout-check-b@saoc.co.za';

await runCheck('R-NOATTACK-01 sign-out ignores a client-supplied victim uid', async (r) => {
  await warmUp([
    { path: '/api/admin/session', method: 'POST' },
    { path: '/api/admin/session', method: 'DELETE' },
    '/admin',
  ]);

  const fixtureA = await createAllowlistedFixtureUser(FIXTURE_A_EMAIL);
  const fixtureB = await createAllowlistedFixtureUser(FIXTURE_B_EMAIL);
  try {
    const sessionA = await postSession(fixtureA.idToken);
    const sessionB = await postSession(fixtureB.idToken);
    if (sessionA.status !== 200 || !sessionA.cookie || sessionB.status !== 200 || !sessionB.cookie) {
      r.fail(
        'session mint for both fixtures succeeded',
        `got A=${sessionA.status} B=${sessionB.status} — cannot test cross-user revocation without two working cookies`,
      );
      return;
    }

    const sanityB = await getAdminPage(sessionB.cookie);
    r.check(sanityB.status === 200, "B's cookie renders /admin BEFORE the attack (sanity check)", `got ${sanityB.status}`);

    // The attack: authenticated as A (A's cookie), but the body AND query string both
    // name B's uid/email as the target — every plausible field name an implementation
    // might have mistakenly read from client input instead of the cookie.
    const attack = await deleteSession(sessionA.cookie, {
      body: { uid: fixtureB.uid, targetUid: fixtureB.uid, email: fixtureB.email },
      query: { uid: fixtureB.uid },
    });
    r.check(attack.status === 200, "crafted DELETE (authenticated as A, targeting B's uid) still returns 200 for A's own sign-out", `got ${attack.status}`);

    // The proof: B's session, captured BEFORE the attack, must still work — impossible
    // if the endpoint revoked B instead of (or in addition to) A.
    const afterB = await getAdminPage(sessionB.cookie);
    r.check(
      afterB.status === 200,
      "B's cookie STILL works after A's crafted sign-out request named B's uid (proves uid is derived only from the caller's own cookie)",
      `got ${afterB.status}`,
    );

    // A's own session should be the one actually revoked — confirms the endpoint did
    // something real (derived A's own uid from A's cookie), not that revocation was a
    // no-op across the board.
    const afterA = await getAdminPage(sessionA.cookie);
    r.check(
      afterA.status === 307 || afterA.status === 302,
      "A's OWN cookie is refused after A's own sign-out (revocation still works for the caller's real identity)",
      `got ${afterA.status}`,
    );
  } finally {
    await deleteAllowlistedFixtureUser(fixtureA.uid);
    await deleteAllowlistedFixtureUser(fixtureB.uid);
  }
});

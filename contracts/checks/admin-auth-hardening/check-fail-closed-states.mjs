// A-STATE-01 — every unenumerated state the mission names must fail closed, proved one
// variable at a time against an otherwise-valid, allowlisted, email-verified fixture
// user so each state is isolated from the others:
//   (a) claim present, verified, but email NOT on the allowlist
//   (b) malformed claim (admin: 'true', the string, not the boolean)
//   (c) missing claim entirely (no custom claims at all)
//   (d) claim present + allowlisted, but email NOT verified
//
// Firebase embeds custom claims in an idToken at MINT time, not per-request, so each
// sub-case below re-mints its own idToken via mintIdTokenForUid() AFTER changing the
// user's claims/verification state — reusing an idToken minted before the mutation
// would silently test the PREVIOUS state, which is exactly the kind of false-green this
// contract exists to avoid.
//
// PRECONDITION: same as A-ALLOW-01 — the fixture email must already be on the running
// server's ADMIN_EMAIL_ALLOWLIST for (b)/(c)/(d) to isolate the claim/verification
// variable rather than being refused by allowlist membership first. (a) deliberately
// uses a DIFFERENT, non-allowlisted email so it needs no such precondition.

import {
  createAllowlistedFixtureUser,
  deleteAllowlistedFixtureUser,
  setCustomClaims,
  setEmailVerified,
  mintIdTokenForUid,
  postSession,
  randomProbeEmail,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('A-STATE-01 unenumerated states fail closed', async (r) => {
  await warmUp([{ path: '/api/admin/session', method: 'POST' }]);

  // ---- (a) claim present, verified, but email never allowlisted ----
  const notAllowlistedEmail = randomProbeEmail(); // .invalid domain, guaranteed off any real allowlist
  const notAllowlisted = await createAllowlistedFixtureUser(notAllowlistedEmail);
  try {
    const session = await postSession(notAllowlisted.idToken);
    r.check(
      session.status === 403 && !session.setCookieHeaderPresent,
      '(a) valid claim + verified email, but NOT allowlisted, is refused with no cookie',
      `got ${session.status}, setCookie=${session.setCookieHeaderPresent}`,
    );
  } finally {
    await deleteAllowlistedFixtureUser(notAllowlisted.uid);
  }

  // ---- (b)/(c)/(d): isolate claim/verification variables on the allowlisted email ----
  const fixture = await createAllowlistedFixtureUser();
  try {
    // (b) malformed claim: admin as the STRING 'true', not the boolean.
    await setCustomClaims(fixture.uid, { admin: 'true' });
    const malformedToken = await mintIdTokenForUid(fixture.uid);
    const malformed = await postSession(malformedToken);
    r.check(
      malformed.status === 403 && !malformed.setCookieHeaderPresent,
      "(b) malformed claim (admin: 'true' string, not boolean) is refused with no cookie",
      `got ${malformed.status}, setCookie=${malformed.setCookieHeaderPresent}`,
    );

    // (c) no custom claims at all.
    await setCustomClaims(fixture.uid, {});
    const noClaimToken = await mintIdTokenForUid(fixture.uid);
    const noClaim = await postSession(noClaimToken);
    r.check(
      noClaim.status === 403 && !noClaim.setCookieHeaderPresent,
      '(c) missing admin claim entirely is refused with no cookie',
      `got ${noClaim.status}, setCookie=${noClaim.setCookieHeaderPresent}`,
    );

    // (d) restore the valid claim, then strip email verification instead.
    await setCustomClaims(fixture.uid, { admin: true });
    await setEmailVerified(fixture.uid, false);
    const unverifiedIdToken = await mintIdTokenForUid(fixture.uid);
    const unverified = await postSession(unverifiedIdToken);
    r.check(
      unverified.status === 403 && !unverified.setCookieHeaderPresent,
      '(d) valid claim + allowlisted, but email NOT verified, is refused with no cookie',
      `got ${unverified.status}, setCookie=${unverified.setCookieHeaderPresent}`,
    );
    await setEmailVerified(fixture.uid, true); // restore before delete, tidy state
  } finally {
    await deleteAllowlistedFixtureUser(fixture.uid);
  }
});

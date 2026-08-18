// R-NOREPEAT-01 — Codex GPT-5.5 finding (2026-08-19), confirmed real: the DELETE
// handler resolves its uid with `verifySessionCookie(cookie)` WITHOUT checkRevoked. A
// cookie that has ALREADY been revoked (but not yet naturally expired — up to ~5 days)
// still verifies successfully, still resolves a uid, and still triggers
// revokeRefreshTokens(uid) again on every replay.
//
// Consequence: an exfiltrated cookie loses its READ access (getAdminSession uses
// checkRevoked=true, so /admin etc. correctly refuse it — see A1) but KEEPS the power
// to force-revoke the legitimate admin's OTHER, freshly-signed-in sessions, repeatedly,
// for the stolen cookie's full remaining lifetime. An attacker who stole one cookie can
// sign the real admin out of everything, on demand, indefinitely — even after the admin
// signs back in. A1 only proved the direction "the cookie stops working"; this
// assertion proves the direction that actually matters to an attacker: "what can a
// holder of this credential still cause to happen".
//
// THE HARD PART, deliberately handled here rather than left implicit: a correct fix
// (checkRevoked=true) and the CURRENT bug both return HTTP 200 on the replayed DELETE —
// constraint #1 (sign-out must never fail, even on a broken session) means "the second
// DELETE returns non-200" can never be the signal. The only ground truth that
// distinguishes "revoked again" from "correctly did nothing" is Firebase's own
// tokensValidAfterTime on the user record, which changes on every REAL
// revokeRefreshTokens(uid) call and only then. See _shared.mjs's
// getTokensValidAfterTime() for why a second, independent Admin SDK path is used to
// observe it, rather than trusting the HTTP response shape.
//
// EXPECTED TO CURRENTLY FAIL: this check is written and run BEFORE the checkRevoked
// fix lands, specifically to confirm it fails against the present code (an assertion
// that has never been observed failing against the real defect is not evidence). Once
// app/api/admin/session/route.ts:82 passes checkRevoked=true to verifySessionCookie in
// the DELETE handler, this check must pass.
//
// PRECONDITION: same fixture-email-on-allowlist precondition as the other checks in
// this contract.

import {
  createAllowlistedFixtureUser,
  deleteAllowlistedFixtureUser,
  postSession,
  deleteSession,
  getTokensValidAfterTime,
  warmUp,
  runCheck,
} from './_shared.mjs';

await runCheck('R-NOREPEAT-01 a replayed revoked cookie cannot re-trigger revocation', async (r) => {
  await warmUp([
    { path: '/api/admin/session', method: 'POST' },
    { path: '/api/admin/session', method: 'DELETE' },
  ]);

  const fixture = await createAllowlistedFixtureUser();
  try {
    const session = await postSession(fixture.idToken);
    if (session.status !== 200 || !session.cookie) {
      r.fail(
        'session mint before sign-out succeeded',
        `got ${session.status} — cannot test replay without a working cookie first`,
      );
      return;
    }
    const capturedCookie = session.cookie;

    // First sign-out: a REAL, legitimate revocation. tokensValidAfterTime must change.
    const beforeAny = await getTokensValidAfterTime(fixture.uid);
    const firstSignOut = await deleteSession(capturedCookie);
    r.check(firstSignOut.status === 200, 'first DELETE (legitimate sign-out) returns 200', `got ${firstSignOut.status}`);

    const afterFirst = await getTokensValidAfterTime(fixture.uid);
    r.check(
      afterFirst !== null && afterFirst !== beforeAny,
      'first DELETE actually revoked — tokensValidAfterTime changed (sanity check that revocation fires at all)',
      `before=${beforeAny} after=${afterFirst}`,
    );

    // Simulate the admin signing back in elsewhere (a fresh, unrelated session) — this
    // is the session the replay attack below is trying to kill. Minting it also proves
    // sign-in still works normally after a revoke, which it must.
    const freshSignIn = await postSession(fixture.idToken).catch(() => null);
    // idToken itself may be stale by now (Firebase ID tokens are short-lived); if this
    // particular re-mint fails for that reason it does not affect the assertion below,
    // which only cares about tokensValidAfterTime, not this fresh session's validity.
    void freshSignIn;

    // THE ATTACK: replay the SAME already-revoked cookie a second time. Must still
    // return 200 (constraint #1), but must NOT cause a second real revocation.
    const beforeReplay = afterFirst;
    const replaySignOut = await deleteSession(capturedCookie);
    r.check(
      replaySignOut.status === 200,
      'replayed DELETE with the already-revoked cookie STILL returns 200 (constraint #1: sign-out never fails, even for a broken/already-revoked session)',
      `got ${replaySignOut.status}`,
    );

    const afterReplay = await getTokensValidAfterTime(fixture.uid);
    r.check(
      afterReplay === beforeReplay,
      'replayed DELETE with the already-revoked cookie did NOT trigger a second revocation — tokensValidAfterTime is unchanged (this is the check that catches the checkRevoked-missing defect: on the current buggy code, this value changes AGAIN here, proving the stale cookie can still force-revoke the admin repeatedly)',
      `before-replay=${beforeReplay} after-replay=${afterReplay}`,
    );
  } finally {
    await deleteAllowlistedFixtureUser(fixture.uid);
  }
});

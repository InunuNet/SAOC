// R-UNCOND-01 — sign-out must ALWAYS succeed in clearing the cookie, even when there is
// no valid session to revoke. Design constraint #1: a user with an already-broken
// session (expired, malformed, or simply absent) must never be trapped signed-in
// because the endpoint tried to resolve a uid to revoke, failed, and let that failure
// propagate into a non-200 / non-clearing response.
//
// The false state this rules out: an implementation that does
//   const decoded = await verifySessionCookie(cookie);   // throws on bad input
//   await revokeRefreshTokens(decoded.uid);
//   cookies().set('session', '', { maxAge: 0 });          // never reached if the above throws
// with the cookie-clear folded INTO the same try block as the revoke attempt, instead
// of the revoke attempt being isolated so a failure there cannot skip the clear. A
// check that only ever presents a valid cookie would never observe this bug — every
// sub-case below deliberately presents a cookie the endpoint CANNOT resolve to a uid.

import { deleteSession, warmUp, runCheck } from './_shared.mjs';

await runCheck('R-UNCOND-01 sign-out clears the cookie unconditionally', async (r) => {
  await warmUp([{ path: '/api/admin/session', method: 'DELETE' }]);

  // (a) no cookie presented at all — the "already signed out" case.
  const noCookie = await deleteSession(null);
  r.check(noCookie.status === 200, '(a) DELETE with no session cookie still returns 200', `got ${noCookie.status}`);
  r.check(noCookie.clearsCookie, '(a) DELETE with no session cookie still clears the cookie', `Set-Cookie: ${noCookie.setCookie}`);

  // (b) syntactically-garbage cookie value — not a JWT at all, cannot be parsed.
  const garbage = await deleteSession('session=not-a-real-session-cookie-value');
  r.check(garbage.status === 200, '(b) DELETE with a garbage cookie value still returns 200', `got ${garbage.status}`);
  r.check(garbage.clearsCookie, '(b) DELETE with a garbage cookie value still clears the cookie', `Set-Cookie: ${garbage.setCookie}`);

  // (c) well-formed-looking but entirely fabricated JWT (three base64url segments,
  // correct shape, wrong/absent signature) — exercises the "parses far enough to look
  // real, then fails verification" path distinctly from outright garbage in (b).
  const fakeJwt =
    'session=eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2UifQ.eyJzdWIiOiJmYWtlIn0.' +
    'ZmFrZS1zaWduYXR1cmUtdGhhdC13aWxsLW5ldmVyLXZlcmlmeQ';
  const fakeJwtResult = await deleteSession(fakeJwt);
  r.check(fakeJwtResult.status === 200, '(c) DELETE with a well-formed-but-fake JWT still returns 200', `got ${fakeJwtResult.status}`);
  r.check(fakeJwtResult.clearsCookie, '(c) DELETE with a well-formed-but-fake JWT still clears the cookie', `Set-Cookie: ${fakeJwtResult.setCookie}`);
});

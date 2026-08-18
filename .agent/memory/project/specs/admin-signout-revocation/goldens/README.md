# admin-signout-revocation — golden spec

## The gap this closes

`app/api/admin/session/route.ts`'s `DELETE` handler signs an admin out by clearing the
`session` cookie (`maxAge: 0`, matching `httpOnly`/`secure`/`sameSite: strict`/`path`
attributes). It never calls Firebase Admin's `revokeRefreshTokens(uid)`. Sign-out
therefore only removes the cookie from the browser that clicked "Sign out" — a session
cookie exfiltrated before sign-out (XSS, a shared machine, a copied devtools value)
stays valid for its full ~5-day lifetime, and clicking sign-out does nothing to stop it.

The enforcement half already exists and needs no change: `lib/admin-auth.ts`'s
`getAdminSession()` calls `verifySessionCookie(sessionCookie, true)` — that second
argument is Firebase's `checkRevoked` flag — so revocation IS honoured on every request
already, proven behaviourally by `contracts/checks/admin-auth-hardening/
check-revoked-session-refused.mjs` (A-STATE-02) for the case where revocation is
triggered by an admin directly via the Admin SDK. Only the revoke call from the sign-out
endpoint itself is missing. This is a small, surgical addition to the existing `DELETE`
handler — no new route, no change to the fail-closed policy in `lib/admin-auth.ts`.

## Required behaviour

```
DELETE /api/admin/session
  1. Attempt to resolve a uid from the request's OWN 'session' cookie ONLY:
       - read the cookie via next/headers cookies()
       - if absent: no uid to resolve, skip to step 3
       - verify it with getAuth(initAdmin()).verifySessionCookie(cookie, true)
         — the SECOND argument, checkRevoked, MUST be true. See "Codex finding
         (2026-08-19)" below for why: `checkRevoked=false` (or omitted) lets an
         ALREADY-REVOKED cookie still resolve a uid and still trigger a second real
         revocation, turning an exfiltrated cookie into a repeatable
         force-sign-out-the-real-admin weapon that survives the admin signing back in
         elsewhere. This does NOT weaken constraint #1 — see that section.
       - if verification throws (malformed, expired, tampered, OR revoked): no uid to
         resolve, skip to step 3
  2. If a uid was resolved: call getAuth(initAdmin()).revokeRefreshTokens(uid).
       - if this throws: log a warning (operation, uid — never the token), swallow the
         error, continue to step 3 regardless. A revocation failure must NEVER turn
         into a failed sign-out from the caller's point of view.
  3. Unconditionally clear the 'session' cookie — same attributes already in place
     (httpOnly, secure, path: '/', sameSite: 'strict', maxAge: 0) — and return
     { status: 'ok' }, 200.
```

Step 1's uid resolution and step 2's revoke attempt MUST be isolated in their own
try/catch so that ANY failure in either — malformed cookie, expired cookie, Admin SDK
error, network error calling Firebase — falls through to step 3 rather than aborting the
response early. A user with an already-broken session must never be trapped signed-in
because the endpoint tried (and failed) to do the extra revocation work.

**The uid MUST come only from the request's own verified session cookie.** Never from a
request body field, a query parameter, or any other client-supplied input. `DELETE`
currently takes no body at all — it must stay that way, or if a body is ever accepted
for an unrelated reason, it must never be consulted for identity. This is what keeps
sign-out from becoming an unauthenticated denial-of-service primitive: revocation is
global for the target user (see below), so letting a caller name an arbitrary uid would
let anyone force-sign-out any admin, repeatedly, without ever authenticating as them.

## Codex finding (2026-08-19): checkRevoked must be true, and why constraint #1 survives it

Codex GPT-5.5's cross-model review of the first implementation against this contract
found a real defect at `app/api/admin/session/route.ts:82`: the `DELETE` handler
resolved its uid with `verifySessionCookie(existingCookie)` — **without** `checkRevoked`.
Firebase's default there is `false`, so an already-revoked cookie (one that has been
signed out once already, but has not yet naturally expired — up to its full ~5-day
life) still verifies successfully, still resolves a uid, and still triggers
`revokeRefreshTokens(uid)` again on every replay.

Consequence: an attacker who exfiltrated a cookie loses READ access the moment the real
admin signs out once (`getAdminSession()` already uses `checkRevoked=true`, proven by
`check-revoked-session-refused.mjs` in `admin-auth-hardening`) but KEEPS the power to
force-revoke that admin's account — including any FRESH session the admin signs into
afterward — repeatedly, on demand, for as long as the stolen cookie's underlying JWT
remains structurally valid. A passive stolen credential became an active,
indefinitely-repeatable denial-of-service weapon against the very account it was stolen
from.

**Why this slipped past the first assertion suite:** A1 proves the direction "a revoked
cookie can no longer READ" — the feature's own framing. Nobody had asserted anything
about the opposite direction an attacker actually cares about: "what can a holder of
this credential still cause to happen." A3 was adjacent (proves a caller can't name
someone ELSE's uid) but didn't cover a caller replaying their OWN already-revoked
credential against itself. This is a variant of this project's own previously-audited
"assertion satisfiable by something that isn't the real property" defect class, applied
in a new direction — see `feedback_contract_scoring_principles` for the general
principle. **Assertion A6 below closes this gap.**

**Why setting `checkRevoked=true` does NOT weaken constraint #1** (sign-out must always
succeed in clearing the cookie, even on an already-broken session): when
`verifySessionCookie(cookie, true)` throws — for ANY reason, including a cookie that
is malformed, expired, tampered, OR already revoked — the handler's step 1 simply fails
to resolve a uid. Per the try/catch isolation already required above, that failure
falls through to step 3 exactly like every other verification failure already does: no
revoke is attempted, the cookie is still cleared, the response is still `200`. A user
whose session was already revoked (by themselves, from another tab, or by an admin)
can still click "Sign out" and get a clean 200 with a cleared cookie — they just don't
trigger a second, redundant, and in the attacker's case dangerous, revocation.

## Deliberate design choice: revocation is global, not per-device

`revokeRefreshTokens(uid)` invalidates every refresh token issued to that uid before the
call — i.e. ALL of that user's sessions, on every device, not just the one that clicked
"Sign out". This is the correct behaviour for a security-hardening "sign me out" action
(it is what lets a compromised-cookie scenario actually be remediated by the legitimate
user signing out), but it is a deliberate, documented choice, not an incidental
side-effect to be discovered later by a committee member who gets logged out of their
phone because they signed out on their laptop. The implementation must carry a code
comment stating this plainly at the `revokeRefreshTokens` call site, and
`docs/admin-access.md` (or wherever sign-out is documented for committee members) should
say the same in plain language: "signing out ends your session everywhere, not just this
device."

## Fixture accounts (precondition — human/env action, not something a check can do)

The checks in `contracts/checks/admin-signout-revocation/` need real allowlisted
fixture accounts already present on the running server's `ADMIN_EMAIL_ALLOWLIST`
(read from that server PROCESS's env — no check script can add to it):

- `admin-auth-check-allowlisted@saoc.co.za` — already required by
  `admin-auth-hardening`; reused here for `check-signout-revokes-session.mjs` and
  `check-signout-clears-cookie-unconditionally.mjs` (the latter mostly doesn't need a
  real fixture at all, since its whole point is presenting cookies that can't resolve to
  any uid, but shares the warm-up target).
- `admin-signout-check-a@saoc.co.za` and `admin-signout-check-b@saoc.co.za` — **NEW**,
  needed only by `check-signout-ignores-crafted-uid.mjs`, which requires TWO distinct
  allowlisted identities to prove cross-user isolation. Override via
  `ADMIN_SIGNOUT_CHECK_FIXTURE_A_EMAIL` / `_B_EMAIL` env vars if different addresses are
  used. **Flagging this as something a human needs to add to `.env.local`'s
  `ADMIN_EMAIL_ALLOWLIST`** before the gate can go green — the orchestrator should add
  these two addresses (or point the env vars at two that already exist) before running
  this contract's assertions.

## Running the checks

Same server as `admin-auth-hardening`: a locally-built PRODUCTION server on port 3400,
started via `contracts/checks/admin-auth-hardening/server-ctl.sh start` and torn down
with `... stop`. This contract does NOT define its own server-ctl.sh — it reuses that
one directly, unmodified, since the server under test (the whole Next.js app) is
identical.

**Port-3400 / shared-.next lock hazard (do not skip this):** if any other agent's
server-ctl.sh run is mid-build or mid-serve on port 3400 when this contract's checks
try to start their own, they will race — see server-ctl.sh's own `acquire_lock`
mutex, which the checks in this contract rely on exactly as admin-auth-hardening's do.
Do not run `pnpm dev`, `pnpm build`, or any other server-ctl.sh invocation
concurrently against the same checkout while this contract's gate is running. The
orchestrator was explicitly told NOT to start any dev server on port 3400 while this
contract was being authored, for exactly this reason — the same caution applies when
actually running the gate later.

```
contracts/checks/admin-auth-hardening/server-ctl.sh start
node contracts/checks/admin-signout-revocation/check-signout-revokes-session.mjs
node contracts/checks/admin-signout-revocation/check-signout-clears-cookie-unconditionally.mjs
node contracts/checks/admin-signout-revocation/check-signout-ignores-crafted-uid.mjs
node contracts/checks/admin-signout-revocation/check-signout-replay-cannot-rerevoke.mjs
contracts/checks/admin-auth-hardening/server-ctl.sh stop
```

## Explicitly out of scope for this contract

- Re-verifying `lib/admin-auth.ts`'s fail-closed policy (`admin===true` +
  `email_verified===true` + live allowlist membership) — already covered exhaustively
  by `admin-auth-hardening`'s own checks (`check-fail-closed-states.mjs`,
  `check-probe-refused-everywhere.mjs`, etc.). This contract's A4/A5 assertions (see
  `contract-f1.yaml`) only confirm nothing about this change touches that gate — a doc
  comment recording the deliberate global-revocation choice, and a structural check that
  the `DELETE` handler still derives its uid from nowhere but its own verified cookie.
- The `POST` handler (login) — unchanged by this feature.

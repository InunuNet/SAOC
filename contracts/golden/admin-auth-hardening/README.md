# admin-auth-hardening — F1 + F2 (milestone M1)

Mission: `.agent/memory/project/missions/2026-08-14-admin-auth-hardening.md`. Premise
corrected 2026-08-14 against the live host — read the mission before this file if you
have not already.

## Measured baseline (2026-08-14, deployed host, freshly self-registered account)

| Surface | Before this contract | Must become |
|---|---|---|
| `accounts:signUp` (public web API key) | account created — self-signup open | unchanged in this contract (F3 handles signup policy) |
| `POST /api/admin/session` | **200, cookie ISSUED, no claim check** | 403, no cookie, for any non-allowlisted identity |
| `/api/admin/tickets` | 403 | still 403 (regression guard) |
| `/api/admin/export-csv` | 403 | still 403 (regression guard) |
| `/admin` | 307 → `/admin/login` | still 307 → `/admin/login` (regression guard) |
| **`/admin/door`** | **200, scanner UI renders unauthenticated** | 307 → `/admin/login` for anyone not gated |

Five of six surfaces already had the correct inline check
(`decodedToken.admin === true || (decodedToken as Record<string, unknown>)['role'] ===
'admin'`) at app/admin/page.tsx:24, app/api/admin/tickets/route.ts:25,
app/api/admin/checkin/route.ts:27, app/api/admin/export-csv/route.ts:32. This contract
does not change WHAT those checks decide — it changes WHERE the decision lives (one
shared helper) and adds the two things that were missing everywhere: the allowlist and
the door gate.

## What D5-04 got wrong, and what supersedes it

`contracts/contract-d5-admin-dashboard.yaml` assertion D5-04:

```
grep -Eqi "admin" app/admin/page.tsx && grep -Eqi "claim|role|verifySessionCookie|verifyIdToken" app/admin/page.tsx
```

This is satisfied by any file that mentions the word "admin" once and any of those four
words once, anywhere — a comment, an unrelated variable name, a heading. It cannot tell
a real authorisation decision from an incidental mention, and it passed the entire time
the session route was silently minting cookies for anyone.

This contract supersedes it two ways, both live in `A-STRUCT-01` below:
1. Structural: every one of the six admin surfaces imports `getAdminSession` (or
   `isAdminToken`, for the session-mint path) from `lib/admin-auth.ts`, and NONE of them
   contains its own inline `decodedToken.admin === true` / `['role'] === 'admin'` check
   any more — the decision has exactly one home, so a grep proving that is a real
   structural fact, not an incidental one.
2. Behavioural: `A-PROBE-*` and `A-ALLOW-*` below prove the decision itself is correct
   by executing it over real HTTP against a running server, not by reading source.

D5-04 should be treated as retired by this contract. It is not deleted here (out of
scope — belongs to whoever next touches contract-d5-admin-dashboard.yaml), but no
assertion in THIS contract relies on grep to prove an authorisation outcome; every
security-relevant claim is a real request/response.

## Design decisions made while writing this contract (flagged for @dev / team lead)

1. **Allowlist storage: `ADMIN_EMAIL_ALLOWLIST` env var**, comma-separated, lower-cased
   at comparison time, server-only (no `NEXT_PUBLIC_` prefix). Not Firestore, not
   hardcoded in source. Rationale: F3 (provisioning script + revocation) is a separate,
   not-yet-built feature; an env var is the smallest correct thing that lets F1/F2 ship
   now without inventing F3's storage model, and it is trivially readable by the
   provisioning script F3 will add. If F3 later moves this to Firestore for live
   revocation without a redeploy, `isEmailAllowlisted()` is the only function that
   changes — every caller goes through it.
2. **The allowlist is re-checked on every request, not just at claim-grant time.** A
   session cookie is valid for 5 days; if the allowlist check only happened when the
   custom claim was originally set, removing someone from the allowlist would not take
   effect until their cookie expired. `getAdminSession()` re-reads
   `ADMIN_EMAIL_ALLOWLIST` and re-checks the token's email against it on every call, so
   "claim present but email no longer allowlisted" fails closed immediately, not in up
   to 5 days. Revoking the underlying Firebase session (so a stolen/leaked cookie stops
   working immediately even for a still-allowlisted email) is explicitly F3 scope
   (`revokeRefreshTokens`) — not built here.
3. **Door gate shape: `app/admin/door/layout.tsx`**, not `app/admin/layout.tsx`. A
   layout at the `/admin` root would also wrap `/admin/login`, which must stay reachable
   unauthenticated — gating the root layout would either infinite-redirect or require an
   explicit pathname exception inside the layout. Scoping the layout to `/admin/door`
   only mirrors how `/admin/page.tsx` already gates itself inline, costs one file, and
   cannot touch the login page. `/admin/door/page.tsx` itself is unchanged — it stays a
   `'use client'` component; the layout wraps it and runs the server-side check before
   any client JS for the page ships.
4. **`email_verified` is now part of the admin policy**, not just the claim. This was
   not explicitly named as a gap in the mission brief but falls directly out of "fail
   closed on every unenumerated state": Firebase Identity Platform issues an unverified
   email address at signup by default, so without this check a self-registered account
   that somehow acquired the admin claim (e.g. a future bug in F3's grant script) would
   still pass. Kept as team-lead-approved policy (2026-08-14) — with a trap recorded
   below that F3 MUST close.

   **THE TRAP, for F3's handoff (do not lose this):** Firebase email/password signup
   does NOT set `email_verified` — not even for the project owner's own account,
   created the same way everyone else's is. That means the owner, once allowlisted, is
   STILL refused by this gate until something explicitly verifies their email, and the
   403 they get back looks identical to "not allowlisted" — there is nothing in the
   response that tells them which of the two walls they hit. Get this wrong and it
   locks out the only person who can fix it. F3's provisioning script MUST do ONE of:
   (a) call `updateUser(uid, { emailVerified: true })` via the Admin SDK as part of
   granting admin, or (b) drive a real Firebase email-verification flow before granting.
   Either way, F3 should also make the 403 response (or at minimum its server-side log
   line) distinguish `email-unverified` from `not-allowlisted` — `getAdminSession()`'s
   `reason` field already carries this distinction (see admin-auth-gate.golden.md); F3
   just needs to surface it somewhere an operator troubleshooting a lockout can see it,
   which this contract's scope (F1/F2) deliberately does not add a UI or log line for.
5. **What is deliberately OUT of scope for this contract** (F3/F4/F5/F6 territory,
   asserted nowhere below): disabling self-signup at the Identity Platform level,
   `revokeRefreshTokens` on removal, the grant/revoke provisioning script, `docs/admin-
   access.md`, and any sign-in provider other than email/password. The probe account
   used in `A-PROBE-*` is created via the same open self-signup path that exists today
   BECAUSE that is the attack this contract must prove is refused — closing self-signup
   is a separate, complementary control (F3), not a substitute for the allowlist gate.

## Fixture accounts this contract's checks create and destroy

Every account these checks create is deleted in the same run, in a `finally`, whether
assertions pass or fail. Nothing here leaves a standing privileged account:

- **Probe accounts** (`admin-auth-check-probe-<random>@saoc-contract-check.invalid`):
  created via `signUpProbeAccount()` — the same public `accounts:signUp` REST call an
  attacker would use — and removed via `deleteAccountByIdToken()` +
  `assertAccountGone()` (all in `_shared.mjs`). Never allowlisted, never granted the
  claim. Used by `A-PROBE-*` and `A-NEGCTL-01`.
- **Allowlisted fixture account**: requires the email
  `admin-auth-check-allowlisted@saoc.co.za` (or whatever value
  `ADMIN_AUTH_CHECK_ALLOWLISTED_EMAIL` is set to — see `_shared.mjs`) to already be
  present in the RUNNING SERVER's `ADMIN_EMAIL_ALLOWLIST`. This is a documented
  precondition (see `A-ALLOW-*` descriptions), not something the check can set itself,
  because the allowlist is read from the server process's env at request time and the
  check cannot alter that process's environment. The account under that email is
  created fresh by Admin SDK (`createUser` + `setCustomUserClaims({ admin: true })`),
  used once, and deleted (including the claim, by deleting the whole user) before the
  check exits. Having the address on the allowlist with no account behind it, or an
  account with no claim, grants nobody anything — the claim is what the provisioning
  script (F3, not built yet) would set out-of-band; the allowlist alone is inert.

## Confirming a deployed `ADMIN_EMAIL_ALLOWLIST` actually parsed

`ADMIN_EMAIL_ALLOWLIST` becomes a deployed secret (Secret Manager, via Firebase App
Hosting). This project has **four documented secret-corruption incidents**, every one
of them a value that moved between places without anyone verifying it still worked
once it arrived. A comma-separated allowlist is a textbook case for the same failure: a
stray trailing comma, an extra space, or a value lost during copy/paste can silently
yield an EMPTY parsed list — which then fails closed for every single email, including
the operator's own — and an empty allowlist looks EXACTLY like a correctly working gate
from the outside (every request gets a clean 403, indistinguishable from "you're
correctly not on the list").

Before trusting a deployment of the F1 fix, an operator MUST positively confirm the
deployed value parsed to a non-empty, correctly-split list — not just that the secret
exists in Secret Manager or that the deploy succeeded. Do this the same way
`A-ALLOW-01` proves it locally: attempt a real session mint for a known-allowlisted
identity and require 200 + cookie. A secret that exists but parsed wrong is
indistinguishable from a missing secret unless it is exercised end to end.
`lib/admin-auth.ts` (F1, not built yet) should also log the PARSED LENGTH of the
allowlist (never the values — see this project's rule against logging secrets) at
startup or first use, so `0` is visible in server logs as an unambiguous signal,
distinct from "the server hasn't picked up the new secret yet".

## Negative control — validates the harness, not the production code path

`A-NEGCTL-01` runs the identical probe-and-assert logic from `A-PROBE-01` against a
small standalone fixture server (`contracts/checks/admin-auth-hardening/_weakened-
fixture.mjs`) that intentionally reproduces the PRE-FIX `/api/admin/session` behaviour
(mints a cookie for any valid idToken, no allowlist check) — a small HAND-ROLLED
fixture, not the real application. It asserts the probe SUCCEEDS against that weakened
fixture — i.e. it proves the check logic is capable of reporting failure, not just
capable of reporting success. This does not touch or restart the real target server, so
it is safe to run in the same phase as everything else.

**What this does and does not prove.** `A-NEGCTL-01` validates the reusable
probe-and-assert HTTP logic in `_shared.mjs` that every behavioural check in this
contract calls. It does **not** exercise `app/api/admin/session/route.ts` or
`lib/admin-auth.ts` in either direction — vulnerable or fixed. A green `A-NEGCTL-01` is
not evidence that the real gate was exercised at all; that proof comes only from the
checks that target `BASE_URL` (`A-PROBE-01`, `A-ALLOW-01`, `A-STATE-01`, `A-STATE-02`,
`A-DOOR-01`, `A-REGRESS-01`). Do not read it as anything more than "the assertion logic
itself isn't the thing that's broken."

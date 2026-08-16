# D6 door check-in — hardened assertions (2026-08-16)

## Why this exists

An audit found D6's original D6-11/D6-12/D6-13/D6-16 assertions were grep-only — no
execution — on an admission-control route (`app/api/admin/checkin/route.ts`). **The
underlying code was verified sound before this rewrite**: it calls `getAdminSession()`
(`lib/admin-auth.ts:13`) before any Firestore access, and `isAdminToken()` there enforces
`admin===true`, `email_verified===true`, and live allowlist membership, fails closed on
every unenumerated state. **This is a detection-gap fix, not an incident.** Neither
`app/api/admin/checkin/route.ts`, `lib/admin-auth.ts`, nor `app/api/tickets/itn/route.ts`
were modified by this change (sha256-pinned, out of scope).

The gap: the old assertions would not have noticed a regression.

- **D6-11** ran `grep -q "get('session')" ... && grep -q "verifySessionCookie" ... &&
  grep -Eqi "admin|role" route.ts`. The `admin|role` grep is satisfied by the import
  path `@/lib/firebase-admin` alone — no admin-claim check required. A route that
  verifies a session cookie but never checks the admin claim, admitting any
  authenticated non-admin user at the door, would still pass.
- **D6-12** ran `grep -Eq "401|403" route.ts` — matches those digits anywhere, including
  a 403 returned only for an unrelated validation error.
- **D6-13** checked `.collection('tickets')` and `.where('bookingRef')` appear
  independently rather than wired together. **D6-16** checked the literals
  `checked-in` and `status` appear independently rather than that status is actually
  set.

## What changed

`contracts/contract-d6-door-checkin.yaml` D6-11/D6-12/D6-13/D6-16 now run real round
trips against a real isolated built server (reusing
`contracts/checks/admin-auth-hardening/server-ctl.sh`, same pattern
`contract-admin-auth-f3-provisioning.yaml`'s A-REVOKE-01 established) plus a real
Firestore ticket fixture and read-back, in `contracts/checks/d6-door-checkin/`:

| id | file | proves |
|----|------|--------|
| D6-11 | `check-nonadmin-refused.mjs` | A real, valid session cookie for an authenticated NON-admin user is refused 403; ticket unmutated. |
| D6-12 | `check-noauth-refused.mjs` | No cookie / invalid cookie → 401; ticket unmutated. |
| D6-13 | `check-admin-succeeds.mjs` | A genuine admin session succeeds 200, and the REAL Firestore document flips to `checked-in` with a real `checkedInAt`; a second scan of the same ticket is refused 409 (proves the write is real persisted state, not a stateless response). This is also the required positive control for D6-11/D6-12 — without it, a route refusing everyone unconditionally would satisfy both. |
| D6-16 | (covered by D6-13's read-back) | Kept as a cheap structural sanity check only; not load-bearing on its own. |

### Why D6-11 mints its own session cookie instead of reusing `/api/admin/session`

`app/api/admin/session/route.ts` enforces `isAdminToken()` at mint time — a non-admin
caller can never obtain a cookie through that route at all (proved by F1/F2's own
A-STATE-01). If D6-11 tried to get a "non-admin session" through that route, it could
never construct the exact input needed to test the checkin route's OWN claim check in
isolation — any regression that dropped the claim check from the checkin route alone
(but left the session-mint route's check intact) would go completely undetected, because
no non-admin caller could ever hold a syntactically valid cookie to test with.

`check-nonadmin-refused.mjs` therefore calls Admin SDK's `createSessionCookie()`
**directly** (`contracts/checks/d6-door-checkin/_shared.mjs`
`mintNonAdminSessionCookie()`) — the same call the session route itself makes, but
without that route's `isAdminToken()` gate — producing a session cookie that
`verifySessionCookie()` (what `getAdminSession()` calls) accepts without error. Only the
checkin route's own admin-claim check can refuse it. This is the precise shape of the
regression the audit named.

## Broken-variant evidence (2026-08-16)

Per the hardening requirement, every new assertion was proven to reject a deliberately
broken variant before being accepted:

1. Confirmed the OLD D6-11 grep (`get('session')` + `verifySessionCookie` +
   `admin|role`) **passes** against a scratch copy of the route with the admin-claim
   check stripped (the `@/lib/firebase-admin` import alone satisfies `admin|role`) —
   reproducing the audit's exact claim.
2. Ran all three new checks (`check-noauth-refused.mjs`, `check-nonadmin-refused.mjs`,
   `check-admin-succeeds.mjs`) against the real, sound code, on a real isolated built
   server (`server-ctl.sh start`, port 3400) — all three **PASS**.
3. Built a **broken variant** in an isolated scratch tree (`rsync`'d working tree, port
   3401, never touching the real repo or the pinned files): the checkin route was
   rewritten to call `verifySessionCookie()` and check for cookie presence, but **never
   check the admin custom claim** — exactly the regression the audit described.
4. Ran `check-nonadmin-refused.mjs` against the broken variant
   (`ADMIN_AUTH_CHECK_BASE_URL=http://127.0.0.1:3401`):

   ```
   PASS  a valid session cookie was minted for the non-admin fixture user
   FAIL  checkin is refused 403 for a valid session belonging to a non-admin user
         — got 200 — {"success":true,"ticket":{...,"status":"checked-in",...}}
   FAIL  the ticket was NOT mutated by the refused non-admin request
         — status=checked-in, checkedInAt={"_seconds":...}
   FAIL: D6-11 non-admin authenticated session is refused at the door
   ```

   Exit code 1 — the new assertion catches the regression the old one missed. The
   fixture ticket and fixture auth user created during this run were cleaned up by the
   check's own `finally` block; residue was independently confirmed zero afterward
   (0 matching Firestore ticket docs).
5. Scratch tree, its copied `.env.local`, and the broken-variant server (port 3401) were
   torn down. The real repo's `app/api/admin/checkin/route.ts` was never modified.

## CI vs local-only

Every check above needs `.env.local` (or CI-equivalent secrets):
`FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`,
`NEXT_PUBLIC_FIREBASE_API_KEY`, and `ADMIN_EMAIL_ALLOWLIST` containing
`admin-auth-check-allowlisted@saoc.co.za` (the same fixture email
`contract-admin-auth-hardening.yaml` and `contract-admin-auth-f3-provisioning.yaml`
already depend on — no new secret, reuses the existing one).

**Currently LOCAL-ONLY**: these secrets exist in this developer's `.env.local` but are
not yet confirmed present in this repo's CI secret store. If CI does not have them, D6
would fail loudly at `D6-SERVER-START` / the first `loadEnvOrFail()` call — a visible
`FAIL`, never a silent green — rather than skip. **Outstanding human action for Brad**:
confirm whether CI has `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` /
`FIREBASE_ADMIN_PRIVATE_KEY` / `NEXT_PUBLIC_FIREBASE_API_KEY` / `ADMIN_EMAIL_ALLOWLIST`
provisioned as CI secrets (the same question already open for
`contract-admin-auth-f3-provisioning.yaml`'s A-REVOKE-01 — not a new gap introduced
here). If not, either provision them or mark D6-11/D6-12/D6-13/D6-SERVER-START/
D6-STOP-SERVER as local-only/manual-run in whatever runs the gate in CI, with a visible
`::warning::`, never a silent skip.

No real admin account was created or promoted by this work. No session cookie, token, or
credential material was printed at any point — only booleans, HTTP status codes, and a
scoped Firestore document snapshot from the check's OWN sentinel-marked fixture ticket
(never real attendee data).

# Provisioning scripts — golden spec

Three scripts, all run via `pnpm exec tsx scripts/<name>.ts`, all using the Firebase Admin SDK
(never the client SDK), all loading credentials from `.env.local` via `dotenv`, matching the
existing pattern in `scripts/backfill-award-fields.ts`. None of the three ever prints
`FIREBASE_ADMIN_PRIVATE_KEY`, any full `process.env` dump, or any value read from
`ADMIN_EMAIL_ALLOWLIST`.

Required env (all three): `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
`FIREBASE_ADMIN_PRIVATE_KEY`. Missing any of these must fail fast with a clear message naming
the missing variable, not a raw Admin SDK stack trace.

## `scripts/admin-grant.ts <email>`

**Usage:** `pnpm exec tsx scripts/admin-grant.ts someone@example.com`

- No `<email>` argument → print usage and exit `1`. Do not throw an unhandled exception.
- Look up the user by email (`auth.getUserByEmail`). If not found, create it
  (`auth.createUser({ email, password: <random, never logged> })`) — must succeed even when
  Identity Platform self-signup is disabled at the console level, because Admin SDK user
  creation is a separate, always-available path. This is deliberate: F3 also recommends
  disabling self-signup, and grant must keep working after that.
- Set `{ admin: true }` as the sole custom claim (`auth.setCustomUserClaims`) — replaces
  whatever claim object was there before, it does not merge, so a stray old claim can never
  linger silently.
- Set `emailVerified: true` (`auth.updateUser`) — unconditionally, every run, whether the user
  was just created or already existed. This closes the documented lockout trap: Firebase
  email/password signup does not verify email by default, and a claimed-but-unverified admin
  is refused by `lib/admin-auth.ts` with a 403 indistinguishable from "not allowlisted."
- If the user was newly created, print a **one-time password reset link**
  (`auth.generatePasswordResetLink(email)`) to stdout, clearly labelled as sensitive and
  single-use, for the operator to hand to the new admin over a secure out-of-band channel
  (Signal, a phone call — never email in the clear, never committed anywhere). If the user
  already existed, do not print a reset link — an existing admin's password is not this
  script's business.
- Print, every run, a reminder in this shape (exact wording not load-bearing, the reminder
  itself is): that `<email>` must also be added to `ADMIN_EMAIL_ALLOWLIST` in the deployed
  environment, and that the script cannot do this because it is a live env var on the server
  process, not a record this script's credentials reach.
- **Idempotent**: running twice on the same email does not error, does not create a second
  user, does not reset an existing user's password, and leaves the same end state
  (`admin: true`, `emailVerified: true`).
- Exit `0` on success, non-zero on any Admin SDK failure, with the underlying error message
  printed (not swallowed).

## `scripts/admin-revoke.ts <email>`

**Usage:** `pnpm exec tsx scripts/admin-revoke.ts someone@example.com`

- No `<email>` argument → print usage and exit `1`.
- Look up the user by email. **Not found → print a clear "no such account, nothing to
  revoke" message and exit `0`** — this must never be a hard failure; revoking someone
  already gone is a normal, safe no-op, and an operator removing a committee member under
  time pressure must not be blocked by it.
- If found: set `{ admin: false }` as the custom claim (`auth.setCustomUserClaims`) — an
  explicit `false`, not claim removal, so a readback shows a deliberate revoke rather than an
  ambiguous "never had one."
- Call `auth.revokeRefreshTokens(uid)` — this is the call that makes every session cookie
  issued before this moment fail on its very next use, because `lib/admin-auth.ts` calls
  `verifySessionCookie(cookie, true)` with `checkRevoked` already `true` (confirmed correct,
  not touched by this feature — see `contracts/checks/admin-auth-hardening/check-revoked-
  session-refused.mjs`).
- Read back the user record after both mutations (`auth.getUser(uid)`) and print
  `tokensValidAfterTime` — positive confirmation the revoke landed, not a trust-the-exit-code
  claim.
- Print the same allowlist reminder as grant, in the other direction: `<email>` should also be
  removed from `ADMIN_EMAIL_ALLOWLIST` as defence in depth.
- **Idempotent**: running twice on the same already-revoked email does not error.
- Exit `0` on success (including the "nothing to revoke" case), non-zero only on an actual
  Admin SDK failure with the account present.

## `scripts/admin-list.ts` (no arguments)

**Usage:** `pnpm exec tsx scripts/admin-list.ts`

- Lists every Firebase Auth user currently holding `admin === true` as a custom claim: email,
  uid, `emailVerified`, `tokensValidAfterTime`. Read-only — makes no mutation of any kind.
- If no users hold the claim, prints a clear "no admins currently provisioned" line, not an
  empty table with no explanation — the zero-account state is the project's actual current
  state and must read as expected, not broken.
- Exit `0` always, unless the Admin SDK connection itself fails (missing/invalid credentials).

## What none of the three scripts may ever do

- Import or call anything from `firebase/auth` (client SDK) — Admin SDK only, per this
  project's existing rule that Admin SDK never ships to the browser; these are Node CLI
  scripts so the risk is different, but the convention (Admin SDK = `firebase-admin/auth`,
  imported only in server-side code) still applies for consistency and to avoid a copy-paste
  mistake into a client file later.
- `console.log` (or any logging call) the value of `FIREBASE_ADMIN_PRIVATE_KEY`,
  `ADMIN_EMAIL_ALLOWLIST`, or a full `process.env` object.
- Delete a Firebase Auth user. Neither grant nor revoke ever calls `auth.deleteUser` — revoke
  removes admin capability, it does not remove the person's account, which may still need to
  sign in as a non-admin or be re-granted later without losing their uid/history.

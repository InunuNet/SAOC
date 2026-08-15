# Provisioning scripts — golden spec

Three scripts, all run via `pnpm exec tsx scripts/<name>.ts`, all using the Firebase Admin SDK
(never the client SDK), all loading credentials from `.env.local` via `dotenv`, matching the
existing pattern in `scripts/backfill-award-fields.ts`. None of the three ever prints
`FIREBASE_ADMIN_PRIVATE_KEY`, any full `process.env` dump, or any value read from
`ADMIN_EMAIL_ALLOWLIST`.

Required env (all three): `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
`FIREBASE_ADMIN_PRIVATE_KEY`. Missing any of these must fail fast with a clear message naming
the missing variable, not a raw Admin SDK stack trace.

## `scripts/admin-grant.ts <email> [--existing]`

**Usage:** `pnpm exec tsx scripts/admin-grant.ts someone@example.com [--existing]`

### Why the `--existing` flag exists (read before touching this section)

Self-signup via `identitytoolkit.googleapis.com/v1/accounts:signUp` is still open in this
project (F1/F2's own `check-probe-refused-everywhere.mjs` exercises it as proof; closing it is
a documented, unperformed console step — see "Disabling self-signup" in `docs/admin-access.md`).
Before this script existed, an open signup endpoint was harmless: nothing in the repo could
ever set `admin: true`, so a self-registered account was permanently inert. This script is the
**first** code in the project that can promote an arbitrary existing account. That makes
account **pre-registration / pre-hijacking** a live attack: someone self-registers
`real-person@saoc.co.za` ahead of the real person, the account sits inert, and later an
operator runs `admin-grant.ts real-person@saoc.co.za` meaning to onboard the real person —
finding the attacker's account instead. The design below exists specifically to make that
attack loud and to deny it the one payoff it needs (a verified email on an account it does not
control).

### Behaviour

- No `<email>` argument → print usage and exit `1`. Do not throw an unhandled exception.
- Look up the user by email (`auth.getUserByEmail`).
- **Not found (fresh account) →** create it
  (`auth.createUser({ email, password: <random, never logged> })`) — must succeed even when
  Identity Platform self-signup is disabled at the console level, because Admin SDK user
  creation is a separate, always-available path. Set `{ admin: true }` as the sole custom claim
  (`auth.setCustomUserClaims` — replaces whatever was there before, never merges). Set
  `emailVerified: true` (`auth.updateUser`) — unconditional, because the operator's own
  credentialed Admin SDK call IS the assertion that the address is real; this closes the
  documented lockout trap where an unverified admin is refused with a 403 indistinguishable
  from "not allowlisted." Print a **one-time password reset link**
  (`auth.generatePasswordResetLink(email)`), clearly labelled sensitive and single-use, for the
  operator to hand to the new admin over a secure out-of-band channel (Signal, a phone call —
  never email in the clear, never committed anywhere, and **never redirect this script's
  stdout to a file or run it under anything that persists output** — the link is usable by
  whoever reads it later, not just the intended recipient).
- **Found (pre-existing account) →** before any mutation, print the account's **provenance**:
  email, uid, `creationTime`, the provider IDs from `providerData` (e.g. `password`,
  `google.com`), and the current `emailVerified` value. This prints unconditionally, whether or
  not `--existing` was passed, so an operator who ran the bare command without realising the
  account already existed still sees exactly what they almost touched.
  - **`--existing` NOT passed** → make **no mutation of any kind** (no `setCustomUserClaims`,
    no `updateUser`, no `generatePasswordResetLink`). Print a clear refusal explaining that
    granting onto a pre-existing account requires re-running with the explicit `--existing`
    flag, after the operator has reviewed the provenance just printed. Exit non-zero (`1`).
    This is not a hard failure in the "something broke" sense — it is a deliberate stop asking
    for informed human confirmation, and must read as such in the message.
  - **`--existing` passed** → set `{ admin: true }` as the sole custom claim. **Do NOT call
    `auth.updateUser(uid, { emailVerified: true })` — leave `emailVerified` exactly as found.**
    This is the load-bearing fix: the script must never be able to flip a stranger's unverified
    email to verified out from under them. If the account happens to already be
    `emailVerified: true` (e.g. it was itself created by an earlier `admin-grant.ts` run, or is
    a real, previously-verified account), it stays true — nothing here can accidentally
    unverify it either; the field is simply never written on this branch. Never print a
    password reset link on this branch — an existing account's password is not this script's
    business, and generating a reset link for an account of unknown provenance would itself be
    a hijacking primitive. Print a loud, unambiguous confirmation that this ran against a
    PRE-EXISTING account (repeat the uid and provenance), never phrased as if it were an
    ordinary fresh grant.
- Print, every run that reaches it (i.e. not the refused-without-`--existing` case), a reminder
  in this shape (exact wording not load-bearing, the reminder itself is): that `<email>` must
  also be added to `ADMIN_EMAIL_ALLOWLIST` in the deployed environment, and that the script
  cannot do this because it is a live env var on the server process, not a record this script's
  credentials reach.
- **Idempotent**: running the same command twice — including `--existing` twice on the same
  already-granted email — does not error, does not create a second user, does not reset an
  existing user's password, and leaves the same end state (`admin: true`, `emailVerified`
  unchanged from whatever it already was). Note the practical consequence: because the script
  is stateless and cannot remember it created an account in an earlier invocation, granting
  admin a *second* time on ANY email — even one this same script created moments ago — takes
  the pre-existing-account branch and requires `--existing` again. This is intentional: the
  script has no reliable way to distinguish "an account I created" from "an account someone
  else created since," so it applies the same deliberate-confirmation rule uniformly rather
  than trusting an unverifiable assumption.
- Exit `0` on success, non-zero on: missing email argument, a pre-existing account without
  `--existing`, or any Admin SDK failure, with the underlying error message printed (not
  swallowed).

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

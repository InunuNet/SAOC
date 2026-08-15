# admin-auth-f3-provisioning — F3 (milestone M1)

Mission: `.agent/memory/project/missions/2026-08-14-admin-auth-hardening.md`, feature F3.
Sibling contract to `contracts/contract-admin-auth-hardening.yaml` (F1+F2, already green) —
read that contract's own `README.md` first if you have not already; this one assumes it.

## What F1/F2 already proved, that F3 builds on rather than re-proves

`checkRevoked` is already wired through correctly in both places that matter:
- `lib/admin-auth.ts`: `verifySessionCookie(sessionCookie, true)`
- `app/api/admin/session/route.ts`: `verifyIdToken(idToken, true)`

F1/F2's own `A-STATE-02` already proves, over real HTTP, that `revokeRefreshTokens()` makes a
live session cookie fail immediately. **This is not a defect F3 fixes.** What F3 adds:

1. A named, repeatable **script** (`scripts/admin-grant.ts`, `scripts/admin-revoke.ts`,
   `scripts/admin-list.ts`) — F1/F2 proved the underlying Admin SDK primitive works; nothing
   before F3 wraps it in something an operator can actually run by name.
2. Independent proof that the **script**, not a test helper calling the Admin SDK directly,
   produces the same effect end to end (`A-REVOKE-01`).
3. `docs/admin-access.md` extended with grant/revoke/verify procedure and the self-signup
   defence-in-depth note.

Full reasoning: `.agent/memory/scratch/f3-architect-plan.md`.

## Design decisions

1. **Grant creates the account if it doesn't exist**, via Admin SDK (`auth.createUser`), not
   via the public self-signup flow. This is deliberate: F3 recommends disabling self-signup at
   the console level as defence in depth, and provisioning must keep working once that's done.
   Admin SDK user creation is a separate code path from `accounts:signUp` and is unaffected by
   the Identity Platform "restrict account creation" setting.
2. **Revoke clears the claim (`admin: false`) AND revokes refresh tokens**, not one or the
   other. Claim clearing stops a *new* session mint (a freshly minted idToken carries the
   current claim); token revocation stops an *already-open* session immediately rather than
   waiting for its natural 5-day expiry. Both are asserted independently in `A-REVOKE-01`.
3. **Revoke never deletes the Firebase Auth user.** Removing admin capability and removing the
   account are different operations; conflating them would make revoke unnecessarily
   destructive and would lose the uid if the person is later re-granted.
4. **Self-signup disabling is documented, not scripted.** The classic Firebase Authentication
   console toggle for the Email/Password provider disables sign-up and sign-in together, which
   would break the admin login page itself. The setting that actually separates the two lives
   in the Google Cloud Identity Platform console, one level up, and neither `firebase-admin`
   nor `firebase-tools` expose a documented, stable API for it as of this project's pinned
   dependency versions. Scripting an uncertain call against an under-documented surface risks
   a silent no-op — this project has direct history of exactly that failure shape (see
   `docs/secret-corruption-incidents.md`) — so this stays a documented console step,
   `A-DOCS-01` verifies the documentation says so plainly, and it is explicitly NOT treated as
   equivalent to a passing security assertion.
5. **A dedicated fixture email**, `ADMIN_AUTH_F3_CHECK_ALLOWLISTED_EMAIL` (default
   `admin-auth-f3-check-allowlisted@saoc.co.za`), separate from F1/F2's
   `ADMIN_AUTH_CHECK_ALLOWLISTED_EMAIL` (`admin-auth-check-allowlisted@saoc.co.za`). Both
   contracts' checks create and delete Firebase Auth users under their own fixture email in a
   `finally`; sharing one address risks one contract's cleanup racing another's in-progress use
   if both run concurrently, which is a real possibility on this project (multiple agents active
   in one session). **Both addresses must be present in the running server's
   `ADMIN_EMAIL_ALLOWLIST`** for both contracts' full suites to pass.

## Design decisions (amendment, 2026-08-15)

6. **`admin-grant.ts` never sets `emailVerified: true` on an account it did not create, and
   requires an explicit `--existing` flag to act on a pre-existing account at all.** Found by
   adversarial QA against the original spec, which required `emailVerified: true`
   unconditionally on every run. That was a pre-registration/pre-hijacking hole: self-signup
   (`accounts:signUp`) is still open in this project, and `admin-grant.ts` is the first code
   able to promote an arbitrary existing account. An attacker who self-registers the real
   admin's email ahead of time would previously have received a fully verified admin account
   the moment an operator ran the onboarding script. F1's gate already refuses an unverified
   claim (`email-unverified`), so simply never verifying an email the script didn't itself
   create keeps a self-registered squatter refused by a check that already exists — see
   `provisioning-scripts.golden.md`'s "Why the `--existing` flag exists" for the full reasoning.
   A consequence worth calling out: because the script is stateless, this applies even to
   re-granting an account the script itself created moments earlier (A-GRANT-01's second run
   now passes `--existing`) — there is no reliable way for the script to distinguish that case
   from an attacker's account, so it treats both the same.

## Fixture accounts this contract's checks create and destroy

- **Grant/idempotency fixture**: a fresh, never-before-seen email
  (`admin-auth-f3-check-grant-<random>@saoc-contract-check.invalid`) — created BY the grant
  script under test (not pre-created by the check), granted, re-granted with `--existing`
  (idempotency), read back via Admin SDK, then deleted via `auth.deleteUser` in a `finally`.
- **Pre-existing-account fixture** (A-GRANT-02, A-GRANT-03): a fresh email
  (`admin-auth-f3-check-preexisting-<random>@saoc-contract-check.invalid`) created directly via
  the Admin SDK by the check itself (`password` provider, `emailVerified: false`) — deliberately
  NOT via the grant script, to look like a self-registered squatter's account. A-GRANT-02 proves
  `admin-grant.ts` refuses it without `--existing`; A-GRANT-03 proves granting it with
  `--existing` sets the claim but never flips `emailVerified`. Deleted via `auth.deleteUser` in
  a `finally` in both checks.
- **Revoke end-to-end fixture**: `ADMIN_AUTH_F3_CHECK_ALLOWLISTED_EMAIL` — granted by the grant
  script, used to mint a real session cookie over real HTTP, revoked by the revoke script,
  proven refused, then deleted via `auth.deleteUser` in a `finally`. Requires the allowlist
  precondition above.
- **Revoke-idempotency fixture**: a never-created, `.invalid`-TLD email — no account exists,
  proving the revoke script's not-found path exits `0` without ever creating anything to clean
  up.

Nothing here leaves a standing privileged account, matching the convention F1/F2 established.

## Server under test

Reuses `contracts/checks/admin-auth-hardening/server-ctl.sh` directly (relative path
`../admin-auth-hardening/server-ctl.sh`) rather than duplicating the rsync/build/start logic —
same isolated scratch build on `http://127.0.0.1:3400`, same exclusive lock across concurrent
invocations. `ADMIN_AUTH_CHECK_BASE_URL` overrides the target exactly as it does for F1/F2, and
this contract's own checks read the SAME env var name for consistency (see `_shared.mjs`).

## What is deliberately out of scope here

Google/Microsoft/Apple sign-in (F4/F5), the human end-to-end door-scanner proof (F6), and
actually flipping the Identity Platform "restrict account creation" setting on the live console
(documented, not performed or asserted by this contract — a console mutation is not something a
contract check should perform unattended on a shared cloud project).

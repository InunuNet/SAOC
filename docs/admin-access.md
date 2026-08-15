# Admin access — authorisation gate

**Code:** [`lib/admin-auth.ts`](../lib/admin-auth.ts) — the single home for the admin
authorisation decision. Six surfaces call it; nothing else decides who is an admin.
**Contract:** [`contracts/contract-admin-auth-hardening.yaml`](../contracts/contract-admin-auth-hardening.yaml),
mission `admin-auth-hardening`, features F1+F2. Golden spec:
[`contracts/golden/admin-auth-hardening/admin-auth-gate.golden.md`](../contracts/golden/admin-auth-hardening/admin-auth-gate.golden.md).

## What the gate does, and why it exists

Before this work, `POST /api/admin/session` minted a session cookie for **any** valid
Firebase idToken — no claim check — and `/admin/door` rendered the door-scanner UI to
anyone who hit the URL, unauthenticated. Both were confirmed exploitable. This gate
closes both holes by giving every admin-facing surface one shared, allowlist-backed
decision instead of six separate (and previously inconsistent) checks.

## The policy

A caller is an admin if, and only if, **all three** hold, re-checked on every request:

1. The decoded Firebase ID token / session cookie carries `admin === true` as a custom
   claim (strict boolean check — there is no `role` claim fallback; nothing in this repo
   ever sets a `role` claim, so that branch was dead attack surface and was removed).
2. `email_verified === true` on that same token.
3. The token's email is a live member of `ADMIN_EMAIL_ALLOWLIST` (comma-separated env
   var), lower-cased and trimmed, checked against the **current** value of the env var at
   request time — not cached, not baked in at claim-mint time.

Anything not covered by this — missing claim, malformed token, no session cookie,
expired/revoked session — **fails closed**. There is no default-allow branch anywhere in
`lib/admin-auth.ts`.

### Where it's enforced

| Surface | How |
|---|---|
| `app/admin/page.tsx` | `getAdminSession()`; redirects to `/admin/login` on any non-ok result |
| `app/admin/door/layout.tsx` | Server-component layout gating the `/admin/door` subtree only (see below) |
| `app/api/admin/session/route.ts` | `isAdminToken()` — refuses to mint a cookie for a non-allowlisted identity |
| `app/api/admin/tickets/route.ts` | `getAdminSession()` — 401 for no/invalid session, 403 for every other refusal |
| `app/api/admin/checkin/route.ts` | Same pattern; auth runs before anything is read from or written to Firestore |
| `app/api/admin/export-csv/route.ts` | Same pattern |

`/admin/door` is gated by its own `layout.tsx`, scoped to that route subtree — not by
gating `/admin` itself, because `/admin` also has to serve `/admin/login`, and gating the
login route would brick sign-in entirely.

### `/admin/login` is deliberately ungated

`app/admin/login/page.tsx` has no server-side gate in front of it. This is intentional,
not an oversight: the login page is how a session cookie gets minted in the first place,
so gating it would make it impossible to ever sign in. It's safe to leave open because it
does nothing privileged by itself — it only calls Firebase client-side sign-in and then
`POST /api/admin/session`, which is the surface that actually enforces the policy above.

## Reading the `reason` field when debugging

`getAdminSession()` never throws. On refusal it returns one of:

| `reason` | Meaning |
|---|---|
| `no-session` | No `session` cookie present on the request |
| `invalid-session` | Cookie present but failed `verifySessionCookie` (expired, revoked, malformed) |
| `no-claim` | Session verified, but `admin` custom claim is not `true` |
| `email-unverified` | `admin` claim is `true`, but `email_verified` is not `true` |
| `not-allowlisted` | Claim and verification both pass, but the email isn't (currently) in `ADMIN_EMAIL_ALLOWLIST` |

`no-session` / `invalid-session` map to HTTP 401 on the API routes; the other three map
to 403. All five look like an undifferentiated "you can't in" from outside — the `reason`
is what actually tells you which precondition failed, so check it (server logs / debugger)
before assuming the allowlist or the claim is wrong.

## Traps that will cost you a day if you don't know about them

### 1. The lockout trap — email/password signup does not verify email

Firebase's standard email/password `createUserWithEmailAndPassword` flow does **not**
set `email_verified: true`. An admin account created that way will be refused with
`reason: 'email-unverified'` even if it correctly holds the `admin` claim and is on the
allowlist — and from outside, that refusal looks identical to "not allowlisted." When
provisioning an admin account, either set `emailVerified: true` explicitly via the
Firebase Admin SDK (`getAuth().updateUser(uid, { emailVerified: true })`) or drive a real
email-verification flow. Don't assume "I set the custom claim" is enough.

### 2. The empty-allowlist trap — a parsing failure is invisible from outside

`ADMIN_EMAIL_ALLOWLIST` is a comma-separated string. A stray comma, whitespace, or a
value that didn't actually land in the deployed environment produces an **empty** parsed
list, which fails closed for every single identity — including a correctly provisioned
admin — and looks, from outside, exactly like a gate that's simply working as intended
(everyone gets refused). `lib/admin-auth.ts` logs the parsed allowlist **length only**
(never the values — see the project's no-secrets-in-logs rule) once per server process:

```
[admin-auth] ADMIN_EMAIL_ALLOWLIST parsed length: 0
```

A `0` there is the unambiguous signal. This project has four prior documented
secret-corruption incidents, all from a value being moved or copied without anyone
verifying it still functioned afterwards — see
[`docs/secret-corruption-incidents.md`](secret-corruption-incidents.md). The lesson
applies directly here: **after setting or changing `ADMIN_EMAIL_ALLOWLIST` on any
deployed host, confirm it by actually signing in as an allowlisted identity and reaching
`/admin`.** Confirming the secret exists in Secret Manager / the env is not sufficient —
it doesn't tell you the value parsed into a non-empty list, still less that the value is
correct.

### 3. `ADMIN_EMAIL_ALLOWLIST` is not currently set on the deployed host

As of this writing, the deployed environment has no `ADMIN_EMAIL_ALLOWLIST` value, so
`/admin` currently refuses **everyone**, with no exceptions. This is expected and
correct, not a bug to chase — it's the fail-closed default behaving exactly as designed.
It will start working once provisioning (mission `admin-auth-hardening`, feature F3)
lands and sets a real allowlist against a real admin identity.

Relatedly: this project currently has **zero** Firebase Auth accounts and zero `admin`
custom claims anywhere. Nobody — allowlisted or not — can reach `/admin` today, because
there is no account for the allowlist check to ever reach. That's also F3's job.

## Running the contract gate

```bash
bash contracts/checks/admin-auth-hardening/server-ctl.sh start
# ... contract.py runs the checks in contracts/checks/admin-auth-hardening/ ...
bash contracts/checks/admin-auth-hardening/server-ctl.sh stop
```

`start` rsyncs the current working tree (including uncommitted changes — that's
deliberately what gets tested, never a stale committed snapshot) into an isolated
scratch directory, runs `pnpm install --frozen-lockfile` and `pnpm build` there, and
brings up a production server on `http://127.0.0.1:3400`, isolated from anything else
running in this checkout (in particular, from `pnpm dev:secure` on port 3333). `stop`
tears the scratch server and directory down.

The script holds an **exclusive lock** across concurrent invocations (this project runs
many agents at once, and two unsynchronised `start`s racing on the same fixed port/pidfile
previously produced failures that looked like security defects but weren't). If it
reports another run already holds the lock/port, **wait for it to finish rather than
killing it** — killing a concurrent run can leave the lock directory or scratch build in
a state the next `start` has to clean up by hand.

Preconditions the gate cannot supply itself — see the contract YAML's own header comment
for the full detail:
- `.env.local` at the repo root with the Firebase client/admin credentials.
- `ADMIN_EMAIL_ALLOWLIST` in that same `.env.local` including the check's fixture email
  (default `admin-auth-check-allowlisted@saoc.co.za`). Missing this makes several checks
  fail with a 403 that is indistinguishable from a real gate defect — this is the same
  trap as #2 above, just hitting the contract's own fixture instead of a real admin.

## Who may hold admin

Admin access is reserved for SAOC committee members who have an operational need to use the admin panel — for door check-in during a national show or to export ticket records. Admin is granted per person, never per role or device. No shared logins. Each account must have a named individual owner.

## Granting admin access

To grant admin access to an email address, run:

```bash
pnpm exec tsx scripts/admin-grant.ts <email> [--existing]
```

The script performs two actions:
1. **Grant the claim** (automatic): sets the `admin: true` custom claim, creates the Firebase Auth account if it does not exist yet (via the Admin SDK, which stays available even after self-signup is disabled at the console level), and on a fresh account, marks the email as verified and prints a one-time password-reset link.
2. **Add the email to `ADMIN_EMAIL_ALLOWLIST`** (manual, separate step): the script cannot do this itself — `ADMIN_EMAIL_ALLOWLIST` is a live environment variable read by the running server process, not a record these credentials can reach. On the deployed server, add the email to Secret Manager's `ADMIN_EMAIL_ALLOWLIST` value. On your local dev environment, add it to `.env.local`.

**Both steps are required.** The script alone leaves the account unable to reach `/admin`. See the "empty-allowlist trap" section above for how to verify the allowlist was actually updated.

### Fresh accounts (script creates the account)

If no account exists for the email, the script creates it via the Admin SDK, sets the `admin` claim, marks the email verified, and prints a one-time password-reset link. Hand this link to the new admin over a secure out-of-band channel (Signal, a phone call — never email in the clear, never commit or paste it anywhere persistent).

Do not redirect this script's stdout to a file or run it under anything that logs or persists output — the one-time password reset link printed by the script is usable by whoever reads it later, not just the intended recipient.

### Pre-existing accounts: the `--existing` flag

Self-signup being left open makes `scripts/admin-grant.ts` **dangerous against pre-existing accounts**. Because the public signup endpoint (`accounts:signUp`) is still reachable on this project (see "Disabling self-signup" below), an email you intend to grant may already belong to someone else's self-registered account. An attacker could pre-register the real admin's email address and sit on it.

When you run the script against a pre-existing account **without** the `--existing` flag:
- The script prints the account's provenance: its uid, `creationTime`, provider IDs, and current `emailVerified` status.
- The script **refuses to mutate anything** — the account is left exactly as found.
- The script exits with an error.

Before re-running **with** the `--existing` flag, you **must** review that provenance and confirm it looks like the intended person. Check when the account was created (`creationTime`) against when this person actually asked for access — if a pre-existing account was created weeks ago and the person only just requested access now, that's a red flag.

When you pass `--existing`, the script sets the `admin` claim on the pre-existing account but **never** sets `emailVerified: true`. An unverified self-registered account stays unverified, which means it remains refused by `lib/admin-auth.ts` (which requires `email_verified === true`), even though it now holds the `admin` claim. This keeps a self-registered squatter who somehow got the real person's email locked out despite being promoted, until the person themselves can verify the account through a legitimate email verification flow or the admin sets it manually after independently confirming they control that mailbox.

## Revoking admin access

To revoke admin access from an email address, run:

```bash
pnpm exec tsx scripts/admin-revoke.ts <email>
```

The script performs two actions:
1. **Revoke the claim and sessions** (automatic and immediate): sets the `admin` custom claim to an explicit `false` (not removal — a readback shows a deliberate revoke, not an ambiguous "never had one") and calls `revokeRefreshTokens()`, which terminates any existing session cookie immediately. You do not have to wait for token expiry — the session cookie fails at the next `/admin` request because `lib/admin-auth.ts` already calls `verifySessionCookie(cookie, true)` with `checkRevoked: true` on every request.
2. **Remove from `ADMIN_EMAIL_ALLOWLIST`** (manual, recommended second step for defence in depth): this is optional but recommended. The claim clear and session revoke above already end access on their own, but removing the email from the allowlist provides an additional layer. On the deployed server, remove the email from Secret Manager's `ADMIN_EMAIL_ALLOWLIST` value. On your local dev environment, remove it from `.env.local`.

If no account exists for the email, the script exits cleanly with a message — an operator removing a committee member under time pressure must not be blocked by a typo or a person who never signed up.

## Verifying grant or revoke actually took effect

To audit who currently holds the `admin` claim, run:

```bash
pnpm exec tsx scripts/admin-list.ts
```

This read-only command lists every Firebase Auth account currently holding `admin: true`, along with their uid, `emailVerified` status, and `tokensValidAfterTime` (which indicates when tokens were revoked, if they were).

The definitive verification, however, is always the same as for the allowlist: **actually sign in as the account and attempt to reach `/admin`.** For a grant, `/admin` should load. For a revoke, you should see "You can't in" — the gate is working. Trusting a script's exit code alone is not sufficient, because the gate has three independent preconditions (claim, email verification, and allowlist membership), and a script lists only what it was designed to report.

## Disabling self-signup (defence in depth, console-only)

This is a defence-in-depth measure, **not** a substitute for the allowlist and custom claim gate (`lib/admin-auth.ts` already refuses a freshly self-registered account with no claim, proven by the contract check `contracts/checks/admin-auth-hardening/check-probe-refused-everywhere.mjs`).

Disabling open self-signup on `/admin/login` cannot be done via a script in this repository, because:

- The classic Firebase Authentication console toggle for the "Email/Password" provider disables both sign-up and sign-in together, which would also break the admin login page itself.
- The correct control — the "restrict account creation" setting — lives one level up in the **Google Cloud Identity Platform console**, not the Firebase Authentication panel. It separates sign-up from sign-in, allowing existing accounts to log in while preventing new self-registered accounts.
- Neither `firebase-admin` nor `firebase-tools` expose a documented, stable API for this setting as of this project's pinned dependency versions. Scripting against an under-documented surface risks a silent no-op — this project has direct history of exactly that failure shape (see `docs/secret-corruption-incidents.md`) — so this remains a manual console step.

To disable self-signup:

1. Navigate to the Identity Platform Settings page directly: https://console.cloud.google.com/customer-identity/settings?project=saoc-webapp
2. Find the "Disable user actions" setting (also labelled "Restrict account creation" in some versions of the console).
3. Enable it to prevent new self-registered accounts while keeping existing sign-in functional.
4. Optionally, review the Email/Password provider configuration: https://console.cloud.google.com/customer-identity/providers?project=saoc-webapp

**A green contract gate does NOT prove this console step was performed.** The gate verifies the documentation mentions it, not that the console setting is actually enabled. After enabling it, test by attempting to self-register a new account on `/admin/login` — you should see an error with code `auth/admin-restricted-operation`. Confirm that existing admin accounts can still sign in normally. Note: the login page should handle the `auth/admin-restricted-operation` error gracefully (log the error or show a message); if it does not, that's a follow-up for the `/admin/login` page owner.

## Claim before allowlist

**An email address must be granted via `scripts/admin-grant.ts` before it is ever added to `ADMIN_EMAIL_ALLOWLIST`.** This ordering rule is the core of F4's defence against the account linking hazard.

### Why this order matters

An unallowlisted address grants access to nobody, ever — `lib/admin-auth.ts` refuses it at the third gate condition regardless of what account exists behind it. So there is never a legitimate reason to add an address to the allowlist before it has gone through `admin-grant.ts` at least once. The ordering closes two attack paths:

- **No pre-existing account.** When `admin-grant.ts` creates a fresh account for an email, it sets `emailVerified: true` immediately (we vouched for it — same as F3's own rule). Firebase enforces email uniqueness unconditionally at the Admin SDK level — no second account for that same email can ever be created via client-side signup (`accounts:signUp`) from that point onward. The address is permanently claimed by the real admin. Later, when the real admin signs in with Google and Firebase **links** the Google credential onto this account, it's the legitimate account, not a squatter's.

- **Pre-existing account (the dangerous case).** A squatter may have self-registered the address first via the still-open signup endpoint. This is exactly the case F3's existing gate already handles: `admin-grant.ts` refuses without `--existing`, prints the account's provenance, and even with `--existing`, never sets `emailVerified: true` on a pre-existing account — so an unverified squatter stays locked out by F3's `email_verified` check regardless. What F4 adds is an explicit warning when the account matches the squatter-shape exactly: password provider only, never verified.

### This is operator discipline, not a technical guarantee

Claiming the address first is a documented ordering rule, not a platform setting that enforces itself. This project's own history (F3's own amendment) shows that operator discipline can be documented without false guarantees. The concrete residual risk remains: an operator could misjudge a pre-existing account as legitimate, run `admin-grant.ts` with `--existing`, and later watch that squatter's account get verified when the real admin signs in with Google and Firebase links the Google credential onto the same uid.

This is a real, known, documented limitation. Two controls address it:

1. **The sharper warning from `admin-grant.ts`** — when a pre-existing account is password-only and never verified, the script prints an explicit message at grant time, not buried in a manual step. An operator reading "password provider only, never verified — check whether they've already signed in via a federated provider elsewhere" is less likely to rubber-stamp `--existing` than one reading only a uid and timestamp.

2. **This documentation** — the ordering rule and its rationale are written here as a hard rule, following this project's convention of documenting what cannot be scripted (see F3's "Disabling self-signup" section above — the same principle).

Accepted as a known, documented limitation, backed by the sharper warning and operator discipline, not solved further here.

## Google sign-in

Admins can now sign in with Google as well as email/password. Both paths converge through the same `/api/admin/session` route and the same authorisation gate — signing in with Google confers **nothing by itself**. The allowlist plus the `admin` custom claim still decide access, re-checked on every request, exactly as they do for password sign-in.

### Prerequisites — Firebase console setup

Enabling Google sign-in requires one manual step in the Firebase Console:

1. **Navigate directly:** https://console.firebase.google.com/project/saoc-webapp/authentication/providers
2. **Enable the Google provider** — set a support email address. That is all. Google's OAuth client is auto-configured, tied to the existing GCP project. No client ID or secret needs to be obtained; the credentials are managed by Google Cloud and Firebase automatically.
3. **No `.env.local` change needed** — this project's client code uses Firebase's `GoogleAuthProvider` from the `firebase/auth` library (see `app/admin/login/page.tsx`), which communicates only with Firebase's hosted OAuth redirect handler (`https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`). Firebase stores the provider configuration itself; no credentials land in this repository's environment variables or secret-corruption surface.

**A green contract gate does NOT prove this console step was performed.** The gate verifies this documentation mentions it and the code is structured correctly, not that a human actually enabled Google in the Firebase Console. After enabling Google, test by attempting to sign in via the "Sign in with Google" button on `/admin/login` — it should open a popup. Confirm that both a password sign-in and a Google sign-in for the same allowlisted, admin-claimed account work correctly and both land at `/admin`.

### The new pre-existing-account warning

`scripts/admin-grant.ts` now prints an explicit warning when a pre-existing account matches the squatter-shape exactly: **password provider only, never verified**. This never occurs naturally on this project — federated providers set `email_verified: true` automatically, and self-registered password accounts remain unverified. Before passing `--existing` to promote such an account to admin, you must independently verify it belongs to the intended person, not a squatter.

Example workflow:

1. You run `admin-grant.ts` on an address about to be onboarded.
2. The script finds a pre-existing account and prints its provenance.
3. If the provenance shows "password provider only, never verified," the script prints a warning — do not automatically assume this is safe.
4. Ask the intended admin directly: "Have you ever signed into this admin panel before, via Google or another federated provider?" If they answer no, the account is a red flag — investigate further before passing `--existing`.
5. If the intended admin confirms they have already signed in via Google elsewhere, that sign-in would show up as an additional `providerData` entry (e.g. `google.com`) in the provenance above — that confirms the account belongs to the right person and it is safe to pass `--existing`.

This is an operator-discipline control, not a technical barrier. It sharpens the warning from F3's existing refusal path and makes the dangerous shape explicit at the moment it matters.

## Out of scope here (F4 / M2)

Microsoft and Apple sign-in providers and the human end-to-end door-scanner proof are later work (mission `admin-auth-hardening`, features F5 and beyond).

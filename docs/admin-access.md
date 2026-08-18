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
is what actually tells you which precondition failed.

**Pre-existing gap, fixed 2026-08-17:** this section previously told readers to "check
server logs" for the `reason`, but nothing logged it — the only log anywhere in the auth
path was `parseAllowlist()`'s allowlist-length count. That is now fixed: `no-claim`,
`email-unverified`, and `not-allowlisted` are logged server-side, WARNING level, by
`classifyRefusal()` in `lib/admin-auth.ts` — one `console.warn('[admin-auth] refused', {
operation, reason, email })` call, invoked both from `getAdminSession()` (any already-signed-in
surface re-checking the session cookie) and from `POST /api/admin/session`'s 403 path (the
sign-in-time refusal — see "Apple sign-in" below for why this specific path matters). The
attempted email is logged deliberately, unredacted — it is the whole point of the log — but
nothing else from the decoded token is. This log is server-side only; it never reaches the
browser, which still only ever learns "sign-in failed" or an undifferentiated 403 (see
`mintSession()` in `app/admin/login/page.tsx`, which reads only `response.status`).
`no-session` and `invalid-session` are NOT logged with a reason this way — by definition
there is no decoded token to log an email against at that point (no cookie, or a cookie
that failed verification outright); if you need to debug one of those two, you're looking
for the absence of any `[admin-auth]` log line for that request, not a line with that
reason string in it.

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

## Disabling self-signup (`functions/src/index.ts`, a Cloud Function, not a console step)

This is a defence-in-depth measure, **not** a substitute for the allowlist and custom claim gate (`lib/admin-auth.ts` already refuses a freshly self-registered account with no claim, proven by the contract check `contracts/checks/admin-auth-hardening/check-probe-refused-everywhere.mjs`).

An earlier version of this document pointed at a manual Google Cloud Identity Platform console
toggle ("restrict account creation") for this. That approach was rejected: it requires the
one-way Identity Platform (GCIP) upgrade, which this project has declined for a feature set
(MFA/SAML/OIDC/multi-tenancy/IAP) it will never use at its scale. The shipped mechanism instead
uses a plain 1st-generation Cloud Function, deployed independently of the Next.js app on App
Hosting.

**Mechanism**: `functions/src/index.ts` exports `guardSelfSignup`, built from
`functions.auth.user().onCreate()`. This fires for every account-creation path (password sign-up,
federated sign-in, anonymous auth, or an Admin SDK `createUser()` call). On each firing, it polls
`getUser(uid)` roughly every 5 seconds for a bounded grace window (~90 seconds) waiting for the
`admin: true` custom claim to appear. If the claim never appears within the window, the function
deletes the account (one bounded retry with a ~3 second backoff if the delete call itself fails,
then it gives up and logs an ERROR for manual cleanup — no infinite retry).

**Why the admin claim, not the admin email allowlist**: the obvious-looking design — delete unless
the new account's email is on the admin allowlist — is wrong for this project and would break
production admin provisioning. Under the "Claim before allowlist" ordering rule documented below,
`scripts/admin-grant.ts` deliberately creates the account and sets the claim *before* an operator
adds the email to the allowlist as a separate manual step. A naive allowlist-based check would
therefore delete every legitimately-provisioned admin account within moments of `admin-grant.ts`
creating it. The `admin` custom claim is the only signal in this repo that actually distinguishes
"an operator just ran `admin-grant.ts`" from "a stranger self-registered" — `admin-grant.ts` sets
it via a second, separate `setCustomUserClaims()` call, sequentially after `createUser()`, and no
other code path in this repo ever sets it. This function reads no Secret Manager value and has
**no dependency on the admin allowlist at all** — an empty or corrupted allowlist cannot cause it
to delete a legitimate account, because it never reads that value.

**Fail-open on ambiguity**: if a polling `getUser()` call itself errors, that is treated as
inconclusive, not as "no claim" — the function logs an ERROR with the uid/email and the caught
error, skips deletion for that invocation, and stops. It never deletes on an ambiguous read. A
self-signup account surviving an extra cycle costs nothing (see the residual gap below); a
wrongly-deleted legitimate account is a real incident, since Firebase's email-uniqueness
enforcement means it cannot simply be recreated with the same address.

**The residual gap**: for the length of the grace window, a freshly self-created account exists
and can obtain a valid Firebase ID token. That token is nonetheless useless — `lib/admin-auth.ts`
requires all three of the `admin` claim, `email_verified === true`, and live allowlist membership
before granting access, and a self-signup account satisfies **zero** of the three (no claim ever
set; `emailVerified: false` by default for a password account; not allowlisted, since claim-first
provisioning means the operator has not yet added it). A token with zero of the three conditions
has exactly the same capability as no token at all. Accepted as a known, documented, zero-capability
gap — not solved further here.

**Operational consequence — the grace window is a hard deadline for `admin-grant.ts` runs**: when
provisioning a **brand-new** email (no `--existing` flag), the script's `createUser()` +
`setCustomUserClaims()` sequence must both complete before the grace window elapses, or this
function will delete the account it just created, and the operator will need to re-run
`admin-grant.ts` from scratch. In practice both Admin SDK calls complete in well under a second,
so this is not a real operational concern — but it's the reason the window is bounded rather than
indefinite.

**Region note**: this guard is a 1st-generation Firebase Auth trigger; those are forced to deploy
to `us-central1` regardless of any `.region()` call, independent of the App Hosting backend's
`europe-west4`. This is normal, documented Firebase behaviour for this trigger type, not a
misconfiguration.

**Deploying**: `firebase deploy --only functions`, independent of the App Hosting rollout that
deploys the Next.js app. Verification is via the Firebase Auth + Functions emulator
(`firebase emulators:start --only auth,functions`), never against the live `saoc-webapp` project —
see `contracts/golden/production-blockers-f5-self-signup-guard/README.md` for the full decision
record and verification method.

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

## Microsoft sign-in

Admins can also sign in with a Microsoft account. Like Google, this converges through the
same `/api/admin/session` route and the same authorisation gate — signing in with Microsoft
confers nothing by itself; the allowlist plus the `admin` custom claim still decide access.

### Prerequisites — Entra app registration (human step, not scripted)

Enabling Microsoft sign-in requires registering an app with Microsoft **Entra** ID (Azure
AD), following Microsoft's own `Quickstart: Register an app with the Azure Active Directory
v2.0 endpoint`:

1. Register a new app in the Entra admin center.
2. Set the **Redirect URI** to Firebase's hosted OAuth handler:
   `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`.
3. Generate a **Client Secret** for the app registration.
4. Enter the registration's **Client ID** and **Client Secret** into Firebase Console →
   Authentication → Sign-in method → Microsoft — never into this repo's `.env.local` or any
   app env var (same rule as Google's support email; see above).

### Tenant decision — any account, not a restricted tenant

The app is registered for **"Accounts in any organizational directory and personal
Microsoft accounts"** — the multi-tenant + personal option, reached via the `common` OAuth
endpoint. Firebase's own `tenant` custom parameter defaults to `'common'`, so no value needs
to be set for this choice. **Rationale:** this project has no evidence of possessing a
dedicated Azure/Entra tenant of its own, and restricting sign-in to a single tenant would
require creating and administering one solely for this purpose. The allowlist
(`ADMIN_EMAIL_ALLOWLIST`) remains the actual authorisation boundary regardless of tenant
restriction — a valid Microsoft sign-in from any tenant that is not on the allowlist is
refused identically to any other unrecognised identity. Restricting to a specific tenant
later, if SAOC ever provisions its own Entra tenant, is a config-only change (the `tenant`
custom parameter) with no code impact — deferred, not precluded.

**A green contract gate does NOT prove this console step was performed.** The gate verifies
this documentation mentions it and the code is structured correctly, not that a human
actually registered the Entra app or enabled Microsoft in the Firebase Console. After
enabling it, test by attempting to sign in via the "Sign in with Microsoft" button on
`/admin/login`.

## Apple sign-in

Admins can also sign in with Sign In with Apple. Like Google and Microsoft, this converges
through the same `/api/admin/session` route and the same authorisation gate.

### Prerequisites — paid Apple Developer Program membership

Configuring Sign In with Apple requires enrolment in the **Apple Developer Program**, which
costs **99 USD per membership year** (or local-currency equivalent) — there is no free tier
that includes it. A nonprofit fee waiver exists; whether SAOC specifically qualifies and has
applied is unconfirmed. Sign In with Apple is currently configured against **Brad's personal
paid Apple Developer Program membership**, not a Council-owned one — this is a fact about a
person, not a property of the system, and could stop being true at any time (membership
lapse, Brad's departure from the project). SAOC should obtain its own Apple Developer
Program membership (or confirm the nonprofit fee waiver applies) before the National Show
2027 launch and re-point the Services ID / private key / Team ID at the Council's own
account at that time — this is a **Firebase Console-only change, with no code impact**.

### Required Apple developer-site configuration

From Apple's developer site (`developer.apple.com`), configure:

- A **Services ID**, with the site associated to the app, and the Firebase auth handler
  registered as its **Return URL**: `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`.
- A **Sign In with Apple private key**, generated in the same portal — note the **Key ID**.
- The account's **Team ID**, found on the membership page.
- Optionally, if this project ever sends Firebase Auth emails (verification, password
  reset — which F3's grant flow for fresh accounts already does) to an Apple-relayed
  address, register `noreply@<PROJECT_ID>.firebaseapp.com` with Apple's private email relay
  service so those emails actually reach the user.

All four values (Services ID, private key, Key ID, Team ID) are entered into **Firebase
Console → Authentication → Sign-in method → Apple → OAuth code flow configuration**, never
into this repo's `.env.local` or any app env var.

### Private email relay vs. the email-based allowlist

Apple's Sign In with Apple lets a user choose to share an anonymised relay address
(`<opaque>@privaterelay.appleid.com`) instead of their real email. This interacts directly
with this project's email-based allowlist: the relay address is opaque and per-user,
generated only at first sign-in, so it cannot be pre-populated into
`ADMIN_EMAIL_ALLOWLIST` before that first attempt.

**Primary instruction: ask committee members enrolling via Apple to disable "Hide My
Email"** at Apple sign-in, sharing their real address, so it behaves like any other address
for allowlisting purposes.

**Documented fallback**, for a member who declines to disable relay: capture the relay
address from a refused first attempt. A first Apple sign-in attempt is refused at
`POST /api/admin/session` (the account isn't allowlisted yet), which logs
`console.warn('[admin-auth] refused', { operation, reason: 'not-allowlisted', email })`
server-side via `classifyRefusal()` in `lib/admin-auth.ts` — see "Reading the `reason`
field when debugging" above. The `email` field in that log line is the
`<opaque>@privaterelay.appleid.com` address to add. Add that literal address to the
allowlist. This ties the allowlist entry to a value the member does not control and could
rotate, so it is not the default; use the primary instruction whenever
possible. Either path is safely refused-by-default until an operator acts.

**A green contract gate does NOT prove the console steps above were performed.** The gate
verifies this documentation mentions them and the code is structured correctly (including
the explicit `email` scope request — see `app/admin/login/page.tsx`), not that a human
actually completed Apple Developer Program enrolment or Firebase Console configuration.
After enabling it, test by attempting to sign in via the "Sign in with Apple" button on
`/admin/login`.

## Roles and Capabilities (F3, see docs/ticketing.md for full details)

Feature F3 of the ticketing mission establishes a fixed set of seven capabilities (`view-admin-dashboard`, `scan-checkin`, `lookup-booking-ref`, `search-buyers`, `issue-comp`, `issue-refund`, `export-buyer-data`) and bundles them into three roles (`door-staff`, `manager`, `owner`). The role→capability mapping lives in `lib/admin-roles.ts` and is purely definitional — F3 does not wire these capabilities into any route or custom claim yet; that is F4's job.

See [docs/ticketing.md](ticketing.md) § "Admin Roles and Capabilities" for the full rationale, including why `owner` is derived from the fixed set, why the lookup capability is split into two for POPIA, and what remains for F4 to complete.

## Capability Checks (F4): When Routes Will Call hasCapability()

**Status:** F4 ships the `hasCapability()` decision function (`lib/admin-auth.ts:187–206`) and proves it offline. No route calls it yet. Route wiring happens in F5 and beyond as each protected surface is built.

When a route **does** check a capability, it will call:

```typescript
export function hasCapability(
  decoded: DecodedIdToken | null | undefined,
  showId: string,
  capability: Capability,
  opts?: { now?: Date; lookupShowWindow?: ShowWindowLookup },
): boolean;
```

This is an **additive gate on top of** `isAdminToken()`, not a replacement for it:

- **First**, `hasCapability()` reuses `isAdminToken()` — it does not duplicate the
  `admin: true`, `email_verified: true`, and allowlist checks.
- **Then**, if the token is admin, `hasCapability()` checks whether the token's
  `roles` custom claim resolves to the requested capability for that `showId`.
- An `admin: true` token with no `roles` claim is refused every capability.
- A token with a matching `roles` claim but `admin: false` is refused every
  capability.

For example, a route protecting `issue-comp` capability would do:

```typescript
import { NextResponse } from 'next/server';

const session = await getAdminSession();
if (!session.ok) {
  const status = session.reason === 'no-session' || session.reason ===
    'invalid-session' ? 401 : 403;
  return NextResponse.json(
    { error: status === 401 ? 'Unauthorized' : 'Forbidden' },
    { status }
  );
}

if (!hasCapability(session.decodedToken, showId, 'issue-comp', {
  // F5 must replace this placeholder with a real cached Sanity-backed lookup.
  lookupShowWindow: (id: string) => null,
})) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Important:** a caller that omits the `lookupShowWindow` option (passing only
`showId` and `capability`) will silently honour only `'*'`-scoped grants — every
per-show-scoped grant defaults to `null` lookup and is refused. When F5 wires this
gate, a route protecting a per-show capability **must** pass a real lookup function
(the live Sanity-backed one, once it exists in F5). This is the footgun to watch.

See [docs/ticketing.md](ticketing.md) § "Role Grants and Capability Checks: The
`roles` Custom Claim (F4)" for the full specification, including the three known gaps
(no claim-size guard, throwing lookup propagates unhandled, no live Sanity-backed
lookup yet).

## The Buyer Boundary: No Authorization from Buyer Accounts (F5)

**Critical:** the mere existence of a `buyers/{uid}` Firestore document (added by F5) grants
**zero** admin capabilities and **zero** access to any admin surface. A self-registered buyer
account carries no `admin` claim, no `roles` claim, and is refused by `isAdminToken()` and
`hasCapability()` identically to any unauthenticated request (see spec §8.4).

This is proven offline by calling the real `hasCapability()` and `resolveRoleCapabilitiesForShow()`
functions (F4) against a buyer-shaped identity across all seven capabilities. The gate is
**AND-only composition**: an `admin: true` token with no `roles` claim is refused every
capability; a token with a matching `roles` claim but `admin: false` is refused every
capability. Both the `admin` claim itself and the `roles` claim are required; neither alone
suffices.

A public buyer-facing signup route (F6 onward) must never consult `lib/admin-roles.ts` or
`lib/admin-auth.ts`'s capability checks. If a future admin route ever reads the `buyers`
collection for any reason (e.g. an admin tool to look up a buyer's order history), that route
must not grant access based on the mere existence of a `buyers` document — it must apply the
same capability checks as any other admin route, re-verified against the current `admin` claim
and `roles` claim at request time. This property is recorded here as a standing requirement for
future features; F5 itself adds no route to test against yet.

See [docs/ticketing.md](ticketing.md) § "Buyer Accounts and POPIA Consent: lib/buyers.ts (F5)"
for the full details, including why the boundary is load-bearing and what is manually verified
(live HTTP round trip against a real Firebase project).

## Out of scope here (F4 / M2)

The human end-to-end door-scanner proof is later work (mission `admin-auth-hardening`,
feature F6). Microsoft and Apple sign-in are covered above under their own sections.

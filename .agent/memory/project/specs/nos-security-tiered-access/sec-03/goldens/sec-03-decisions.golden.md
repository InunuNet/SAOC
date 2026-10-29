# SEC-03 decisions (golden policy)

Source of truth: origin/main ada42c41. Evidence: ../../audit/evidence-saoc-2026-10-29.md.

## D1. Root fix: disable client-SDK signup (config), scripted

Setting: Identity Toolkit Admin v2 `projects/saoc-webapp/config`, field `client.permissions.disabledUserSignup = true`.

- PATCH with `updateMask=client.permissions.disabledUserSignup` (the LEAF) so `disabledUserDeletion` and every other field is untouched. Never PUT, never a wider mask.
- Never print or persist the config response. It contains `signIn.hashConfig.signerKey` (the 2026-10-29 incident). The script projects exactly `client.permissions.disabledUserSignup` (boolean) out of any response and discards the rest. Dry-run, apply and verify output carry that one boolean and nothing else.
- Modes: default dry-run (GET, print current/target, change nothing); `--apply` (PATCH then GET read-back, exit non-zero if read-back != target); `--verify` (GET only, exit 0 iff true, never writes); `--target false` with `--apply` is the rollback; `--config-fixture <file>` runs dry-run offline against a canned config and is refused with `--apply`/`--verify`.
- Idempotent: if the current value already equals the target, print ALREADY and exit 0 without a PATCH.
- Credential: operator access token (`gcloud auth print-access-token`, header `x-goog-user-project: saoc-webapp`), same route the 2026-10-29 audit used. Not the service-account key from .env.local.
- admin-grant.ts compatibility (read from scripts/admin-grant.ts on origin/main): it provisions via Admin SDK `createUser()` + `setCustomUserClaims()`, and its own header says that path "stays available even after self-signup is disabled". The Admin SDK is not subject to `disabledUserSignup`. Confirmed by code, NOT yet proven live: the check below runs Admin createUser under the emulator; the live proof is the operator running `admin-grant.ts` against a throwaway address after apply (see Risks).
- Existing users: sign-in of an existing account is not account creation, so the three existing users keep signing in with Google or password. Open question that code cannot answer: first Google sign-in onto an Admin-created email/password account links a provider to an existing uid. That is expected to be allowed, but the operator must test with the real second admin before the closing the beta; rollback is `--target false`.
- Honest uncertainty: docs/admin-access.md records that the console "restrict account creation" toggle needs the one-way Identity Platform upgrade, which the project declined. The v2 config field is readable today (audit item 3). Whether PATCH of this field is accepted without that upgrade is UNPROVEN. If the API rejects it, the script exits 3 with the API status line and a diagnosis, and D2 alone closes SEC-03. Do not upgrade to Identity Platform to get unstuck without Brad.
- Existing control kept: guardSelfSignup stays deployed. It becomes defence in depth, and it still covers Admin-created-then-abandoned accounts.

## D2. Route hardening: shared admin gate, no new capability

Decision: `POST /api/events/submit` requires `isAdminToken(decoded)` from lib/admin-auth.ts after `verifyIdToken(token, true)`.

Why the shared gate and not a capability:
- Today's reachable audience is already admin only. The page that renders the form needs a `session` cookie, and `POST /api/admin/session` mints that cookie only for `isAdminToken` tokens. So no real user loses access; only the unauthenticated-by-design bypass of calling the API directly is removed.
- `hasCapability()` requires `isAdminToken` first (AND-only composition) and needs a showId and a role vocabulary that has no event-submission capability. Inventing one is a design decision that belongs to M2, and adds a claim nobody has been granted.
- One gate, one policy doc, one place to change when M2 lands tiers (replace the call, not the route).

Revocation, deleted and disabled users: verified in node_modules/firebase-admin 14.0.0 (lib/auth/base-auth.js verifyIdToken -> verifyDecodedJWTNotRevokedOrDisabled -> getUser). `checkRevoked=true` DOES reject a deleted user (getUser throws auth/user-not-found), a disabled user (auth/user-disabled) and a revoked token. So no extra getUser call is added; the existing `verifyIdToken(token, true)` stays and the golden matrix proves it. Without `true` it would not; that second argument is load-bearing and is asserted structurally.

Refusal copy: reuse existing strings only. 401 `Unauthorized` (existing in this route), 403 `Forbidden` (existing in /api/admin/session). The reason-revealing `Email not verified` body is removed; `classifyRefusal(decoded)` logs the reason server-side. No new user-facing copy.

Page: `app/(marketing)/events/submit/page.tsx` swaps its private `verifySessionCookie` check for `getAdminSession()` `.ok`, so the page and the route share one policy. The "Members only" LoginPrompt copy is existing and unchanged. Rate limiting stays as is, after the gate (per-uid then per-IP).

Knock-on: contracts/checks/security-hardening/check.mts line ~232 asserts `isVerifiedSubmitter(` appears in the route. @dev updates that assertion to `isAdminToken(` in the same change. `isVerifiedSubmitter` stays exported and unit-tested (not dead: still imported by that check's unit section); remove only if @dev proves nothing else uses it.

## D3. Sweep: routes that trust a bare verified token

| surface | trust today | verdict |
|---|---|---|
| app/api/events/submit/route.ts | verifyIdToken + email_verified only | FIX (D2) |
| app/(marketing)/events/submit/page.tsx | verifySessionCookie only, no admin check | FIX (D2) |
| app/api/admin/session/route.ts POST | verifyIdToken then isAdminToken | OK (the mint choke point) |
| app/api/admin/session/route.ts DELETE | verifySessionCookie to resolve own uid for revoke | OK, by design, no capability granted |
| lib/admin-auth.ts getAdminSession | verifySessionCookie(true) + isAdminToken | the gate |
| app/api/admin/**, app/admin/** (27 files import the gate) | getAdminSession / isAdminToken | OK |
| app/admin/(shell)/{door,newsletter,payments,vendors,vendors/applications}/page.tsx | no direct call; gated by the (shell) layout | OK, noted: layout-only gating is not defence in depth; API routes behind them each call the gate |
| app/api/admin/reconcile-orders/route.ts | shared bearer secret, timing-safe, not an ID token | OUT OF SCOPE |
| components/events/SubmitEventForm.tsx | client getIdToken, sends it as Bearer | client only, no change |
| proxy.ts | no auth decision | OK |

Method: git grep for verifyIdToken, verifySessionCookie, getAuth(, Authorization/Bearer, get('session'), email_verified over app/ lib/ components/ on origin/main, then a per-file gate check across app/api/admin and app/admin. Only two surfaces trust a bare token. A third-party-library or Sanity Studio auth path was not in scope.

## Risks
- PATCH may be refused without Identity Platform (D1). D2 still closes the finding.
- Linking a federated provider onto an Admin-created account must be tested by the operator before depending on the config.
- The emulator proves the code path, not the live config; the live-state assertion is A9 and stays RED until apply.

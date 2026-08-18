# F5 — Self-signup guard via `functions.auth.user().onCreate()`

Decision record. Six questions from the brief, answered against real source read for this
contract, not assumed.

## 1. Where the function lives

`functions/` does not exist yet (verified: `ls functions` -> "No such file or directory").
`firebase.json` today contains only a `hosting` block (source `.`, `frameworksBackend.region:
europe-west4`) — no `functions` key at all. Firebase Functions deploy separately from the
Next.js app on App Hosting; they are not part of the App Hosting build.

**Structure**: a new top-level `functions/` package — `functions/package.json` (deps:
`firebase-functions`, `firebase-admin`; `engines.node: "22"`, matching `apphosting.yaml`'s
`runtime: nodejs22`), `functions/tsconfig.json`, `functions/src/index.ts`. `firebase.json` gets
a new top-level `"functions"` entry:

```json
"functions": [
  { "source": "functions", "codebase": "default" }
]
```

Deployed with `firebase deploy --only functions`, independent of the App Hosting rollout that
already deploys the Next.js app. This is additive — the existing `hosting` block is untouched.

**Region**: `functions.auth.user().onCreate()` is a 1st-generation Auth trigger. These are
forced to `us-central1` regardless of any `.region()` call in code — confirmed via a live search
against `firebase/firebase-functions` GitHub issues and Stack Overflow 79761627 ("Firebase User
Auth Triggers Are Forcefully Deployed On us-central1 region", still open/current). This differs
from the App Hosting backend's `europe-west4`. That's fine: this is a background trigger with no
user-facing latency requirement, and mismatched regions between an Auth trigger and the rest of
the stack is normal, documented Firebase behaviour, not a misconfiguration.

## 2. The allowlist source of truth — REVERSED from the brief

The brief's working assumption was: read `ADMIN_EMAIL_ALLOWLIST` via a Secret Manager binding,
delete unless the new account's email is on it. **This is wrong and would break production admin
provisioning.**

`backlog.md` (~line 1167-1173) records F4's already-shipped, deliberate design: **claim-first
provisioning** — "an email must go through `admin-grant.ts` BEFORE it is added to
`ADMIN_EMAIL_ALLOWLIST`, because Firebase enforces email uniqueness unconditionally once
claimed — this closes the squatting race at the platform level rather than by operator
discipline alone." That ordering is intentional and already in production use (verified:
`brad@inunu.net`'s own account, uid `NhSVXoMlT2bl6h4gDoyr5NZ1VW52`, was provisioned this way).

Consequence: at the exact moment `scripts/admin-grant.ts`'s `createAndGrantFreshUser` calls
`auth.createUser({ email, password })` (scripts/admin-grant.ts:143), the email is **not yet** in
`ADMIN_EMAIL_ALLOWLIST` by design — it gets added afterward, as a separate manual step
(`printAllowlistReminder`, scripts/admin-grant.ts:81-88, printed *after* creation). A trigger
that deletes on "not allowlisted" would delete every legitimately-provisioned admin account
within moments of `admin-grant.ts` creating it.

**Decision**: the deletion condition is instead keyed on whether the `admin: true` custom claim
appears on the new uid within a bounded grace window. `admin-grant.ts` sets that claim via a
second, separate `setCustomUserClaims()` call (scripts/admin-grant.ts:149), sequential and
awaited after `createUser()` — this is the actual signal that distinguishes "an operator just
ran admin-grant.ts" from "a stranger self-registered", and self-signup accounts (via
`accounts:signUp`, Google sign-in, or anonymous auth) never receive this claim by any other code
path in this repo (confirmed: grep of the repo shows `setCustomUserClaims` is called from
exactly two places, both inside `scripts/admin-grant.ts`).

This has a deliberate side effect: **this function reads no Secret Manager value and has no
dependency on `ADMIN_EMAIL_ALLOWLIST` at all.** That removes it from the "secret corruption
defect class" this project has already hit four times (see backlog.md P2 "Empty-allowlist
scenario ... EXACTLY the secret-corruption defect class") — an empty or corrupted allowlist can
no longer cause this function to delete legitimate accounts, because it never reads that value.

## 3. What "delete" actually means, and the exact condition

Fires for **every** creation path (confirmed against
`firebase.google.com/docs/functions/auth-events`: "A user creates an email account and
password" / "A user signs in for the first time using a federated identity provider" / "The
developer creates an account using the Admin SDK" / "A user signs in to a new anonymous auth
session for the first time" — all four fire the same `onCreate` event).

**Condition**: on `onCreate(user)`, poll `getUser(user.uid)` via the Admin SDK every ~5s for up
to a bounded grace window (recommend 90s, comfortably longer than two sequential Admin SDK round
trips in `admin-grant.ts`, which each typically complete in well under a second). If
`customClaims?.admin === true` appears at any point in the window -> stop polling, do nothing,
account stands. If the window elapses with no claim -> `deleteUser(user.uid)`.

This does **not** special-case `admin-grant.ts`'s Admin-SDK-created-account path structurally
(e.g. by checking `providerData` or a "created via Admin SDK" flag) — no such flag exists in the
`UserRecord` the trigger receives, and even if it did, it would not distinguish "operator ran
admin-grant.ts" from "an attacker with stolen Admin SDK credentials", which the claim itself
already does correctly since only `admin-grant.ts` ever sets it.

## 4. Idempotency / failure mode, and the brad@inunu.net paranoia

**The poll/claim-check itself failing** (Admin SDK error on `getUser` during polling): treated as
inconclusive, not as "no claim" — skip deletion for this invocation, log ERROR with uid/email
and the caught error, and stop. Never delete on an ambiguous read. This mirrors the same
fail-open-on-uncertainty reasoning as point 2's Secret Manager avoidance: the cost asymmetry is
not symmetric. A false negative (a self-signup account survives an extra cycle) costs nothing —
see point 5, it has zero capability regardless. A false positive (a legitimate account gets
deleted) is a real incident: Firebase enforces email uniqueness, so recovering a wrongly-deleted
account is not a simple retry, it needs manual re-provisioning and, if it were `brad@inunu.net`'s
own account, a genuine access-loss incident matching this project's own documented "secret
corruption" incident class in severity.

**The final `deleteUser()` call itself failing** (network blip, permissions): one bounded retry
with a short fixed backoff (e.g. 3s), then give up, log ERROR with uid/email, and return. No
infinite retry loop — Cloud Functions background triggers have a finite timeout, and `onCreate`
fires exactly once per uid, so there is no second invocation to retry on later. A self-signup
account that survives because deletion failed twice is the same acceptable-cost outcome as point
5's residual gap: zero capability, logged for a human to clean up.

**Why `brad@inunu.net`'s own account can never be at risk from this deploy**: `onCreate` fires
only at the moment of account **creation**. His account already exists (uid
`NhSVXoMlT2bl6h4gDoyr5NZ1VW52`, created before this feature ships) — deploying this trigger does
not retroactively fire `onCreate` for pre-existing accounts, and nothing in this design adds a
scheduled sweep or `onUpdate`/`onWrite` trigger that could re-evaluate an existing uid (asserted
structurally by A-STRUCT-04). The only account ever at risk of deletion under this design is one
created *after* this function is deployed, and only if it never receives the admin claim within
the grace window.

## 5. The disclosed residual gap

Confirmed against `lib/admin-auth.ts:56-62` (`isAdminToken`): a token is admin **only if all
three** hold — `decoded.admin === true`, `decoded.email_verified === true`, and
`isEmailAllowlisted(decoded.email)` re-checked live. A freshly self-created account has none of
these: no custom claim (self-signup never sets one), `email_verified: false` by default for a
password account, and (per point 2) almost certainly not yet allowlisted either. So during the
grace window before deletion, a self-created account's ID token satisfies **zero** of the three
`isAdminToken` conditions — it has exactly the same capability as a token that doesn't exist,
confirmed by reading the function directly rather than restating the brief's claim.

One nuance the brief didn't raise and this record makes explicit: the grace window here (~90s,
chosen for the admin-grant.ts race, not for attacker convenience) is *longer* than the near-
instant window the brief anticipated. That's an acceptable trade because the capability gap is
zero either way — the window's length only affects how long a self-signup row sits in Firebase
Auth's list before cleanup, not what it can do.

## 6. The verification method

Not `auth/admin-restricted-operation` on a subsequent `accounts:signUp` probe — that error code
is Identity-Platform-only and this design deliberately avoids the GCIP upgrade.

**Correct observable proof**, run entirely against the Firebase Auth + Functions **emulator**
(`firebase emulators:start --only auth,functions`), never the live `saoc-webapp` project:

- **Negative path** (A-BEHAV-01): create a fixture account the same way `accounts:signUp` would
  (password only, no claim ever set). Poll `getUser(uid)` until it throws
  `auth/user-not-found` or a bounded timeout elapses; assert it happens inside the grace window
  plus margin. Assert a specific function-log line names the deleted uid/email and the "no admin
  claim within grace window" reason — proving causation, not just coincidental absence.
- **Positive path** (A-BEHAV-02): reproduce `admin-grant.ts`'s exact two-call sequence
  (`createUser` then a separate, later `setCustomUserClaims({ admin: true })`) against the
  emulator, with a fixture email. Wait past the grace window plus margin. Assert the account
  still exists via `getUser(uid)`.
- **Fail-open path** (A-BEHAV-03): asserted structurally (the delete call is never left
  unguarded — wrapped so a thrown error is caught, logged at ERROR, and returns rather than
  crashing the invocation or silently retrying forever), since a real network partition isn't
  deterministically reproducible in a check.

Every fixture account created by a check is deleted unconditionally in a `finally`/trap block,
even on assertion failure — same `withCleanup()` discipline as this project's other contracts.
Because everything runs against the emulator's disposable in-memory Auth store, no check can
mutate the deployed site's real content or the real `ADMIN_EMAIL_ALLOWLIST`, structurally, not
by discipline alone.

## Things in the brief that turned out to need correction

- **The allowlist-based deletion condition (point 2) is wrong as written** — it would break
  claim-first provisioning. Corrected above; this is the single most consequential finding in
  this contract.
- **Region**: the brief didn't raise it; 1st-gen Auth triggers are forced to `us-central1`,
  independent of the rest of the stack's `europe-west4`. Not a blocker, just a fact to design
  around (A-STRUCT-03 pins it so a future edit can't silently try to move it).
- Everything else in the brief (avoiding GCIP/Blocking Functions, the `ADMIN_EMAIL_ALLOWLIST`-
  as-allowlist-source instinct being *directionally* right even though the specific mechanism
  needed to change, the residual-gap reasoning, the paranoia about `brad@inunu.net`) held up
  under verification against the real source.

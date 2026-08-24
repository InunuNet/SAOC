# admin-session-refusal-log-enforcement — F1 decision record

## The defect this closes

`app/api/admin/session/route.ts:29` calls `classifyRefusal(decodedIdToken)` on a refused
`POST /api/admin/session` purely for its logging side effect — `lib/admin-auth.ts`'s doc
comment on `classifyRefusal` says this WARNING-level log (`reason` + attempted `email`) is
"the log the ... `docs/admin-access.md` ... sections both depend on" for ops debugging,
while the HTTP response body stays a generic `{ error: 'Forbidden' }` (403) so the browser
never learns why. Nothing mechanically proves that call site still exists, still executes on
a real refusal, or still produces a line containing the right `reason` and `email`. A future
refactor could delete `classifyRefusal(decodedIdToken);` (or replace it with a no-op) and
every grep/type-check-based safeguard would still pass — silently reintroducing the exact
"documented but non-functional debugging path" defect this project has already paid for once.

## Why a round trip, not a grep

This project's own `coding.md` treats `agent_review` (and by extension any check that isn't a
real behavioural proof) as a smell — automate whatever can be automated. A grep for the string
`classifyRefusal` in `route.ts` is satisfiable by dead code: the call could be present,
never reached (wrong branch), or reached but silently swallowed if `classifyRefusal` itself
were gutted to a no-op that still returns the right shape. None of those are the property
that matters. The property that matters is: **a real refused session, driven through the real
HTTP surface, produces a real log line with the right reason and email, while the response the
browser sees stays generic.** Only executing the real code path and observing its real output
proves that.

## Why this reuses, and departs from, `admin-auth-hardening`'s harness pattern

`contracts/checks/admin-auth-hardening/_shared.mjs` already established the project's pattern
for proving this class of property against `/api/admin/session`: a locally built production
server, real Firebase Auth accounts via Identity Platform REST + Admin SDK, real minted
`idToken`s, real `fetch()` calls against the app's own HTTP surface — never a source grep,
never a mocked `classifyRefusal`. This contract's checks reuse that same real-round-trip
philosophy and, where the underlying account plumbing is identical, the same technique
(`accounts:signUp`, `createCustomToken` + `signInWithCustomToken` to mint/re-mint `idToken`s
reflecting current claims, `setCustomUserClaims`/`updateUser` to control `admin`/
`email_verified`).

It departs from `admin-auth-hardening`'s harness in exactly one way, for a reason specific to
this contract: **`admin-auth-hardening` targets an externally-already-running server (`BASE_URL`,
default `http://127.0.0.1:3400`) because none of its checks need that server's own log output —
they only need its HTTP responses.** This contract's whole point is to capture the server
process's own stdout/stderr (the `console.warn(...)` line `classifyRefusal` emits) and assert on
its content. Reading another process's console output over the network isn't possible, and there
is no existing convention on this project for redirecting a pre-started dev/prod server's
console into a location these checks could read. So `_shared.mjs` here **spawns and owns its own
dedicated server process** (`next start` on a fixed, project-reserved port, distinct from
`admin-auth-hardening`'s 3400 — see "Port" below) via Node's `child_process.spawn`, piping that
child's `stdout`/`stderr` into an in-memory buffer the checks can inspect directly, and tears it
down when done. This makes every check in this contract fully self-contained (no manual
"start the server first" precondition, consistent with `coding.md`'s "automate verification,
human input is the last resort") while still exercising the real compiled route handler, the
real `lib/admin-auth.ts` code, and real Firebase Admin/Auth calls — nothing about
`classifyRefusal`, `isAdminToken`, or the route handler itself is mocked or stubbed.

### Port

`3411`. Reserved to this contract only — distinct from `admin-auth-hardening`'s `3400`,
`payfast-m1`'s and other contracts' ports (`3401`+ range already used elsewhere in
`contracts/checks/*/`); grep `contracts/checks/*/_shared.mjs` for `PORT` before reusing any
port in a future contract. Overridable via `ADMIN_SESSION_REFUSAL_CHECK_PORT` for local
collision avoidance.

### Build precondition

`next start` requires a production build. `_shared.mjs`'s `ensureBuilt()` always runs
`pnpm build` before spawning the server (this can take a couple of minutes — expected, not a
failure), regardless of whether `.next/BUILD_ID` already exists. This contract's whole point is
to mechanically enforce that a future refactor can't silently delete the `classifyRefusal` call
site; nothing in the gate forces a fresh build before these checks run, so reusing a stale
build would let A1-A3 pass against old compiled output even after the real call site was
deleted from `route.ts`/`admin-auth.ts`. Correctness of a security-relevant enforcement check
outweighs the extra build time on every run.

## Refusal cases chosen and why

`classifyRefusal`'s `reason` ternary (`lib/admin-auth.ts:72-78`) short-circuits in a fixed
order: `admin !== true` → `'no-claim'`; else `email_verified !== true` → `'email-unverified'`;
else (implicitly not on the allowlist, since `isAdminToken` already returned false) →
`'not-allowlisted'`. Three cases are exercised — not the mission brief's minimum of two — so
that all three branches of that ternary are proven independently reachable, each producing its
own distinct `reason` string, rather than leaving open the possibility that a future edit
collapses two branches into the same value and only one of two picked cases would have caught
it:

1. **`no-claim`** — a freshly signed-up Identity Platform account with no custom claims at all
   (`accounts:signUp` alone; `admin` is simply absent). Also naturally unverified, but
   `classifyRefusal` checks `admin` first, so this isolates that branch regardless.
2. **`email-unverified`** — `admin: true` set via `setCustomUserClaims`, but
   `emailVerified: false` on the Auth user (the default post-signup state — never flipped to
   `true`). Isolates the second branch: `admin` is satisfied, verification is not.
3. **`not-allowlisted`** — `admin: true` AND `emailVerified: true` (both explicitly set), on an
   account whose email is a randomly generated `@saoc-contract-check.invalid` address that is
   certain not to appear in `ADMIN_EMAIL_ALLOWLIST` (an RFC 2606 reserved TLD address a real
   committee member's real email can never collide with — same convention
   `admin-auth-hardening/_shared.mjs`'s `randomProbeEmail()` already uses). Isolates the third
   branch: the first two checks pass, only the allowlist membership fails.

A fourth check (A4) proves the converse — a genuinely admin-eligible token (all three
conditions satisfied, requiring the account's email to actually be added to
`ADMIN_EMAIL_ALLOWLIST` for the duration of that one check) produces **no** `[admin-auth]
refused` line at all. Without this, a `classifyRefusal` that unconditionally logs on every
request (success or failure) would pass every "does the line contain X" assertion above by
coincidence — A4 is what proves the log is conditioned on an actual refusal, not just always
firing.

## What each check asserts, precisely

For each of the three refusal cases (A1–A3):
- The real `POST /api/admin/session` response is `403` with body **exactly**
  `{ "error": "Forbidden" }` — no `reason`, no `email`, no extra field, confirming the
  documented "browser never learns why" property is intact (the fix this contract enforces must
  never regress into leaking refusal detail to the client while making the log itself more
  robust).
- The spawned server's captured stdout/stderr, over the window from immediately before that one
  request to immediately after, contains a line starting `[admin-auth] refused` whose logged
  object (`console.warn('[admin-auth] refused', { operation, reason, email })` — Node's default
  `console.warn` util-inspects the second argument, so the check greps/parses defensively
  rather than assuming exact JSON) contains **both** `reason: '<the exact case's reason>'` and
  the **exact probe email** used for that request — not merely that some refusal line appeared,
  which would pass even if the reason/email were wrong or stale from a prior request. Each check
  clears/marks the captured-log buffer position before making its own request so it only
  inspects output produced by that request, never residue from an earlier case in the same run.

A4 (success path, no leak):
- `POST /api/admin/session` for the fully-eligible account returns `200` with a `session` cookie
  set.
- The captured log window for that request contains **zero** occurrences of
  `[admin-auth] refused`.

Cleanup (folded into each of A1–A4, not a separate assertion): A1–A4 each run as their own
independent `node` process (one per `command:` in the contract) with no shared in-memory state
between them, so there is no single point where a cross-process "sweep everything" script could
run after all four. Instead, each of A1–A4 creates exactly one probe account, deletes it via
`accounts:delete` (self-delete by `idToken`, same mechanism
`admin-auth-hardening/_shared.mjs`'s `deleteAccountByIdToken` already uses) in a `finally`, and
confirms via `accounts:lookup` that it is actually gone — not merely that the delete call didn't
throw — before exiting. A4 additionally confirms its spawned server child process has actually
exited (observed exit, not just a signal sent) before it exits. No fixture accounts, sessions,
server processes, or allowlist-adjacent test state from this contract survive a single check's
own run.

A5 (`pnpm lint`): baseline hygiene on any check-harness files added — cheap, standard across
this project's contracts.

## Non-goals

- No change to `route.ts` or `admin-auth.ts` behaviour is proposed or required by this
  contract — F1 is the enforcement mechanism itself (the check harness), not a behaviour change.
  If A1–A4 pass against the CURRENT code unmodified, that's expected and correct: the point is
  that they would have failed had the `classifyRefusal(decodedIdToken);` call site at
  `route.ts:29` been deleted or gutted, which dev should spot-check by temporarily commenting
  that one line out locally, confirming A1–A3 go red, then restoring it — not part of the
  automated gate, just a sanity step worth doing once while implementing.
- No new refusal reasons, no changes to the allowlist format, no changes to session cookie
  behaviour.

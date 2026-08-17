# F4 (ticketing-foundation) — `roles` custom claim, AND-only composition, tooling, date-window lapse, one-time migration: decision record

## Scope boundary — what F4 is, and what it deliberately is NOT

F4 wires the `roles` custom claim (spec §5.4-§5.6) into `lib/admin-auth.ts`'s existing
authorization decision, and extends `scripts/admin-grant.ts`, `scripts/admin-revoke.ts`, and
`scripts/admin-list.ts` — plus a new `scripts/admin-migrate-roles.ts` — to use it. It builds
directly on F3's `lib/admin-roles.ts` (`CAPABILITIES`, `ROLE_NAMES`, `ROLE_TO_CAPABILITIES`,
`resolve()`), unmodified. F4 does **not** touch any route (`/api/admin/*`) to actually call
`hasCapability()` — wiring capability checks into real routes is out of scope for F4's contract;
this contract proves the decision function itself, exhaustively, offline. Route wiring happens
wherever each capability-gated surface is actually built (F5's `/api/admin/*` refusal proof, F8's
`issue-comp` route, etc.) and reuses `hasCapability()` as its single source of truth.

## The five new/extended modules `@dev` must implement

1. **`lib/admin-auth.ts` (extended)** — adds:
   - `export type RolesClaim = Record<string, string[]>;`
   - `export interface ShowWindow { startDate: Date; endDate: Date; }`
   - `export type ShowWindowLookup = (showId: string) => ShowWindow | null;`
   - `export function resolveRoleCapabilitiesForShow(roles: RolesClaim | null | undefined, showId: string, opts: { now: Date; lookupShowWindow: ShowWindowLookup }): Set<Capability>`
     — unions `roles['*']` (never date-limited) with `roles[showId]` (honoured only while `opts.now`
     falls within `opts.lookupShowWindow(showId)`'s `startDate`/`endDate`; a `null` lookup result
     means the per-show grant is **not** honoured, not defaulted open). Role-name resolution within
     each array delegates to `lib/admin-roles.ts`'s `resolve()` — unknown names contribute nothing,
     exactly as F3 already proved for that function in isolation.
   - `export function hasCapability(decoded: DecodedIdToken | null | undefined, showId: string, capability: Capability, opts?: { now?: Date; lookupShowWindow?: ShowWindowLookup }): boolean`
     — `if (!isAdminToken(decoded)) return false;` **first**, then checks
     `resolveRoleCapabilitiesForShow(decoded.roles, showId, ...).has(capability)`. This single
     `if`-then-check is the entire AND-only composition — there is no third code path.
2. **`lib/admin-grant-validation.ts` (new)** — `validateGrantArgs({ roles: string[]; show: string }): { ok: true } | { ok: false; reason: string }`.
   Refuses empty `roles`, empty `show` (no defaults for either — spec §5.6), any role name not in
   `ROLE_NAMES`, and any request where `show === '*'` and `roles` includes `'door-staff'` or
   `'manager'`.
3. **`lib/admin-revoke-plan.ts` (new)** — `computeRevokePlan(existingRoles: RolesClaim | undefined, target?: { role: string; show: string }): { newRoles: RolesClaim; revokeRefreshTokens: true; fullRevoke: boolean }`.
   No `target` → full revoke (`newRoles: {}`, `fullRevoke: true`). A `target` → removes that role
   from that show's array, pruning the show's key entirely if the array becomes empty.
   `revokeRefreshTokens` is `true` unconditionally, on every branch, including a no-op target.
4. **`lib/admin-orphan-roles.ts` (new)** — `findOrphanRoles(roles: RolesClaim | undefined): string[]`,
   deduplicated, checked live against `lib/admin-roles.ts`'s `ROLE_NAMES` (not a copy of it).
5. **`lib/admin-migrate-roles-plan.ts` (new)** — `computeMigrationPlan(accounts: { uid: string; admin?: boolean; roles?: RolesClaim }[]): ({ uid: string; action: 'grant'; newRoles: RolesClaim } | { uid: string; action: 'skip'; reason: string })[]`
   and `parseMigrationArgs(argv: string[]): { apply: boolean }` (`apply` true only when
   `'--apply'` is present).

`scripts/admin-grant.ts`, `scripts/admin-revoke.ts`, and `scripts/admin-list.ts` must import and
call (1)-(4) on their real validation/planning paths, not re-implement the logic inline — that is
what makes A6, A7, A8, and A9 test the scripts' real behaviour rather than a parallel
reimplementation the contract happens to agree with. `scripts/admin-migrate-roles.ts` (new) wires
(5) to the live Admin SDK.

## Why `hasCapability` reuses `isAdminToken`, not a parallel check

Design principle 3 (spec §2): *"One `lib/admin-auth.ts`, extended, not duplicated."* A second,
independent admin-plus-verified-plus-allowlisted check inside `hasCapability` could drift from
`isAdminToken` over time (e.g. a future fix to the allowlist check applied to one but not the
other). Calling `isAdminToken(decoded)` directly makes drift structurally impossible — there is
only one function that decides "is this token authenticated," and `hasCapability` is additive on
top of its answer, never a re-implementation of it. A3(d) and A3(e) are what prove reuse actually
happened, not merely that the two functions currently agree by coincidence — but each proves reuse
of a different half of `isAdminToken`'s gate, and neither alone is sufficient: A3(d) —
`email_verified: false` with an otherwise-valid owner claim — is refused, proving the
`email_verified` check is genuinely consulted; A3(e) — a valid, verified owner claim whose email is
NOT on `ADMIN_EMAIL_ALLOWLIST` — is refused, proving the allowlist check is genuinely consulted.
A3(e) exists because (a)-(d) all share one allowlisted email and so never exercise that branch on
their own: a mutant `hasCapability` that checks only `admin === true && email_verified === true`
(dropping `isAdminToken`, and with it the allowlist check entirely) would pass (a)-(d) unchanged.

## Why the date-window lookup is injected, not read live from Sanity inside `resolveRoleCapabilitiesForShow`

Spec §5.6 recommends a "short-TTL cached show lookup," and spec §5.4 argues the same hot-path
tradeoff already made for the claim itself (§5.4: *"adding a Firestore read to every scan for a
role lookup is the wrong trade at exactly the place reliability matters most"*) applies here too.
`resolveRoleCapabilitiesForShow` and `hasCapability` therefore take `lookupShowWindow` as a
parameter — a pure function from `showId` to `ShowWindow | null` — rather than reaching into
Sanity or a cache themselves.

**Judgement call, stated explicitly:** the actual short-TTL-cached implementation of
`ShowWindowLookup` (reading `show.startDate`/`show.endDate` from Sanity, per spec §4.1, with a
TTL cache layered on top so the door scanner's hot path doesn't take a network read on every scan)
is **not** built or tested by this contract. F4's contract proves the decision function is correct
for *any* lookup it's given; wiring a real, cached Sanity-backed lookup is deferred to wherever
`hasCapability()` is first called from a live route (F5 onward) — at that point a *default*
`lookupShowWindow` implementation needs to exist so callers aren't required to build one inline,
but its caching behaviour is a performance property, not a security one, and is exactly the kind
of thing this project's own coding rules push toward integration/manual verification rather than a
contract assertion (an assertion that "waits long enough to prove a TTL expired" is either flaky or
slow, and proves a cache library works, not that the security decision is correct).

## Why `resolveRoleCapabilitiesForShow` is a separate export from `hasCapability`

`hasCapability` is what routes call. `resolveRoleCapabilitiesForShow` is exported separately
because A4 and A5 need to inspect the resolved *capability set* directly (e.g. "is this set empty,"
"does it contain exactly these five") without going through the admin/verified/allowlisted gate
each time — that gate is already proven once, thoroughly, by A3. Keeping the two functions
separate, with `hasCapability` composed from the other two ((`isAdminToken`,
`resolveRoleCapabilitiesForShow`) rather than reimplementing role resolution inline, is what makes
each assertion test exactly one property instead of re-testing the admin gate in every fail-closed
and date-window check.

## The four live-migration-safety decisions

The migration mutates real Firebase Auth accounts, including `brad@inunu.net` — currently the
**sole** live admin. All four decisions below are stated explicitly per the mission brief's
instruction, and each has a corresponding assertion.

1. **Dry-run by default; mutating requires an explicit flag.** `parseMigrationArgs(argv)` returns
   `apply: false` unless `'--apply'` is literally present in `argv` — including when a plausible
   but wrong argument (a stray email address, typed out of habit from the other admin scripts) is
   passed alone. Proven by A10.
2. **Idempotent, and never overwrites an existing richer `roles` claim.** `computeMigrationPlan`
   grants `{'*': ['owner']}` *only* to accounts with `admin === true` **and** no existing non-empty
   `roles` claim. An account that already has `{'*': ['owner']}` (a second run) is skipped, not
   re-granted. An account holding a *different* claim (e.g. a per-show `manager` grant, however
   that came to exist) is also skipped — the migration adds a baseline claim to accounts that have
   none; it never merges into or replaces one that already exists. Proven by A11.
3. **The migration path does NOT call `revokeRefreshTokens()`.** A purely additive grant to the
   sole live admin's account must not invalidate that admin's own already-open session — waiting
   up to 5 days for natural expiry is fine for an *additive* claim (nothing that currently works for
   that account stops working), unlike a downgrade or revoke, which spec §5.5 correctly treats as
   security-critical to apply immediately. Enforced two ways: at the type level, the `'grant'`
   action variant of `MigrationAction` has no `revokeRefreshTokens` field at all (A2's compiler
   proof), and at the value level, no action `computeMigrationPlan` returns carries that key at
   runtime (A11's runtime proof). `scripts/admin-migrate-roles.ts` itself must never call
   `auth.revokeRefreshTokens(...)` anywhere in the file — this is the one property in this contract
   that cannot be proven behaviourally without a live Firebase project (see "What this contract does
   NOT prove" below) and is instead a hard implementation instruction to `@dev`, checked by code
   review and by the type-level guarantee above making the wrong shape impossible to construct from
   `computeMigrationPlan`'s own output.
4. **The contract assertion runs against a fake/in-memory account store, never live Firebase.**
   A11 constructs its own `accounts` array in-process; nothing in this contract calls
   `firebase-admin`, requires `.env.local` credentials, or touches network. The **live** run (real
   `listUsers()`, real `setCustomUserClaims()` against the actual project) is a separate, explicitly
   human-gated step — Brad or an operator running `scripts/admin-migrate-roles.ts --apply` by hand
   after reviewing the dry-run output — not something this gate ever executes.

## Every assertion and its defeating mutation

- **A1 (`pnpm type-check`).** Defeated by any F4 module with a type error, e.g. a `roles` field
  typed `string` instead of `RolesClaim`.
- **A2 (compiler fixture).** Defeated by: widening `RolesClaim`'s value type away from `string[]`;
  changing `hasCapability`'s signature; or — the one this fixture exists specifically to catch —
  adding a `revokeRefreshTokens` field to the `'grant'` variant of `MigrationAction`, which would
  make the `@ts-expect-error` on `grantAction.revokeRefreshTokens` stop erroring (an "Unused
  '@ts-expect-error' directive" compile error).
- **A3 (AND-only).** Defeated by any implementation where: `roles` alone (with `admin: false`)
  grants a capability; `admin: true` alone (with no `roles` claim) grants a capability; or
  `hasCapability` checks only `admin === true && email_verified === true` directly instead of
  calling `isAdminToken` — (d)'s `email_verified: false` case catches the `email_verified` half of
  that regression, and (e)'s not-on-the-allowlist case catches the allowlist half, which (a)-(d)
  cannot catch on their own because they all share one allowlisted email.
- **A4 (unknown-role fail-closed at the claim layer).** Defeated by `resolveRoleCapabilitiesForShow`
  throwing on, special-casing, or granting any capability for an unrecognised role name, or by an
  unrecognised name silently dropping a *real* role listed alongside it in the same array.
- **A5 (date-window lapse).** Defeated by: a per-show grant honoured outside its show's window; a
  per-show grant honoured when the show lookup returns `null`; or a `'*'` grant that stops being
  honoured outside some show's window (proving `'*'` accidentally became date-limited).
- **A6 (grant role-name validation).** Defeated by `validateGrantArgs` accepting an unrecognised
  role name, defaulting an empty `roles` or `show` to something non-empty, or a refusal reason that
  doesn't identify which role name was the problem.
- **A7 (grant scope restriction).** Defeated by `validateGrantArgs` accepting `door-staff` or
  `manager` scoped to `'*'` — including the mixed-role-list case, which specifically catches an
  implementation that only checks the *first* role in the list against the show scope.
- **A8 (revoke always revokes).** Defeated by any branch of `computeRevokePlan` — full, partial, or
  a no-op target — returning `revokeRefreshTokens: false` or omitting the field, or by a partial
  revoke that leaves a dangling empty-array key instead of pruning it.
- **A9 (orphan-role flagging).** Defeated by `findOrphanRoles` missing a role name absent from
  `ROLE_NAMES`, reporting a real, recognised role name as an orphan, or reporting the same orphan
  name twice when held under two show keys.
- **A10 (migration dry-run default).** Defeated by `parseMigrationArgs` returning `apply: true` for
  any input that doesn't literally contain `'--apply'` — this is the assertion that would catch an
  implementation that treats "an argument was passed" as implicit consent to mutate.
- **A11 (migration idempotent, no overwrite, no revoke).** Defeated by: re-granting an account that
  already holds `{'*': ['owner']}`; overwriting an account's different existing `roles` claim;
  granting a non-`admin` account; or any returned action carrying a `revokeRefreshTokens` key.
- **A12 (`pnpm lint`).** Defeated by any lint violation in the new/edited files.

## What this contract does NOT prove

- **That `scripts/admin-migrate-roles.ts` itself never calls `revokeRefreshTokens()`.** This is a
  property of a specific file's source, not of `computeMigrationPlan`'s output — see migration
  decision 3 above. The type-level and runtime proofs on the *plan* structure make the correct
  implementation the natural one to write (there's no `revokeRefreshTokens` field to forward), but
  a determined miswrite could still call `auth.revokeRefreshTokens(uid)` directly in the script
  alongside applying the plan. Left as a code-review-time instruction, not a contract assertion,
  because a source-grep for the string would be exactly the kind of weak, gameable check this
  project's `coding.md` and this mission's own standing rule (`agent_review` is a design smell)
  push against, and there is no live-account-free way to observe "a function was NOT called" at
  runtime short of mocking the Admin SDK module — which F4 deliberately avoids doing anywhere, to
  keep every check network-free and credential-free per the mission's hard live-migration
  constraint.
- **That a test account can actually be granted `manager` scoped to `nationalShow` and verified to
  hold it via a live Firebase project**, or that the one-time migration script runs without error
  against the real, deployed Firebase Auth user pool. Both are mission-brief "Done" criteria for F4,
  but both require live credentials and a live project — exactly what this contract is built to
  avoid needing. The live grant/revoke round trip is proven for real, against a real deployed host,
  in F13 (Lee-Ann's onboarding); the live migration run against `brad@inunu.net`'s actual account is
  a separate, explicitly human-gated step Brad or an operator performs once, by hand, after this
  gate is green and after reviewing the dry-run output.
- **That any `/api/admin/*` route actually calls `hasCapability()`.** No route is wired in F4 — see
  "Scope boundary" above. F5 onward proves specific routes refuse/allow correctly over real HTTP;
  F4 proves only that the decision function they'll call is itself correct.
- **The live, cached, Sanity-backed implementation of `ShowWindowLookup`.** See "Why the
  date-window lookup is injected" above — F4 proves the pure decision function against any lookup;
  building the real one is deferred to the first live caller.
- **British-English prose in in-repo comments is not separately gated by this contract** beyond
  what `pnpm lint` catches — this project's `coding.md` requires it in prose, and `@dev` should
  follow the existing F3 files' register, but there is no automated check for spelling convention
  here.
- **That a `roles` claim stays under Firebase's ~1000-byte custom-claims cap as grants
  accumulate.** @qa measured (2026-08-18) that a `manager` grant scoped to roughly 24 shows, or
  single-role grants across roughly 36 shows, pushes the JSON-serialised claim past the cap.
  Nothing on the grant path — `validateGrantArgs`, `computeRevokePlan`, or the live
  `scripts/admin-grant.ts` — checks total claim size before calling `setCustomUserClaims`. The
  first symptom in production would be a raw `auth/claims-too-large` error surfacing through
  whatever generic catch handler wraps the SDK call, with no advance warning to the operator.
  `computeRevokePlan`'s empty-key pruning (A8) slows this — it stops a revoked show from leaving a
  dangling entry — but does not prevent it, since active grants across many concurrent shows still
  accumulate. No size guard is built here: adding one is a real code change outside F4's brief and
  is logged to the backlog against F13's batch-grant tooling instead of being added ad hoc to this
  contract.
- **That a `lookupShowWindow` implementation which throws is handled gracefully.** Neither
  `resolveRoleCapabilitiesForShow` nor `hasCapability` catches an exception thrown by the injected
  lookup — it propagates straight out of `hasCapability` to the caller. This is fail-loud, not
  fail-open (a throwing lookup cannot accidentally grant a capability), so it is not a security
  defect, but it is an operational one worth flagging here: whoever wires F5's default,
  Sanity-backed `ShowWindowLookup` needs to know that a flaky lookup will surface as an unhandled
  500 on the calling route rather than a clean `403`, unless that route wraps the call in its own
  try/catch.

## Judgement calls made that the brief left open

1. **Function/module names.** The brief names files (`lib/admin-auth.ts`) and describes behaviour,
   but not every new pure module's name or the exact function signatures — `lib/admin-grant-
   validation.ts`, `lib/admin-revoke-plan.ts`, `lib/admin-orphan-roles.ts`, and
   `lib/admin-migrate-roles-plan.ts` are this architect's naming choice, made specifically so each
   script's validation/planning logic is extractable and unit-testable without invoking the Admin
   SDK — the brief's "invoking the grant script's validation path, not by grepping" requirement is
   otherwise unimplementable for an offline, credential-free contract.
2. **`computeMigrationPlan` includes non-admin and already-migrated accounts in its output, tagged
   `'skip'` with a reason, rather than silently omitting them.** Chosen for dry-run auditability —
   an operator running the dry-run should be able to see the full account list and why each one
   was or wasn't touched, not have to cross-reference a shorter "will be touched" list against a
   separate full account listing.
3. **A mixed role list is refused as a whole when it contains any scope-restricted role requested
   against `'*'`**, rather than partially granting the permitted roles and refusing only the
   restricted ones. Chosen because `admin-grant.ts` is a single atomic operation per spec §5.6 ("no
   defaults for either") — a partial grant would leave the operator uncertain what was actually
   applied without re-reading output carefully, and a single refused batch is the same "no default,
   the operator must state exactly what they mean" philosophy already governing `--role`/`--show`
   individually.
4. **`resolveRoleCapabilitiesForShow`'s `now` and `lookupShowWindow` are required in
   `opts` (no defaults), while `hasCapability`'s `opts` parameter is itself optional** with those
   two fields defaulting to `new Date()` and `() => null` respectively. This asymmetry is
   deliberate: `resolveRoleCapabilitiesForShow` is the low-level function every test in this
   contract calls directly and must never silently fall back to wall-clock time (that would make
   A5 flaky by construction); `hasCapability` is the ergonomic entry point real route code calls,
   where a caller that hasn't yet wired a real show-window lookup should still get *safe* (fail-
   closed: no per-show grants honoured) rather than *broken* (a thrown error) behaviour by default.

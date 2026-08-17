# F3 (ticketing-foundation) — capability set + `lib/admin-roles.ts` role→capability mapping: decision record

Full source: `docs/ticketing-system-foundation-spec.md` §5.2–§5.3, mission brief F3
(`.agent/memory/project/missions/2026-08-17-ticketing-foundation.md`).

## Scope boundary — what F3 is, and what it deliberately is NOT

F3 creates exactly one production file: `lib/admin-roles.ts`. It does **not** touch
`lib/admin-auth.ts` (the existing `admin: true` / `email_verified` / allowlist gate stays
byte-for-byte unchanged — verified by reading it in full, `lib/admin-auth.ts:1-113`, before
writing this contract), does not wire any route to a capability check, does not touch
`scripts/admin-grant.ts` / `admin-revoke.ts` / `admin-list.ts`, and does not add or read any
custom claim. All of that is **F4** ("`roles` custom claim (per-show map), AND-only
composition, revoke-on-mutate tooling..."). `lib/admin-roles.ts` is a pure, side-effect-free
constant module: it exports data and one pure function. Nothing in it reads `cookies()`,
Firestore, or Firebase Auth — F4 is the only feature that wires this module into a live
request path.

Grepped `lib/`, `scripts/`, `app/` for `admin-roles`, `ROLE_TO_CAPABILITIES`, and every one of
the seven capability strings before writing this contract — zero existing references
anywhere in the codebase. Clean slate, no collision, no consumer to account for.

## The module shape `@dev` must implement

```ts
// lib/admin-roles.ts

export const CAPABILITIES = [
  'view-admin-dashboard',
  'scan-checkin',
  'lookup-booking-ref',
  'search-buyers',
  'issue-comp',
  'issue-refund',
  'export-buyer-data',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_NAMES = ['door-staff', 'manager', 'owner'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const ROLE_TO_CAPABILITIES: Record<RoleName, ReadonlySet<Capability>> = {
  'door-staff': new Set(['scan-checkin', 'lookup-booking-ref']),
  manager: new Set([
    'view-admin-dashboard',
    'scan-checkin',
    'lookup-booking-ref',
    'search-buyers',
    'issue-comp',
    'issue-refund',
    'export-buyer-data',
  ]), // HAND-LISTED, deliberately NOT `new Set(CAPABILITIES)` — see "Contradiction found and resolved" below
  owner: new Set(CAPABILITIES), // every currently-defined capability, BY CONSTRUCTION — see below
};

export function resolve(roleNames: readonly string[]): Set<Capability> {
  const result = new Set<Capability>();
  for (const name of roleNames) {
    const bundle = (ROLE_TO_CAPABILITIES as Record<string, ReadonlySet<Capability> | undefined>)[
      name
    ];
    if (!bundle) continue; // unrecognised role name -> contributes nothing, fail-closed
    for (const cap of bundle) result.add(cap);
  }
  return result;
}
```

This exact shape was written, dropped into `lib/admin-roles.ts` temporarily, and run against
every check in this contract (all pass) as part of designing this contract — see "Evidence"
below. `@dev` does not have to use this literal code, but the exported surface
(`CAPABILITIES`, `Capability`, `ROLE_NAMES`, `RoleName`, `ROLE_TO_CAPABILITIES`, `resolve`)
is what every check imports by name and must exist with these exact identifiers.

## Contradiction found and resolved (2026-08-18 revision)

The original version of this README shipped self-contradictory: the code block above showed
`manager: new Set(CAPABILITIES)` (derived, same as `owner`), while the prose in "Why `owner`
must be derived, not hand-listed" argued the opposite — that `manager` "stays hand-listed
deliberately." `@dev` implemented from the code block; the team lead caught the divergence by
reading `lib/admin-roles.ts:27` directly against the prose. **The prose was correct; the code
block was the error, and the code block above is now fixed to match it.**

`manager` must be **hand-listed**, not derived. `manager` already holds
`export-buyer-data` — the single most POPIA-sensitive capability in the set, granted to
Lee-Ann's role. Deriving it from `CAPABILITIES` (the `owner` pattern) would silently grant
Lee-Ann every future capability the instant it's added to the fixed set, with no review step
and no code change to `manager`'s own line — exactly the over-grant-by-default failure mode
spec §5.1 exists to prevent, just at the role-bundle layer instead of the base-claim layer.
`owner` is *supposed* to auto-inherit new capabilities (that is its whole definition, per
spec §5.3: "every currently-defined capability, full stop"); `manager` is not — it is Brad's
named, reviewable config choice about what Lee-Ann can do, and a future capability may
reasonably need to be withheld from `manager` while still belonging to `owner`.

**Why `resolve()` takes `readonly string[]`, not `RoleName[]`:** F4's custom-claim resolution
will pass whatever role-name strings are actually stored in a Firebase custom claim —
untrusted, mutable-by-a-future-editor data at runtime, not a compile-time-checked literal.
Typing the parameter as `RoleName[]` would make the "unknown role resolves to empty set"
guarantee a type-checker-only fiction, unreachable in the one place (F4) that actually needs
it. `string[]` is the honest input type; the runtime fallback-to-empty inside `resolve()` is
where fail-closed actually lives.

## Why `owner` must be derived, not hand-listed

The dispatch brief is explicit that `manager` and `owner` being identical today is
**intentional, not a bug** — spec §5.3's own table lists them as equal sets. But the spec
also defines `owner` semantically as *"every currently-defined capability, full stop"* — a
statement about the relationship between `owner` and the fixed set, not a snapshot of what
that set happens to contain today. If `owner`'s bundle is a second hand-typed literal
(`new Set(['view-admin-dashboard', 'scan-checkin', ...])`, duplicating `manager`'s list),
then the day a new capability is added to `CAPABILITIES` for some future route, `owner` goes
stale silently — nothing fails, `owner` just quietly stops meaning "everything." Deriving it
(`new Set(CAPABILITIES)`) makes that impossible: `owner` mechanically tracks the fixed set by
construction, and A6 (`check-owner-derived-from-fixed-set.mjs`) is the regression guard that
would catch a future hand-listing regression (see "Evidence" below — proven to fail if the
map is emptied, which is the same failure shape a stale hand-listed `owner` would eventually
produce: `resolve(['owner'])` silently missing a real capability).

`manager` stays hand-listed deliberately — per the brief, it is a config choice ("everything
to do with tickets," per Brad, minus nothing today, but that's a decision about Lee-Ann's
role, not a structural guarantee like owner's). A future capability might reasonably be
withheld from `manager` while still belonging to `owner`; deriving `manager` from the fixed
set the same way `owner` is would make that future distinction impossible to express. (This
is the same conclusion the "Contradiction found and resolved" section above restates — see
that section for how a code-block/prose mismatch briefly let the opposite ship.)

**Can this be asserted at all — is "hand-listed" even checkable?** `@qa` established
behaviourally that `manager: new Set([...seven literals...])` and `manager: new
Set(CAPABILITIES)` are **indistinguishable by calling `resolve()`** — both currently return
the identical 7-member `Set`. This is an authorship/construction property, not a runtime
one, so no behavioural check (a real function call) can see it — A3/A5/A6 all stayed green
through the actual regression. **A8 (`check-manager-hand-listed-source.mjs`) is therefore a
deliberate, justified exception to this contract's "no source-greps" standard**: it reads
`lib/admin-roles.ts`'s source text and asserts `manager`'s bundle is a literal array
(`new Set([...])`, not `new Set(CAPABILITIES)`, not a spread, not an alias of `owner`),
containing exactly the seven real capability strings. This is the one place in the contract
where checking the source is the *correct* instrument, precisely because the property under
test — "how was this constructed," not "what does it currently contain" — only exists in the
source. Verified live (see A8's own file header): fails with "could not find manager: new
Set([...literal strings...])" against the exact regression that shipped
(`new Set(CAPABILITIES)`), and passes against the correct hand-listed form.

**A6 deliberately does not assert `owner !== manager`.** They are equal today, by design, and
asserting inequality would make this contract fail against its own correct target shape. What
A6 asserts is narrower and durable: `resolve(['owner'])` equals the full `CAPABILITIES` set,
exactly, every time — a property that holds regardless of whether `manager` ever diverges
from it.

**Narrowed claim (2026-08-18 revision, per `@qa`):** A6 does **not** prove `owner` is
*derived* — it proves `owner`'s *contents* equal `CAPABILITIES` at call time. Those are
different claims: a hand-listed `owner` that currently, coincidentally, lists all seven
capabilities would pass A6 identically to a genuinely derived one — A6 cannot see
construction, only current output, for the same reason A8 exists as the source-level
exception for `manager`. What A6 actually catches is narrower but still real and durable:
**future drift**. If a capability is later added to `CAPABILITIES` and `owner`'s bundle isn't
updated to match — whether `owner` was originally hand-listed or derived — A6 fails the
moment that happens, because `resolve(['owner'])` will then be missing a member
`CAPABILITIES` has. That regression-catching property holds regardless of authorship
mechanism. It does not, and was never run to, prove *present* authorship — only `git blame`/
code review proves that today, the same as it always did before this contract existed.

**Why only `manager` gets a source-level construction check (A8), not `owner` too:**
`owner`'s construction mechanism is a maintenance/staleness concern, not a security one —
whether `owner` is hand-listed-and-currently-correct or genuinely derived, it is *supposed*
to equal "everything," so there is no over-grant risk either way, only a risk of silently
falling behind (which A6 already catches on the next capability addition, per above).
`manager`'s construction mechanism IS a security concern: a derived `manager` silently
over-grants Lee-Ann's role the instant `CAPABILITIES` grows. That asymmetry — one role where
staleness is the only risk, one role where staleness would BE the security hole — is why A8
exists for `manager` specifically and not as a general "assert every role's construction
style" pattern.

## The TS-import problem, and how it's solved (with evidence, not assumption)

**Problem:** `lib/admin-roles.ts` is TypeScript. F2's checks were `.mjs` files that imported
project `.ts` modules directly (e.g. `check-national-show-tickets-unchanged.mjs` importing
`../../../lib/firebase-admin.ts`) — but that precedent was never independently verified for a
module with *no* Firestore/network dependency, and the brief explicitly requires running it,
not assuming F2's pattern generalises.

**Verified live, this session, in this repo, on the actual installed toolchain** (`node
v26.4.0`, `tsx v4.22.4`, `typescript ^5.7.0` — repo docs say "Node 22 runtime" for
production/Firebase App Hosting, but the local dev toolchain installed here is v26; both
support the invocation below identically, `--import tsx/esm` is a Node 20.6+/22+ ESM loader
hook, not a version-specific feature):

```
$ node --import tsx/esm some-check.mjs   # importing a plain, dependency-free .ts module with an explicit .ts extension
```

This resolves and executes the real `.ts` file's real exports with zero transpile-time
errors, from a script with a `.mjs` extension — confirmed with a disposable smoke-test module
outside the repo first, then confirmed again with the exact target shape (above) written
temporarily to `lib/admin-roles.ts` and every check script in this contract run against it
live: all five (`A2` typecheck, `A3`, `A4`, `A5`, `A6`) passed. `npx tsx <file>.mjs` was also
verified to work identically; `A3`–`A6`'s commands use `node --import tsx/esm`, matching F2's
own convention, for consistency across the mission's contracts.

**Solution adopted:** every behavioural check (`A3`–`A6`) is a `.mjs` script that imports
`lib/admin-roles.ts` directly with an explicit `.ts` extension
(`import { resolve } from '../../../lib/admin-roles.ts'`) and invokes the real exported
`resolve()`, `CAPABILITIES`, and `ROLE_NAMES` — no reimplementation of the capability map in
JS anywhere in this contract. Run via `node --import tsx/esm <script>.mjs`.

**Evidence the harness actually catches a deleted or emptied module — not asserted, run:**

- **Deleted:** with `lib/admin-roles.ts` removed entirely, `node --import tsx/esm
  check-fixed-set-coverage.mjs` throws `ERR_MODULE_NOT_FOUND` at the top-level `import`
  statement, before any assertion body runs, and exits `1`. The gate fails loudly on the
  import itself.
- **Emptied map:** with `ROLE_TO_CAPABILITIES` rewritten so every role bundle is an empty
  `Set()` (module otherwise intact and still importable), `check-fixed-set-coverage.mjs`
  fails with all 7 capabilities individually reported as "dead capability, not granted by
  any role," and `check-owner-derived-from-fixed-set.mjs` fails with `resolve(['owner'])
  has 0 capabilities, expected exactly 7` plus all 7 members individually reported missing.
  Both real console output, both exit `1`.

A check that reimplemented the capability map in JS (rather than importing the real module)
would pass unchanged in both of these cases — that is exactly the failure mode this design
avoids, and the two runs above are the proof it doesn't happen.

## The eight assertions — what each proves, and by what mechanism

| ID | Proves | How (not what) |
|---|---|---|
| A1 | Whole-project strict TS compiles with the new file present | `pnpm type-check` |
| A2 | `Capability` is a closed 7-member union — a typo'd 8th string fails to compile | Real `tsc -p` invocation against a scoped tsconfig + fixture asserting all 7 literals plus one `@ts-expect-error` |
| A3 | Every fixed capability is granted by ≥1 real role; no role grants a capability outside the fixed set | Real `resolve()` calls for every name in `ROLE_NAMES`, union inspected, each returned member checked against the fixed set |
| A4 | Unknown role names resolve to the empty set, alone or mixed with a real role, without disturbing the real role's resolution | Real `resolve(['unknown-role'])`, `resolve([])`, `resolve(['unknown-role','manager'])` calls, compared to `resolve(['manager'])` |
| A5 | `door-staff` holds exactly `{scan-checkin, lookup-booking-ref}` and none of the other five — the critical negative control | Real `resolve(['door-staff'])` call, checked against all 5 withheld capabilities individually plus exact `Set` size |
| A6 | `owner`'s *contents* equal the full fixed set exactly right now, and will keep doing so as `CAPABILITIES` grows (does NOT prove derivation/authorship — see narrowed claim above) | Real `resolve(['owner'])` call, compared member-for-member against `CAPABILITIES` |
| A7 | No lint regressions | `pnpm lint` |
| A8 | `manager`'s bundle is a hand-listed literal array in source, not derived from `CAPABILITIES` and not aliased to `owner` — an authorship property A3/A5/A6 cannot see behaviourally (see "Can this be asserted at all" above) | Reads `lib/admin-roles.ts` source text, isolates the `manager:` entry, asserts it opens with a literal `new Set([` (not `new Set(CAPABILITIES)`/spread), contains no reference to `CAPABILITIES`/`ROLE_TO_CAPABILITIES`/`owner`, and lists exactly the 7 real capability strings |

A1–A7 are behavioural: the real TypeScript compiler or a real invocation of the exported
`resolve()` inspecting actual `Set` contents, none of them grepping `lib/admin-roles.ts`'s
source text. **A8 is a deliberate, justified exception** — see "Can this be asserted at all"
above for why the property it checks (construction, not output) is only visible in source.
Zero `agent_review` assertions; A8 is a `shell`-kind source check, not a human-review gate.

## Why `capability-typecheck.ts`'s seven literals must stay hard-coded, never `import { CAPABILITIES }`

`@qa` proved live that `contracts/checks/ticketing-f3-admin-roles/fixtures/capability-typecheck.ts`
is the **only** check in this contract that catches a capability renamed identically in both
`CAPABILITIES` and every `ROLE_TO_CAPABILITIES` bundle at once (e.g. `'issue-comp'` renamed
to `'issue-comps'` everywhere, consistently). Under that mutation, A3 (coverage), A5
(door-staff negative control), and A6 (owner content check) **all stayed green** — every one
of them compares `resolve()`'s output against `CAPABILITIES` *imported from the same module
being tested*, so a consistent rename is invisible to a comparison that both sides shift
with. Only A2 caught it, and only because its fixture's seven capability strings are
**hard-coded literals independent of `lib/admin-roles.ts`** — the fixture has its own,
separately-typed opinion of what the seven capabilities are, and a real rename in the source
breaks assignability against that fixed, independent expectation.

**This means the fixture's literals must never be "simplified" to
`import { CAPABILITIES } from '../../../../lib/admin-roles'` and then iterated/spread.**
That refactor looks like a reasonable DRY cleanup — it would still compile, and A1/A2 would
still pass against a correctly-implemented module — but it silently deletes the one check in
this contract that has an independent opinion of what the capability set should be. A
consistent, whole-set rename (or, more subtly, one capability silently swapped for a
plausible-sounding new one across every file at once) would then pass every assertion in
this contract, A2 included. `fixtures/capability-typecheck.ts` carries a code comment stating
this explicitly, next to the seven literals.

## What was wrong in the brief / spec, corrected here

Nothing factually wrong was found in the F3 dispatch brief or spec §5.2–§5.3 — unlike F1 and
F2, this brief's role/capability tables, the "manager and owner are intentionally identical"
framing, and the three named required assertions all checked out against the spec text and
against a live grep of the codebase for collisions. The one thing genuinely underspecified
by the brief (how `owner` should avoid going stale) is resolved above by deriving it from
`CAPABILITIES` rather than hand-listing it — a design decision, not a correction of an error.

## Hard constraints verified respected

- `lib/admin-auth.ts` not modified — read in full (`lib/admin-auth.ts:1-113`) before writing
  this contract; nothing in this contract's checks or golden module touches it.
- No route wiring, no custom-claim code, no script changes — confirmed by scope: the only
  file `lib/admin-roles.ts`'s own checks import is `lib/admin-roles.ts` itself.
- No Firestore or Sanity document read, written, or deleted anywhere in this contract — every
  check is a pure in-process function call against a constant module.
- No secrets, no `.env` reads — this module has no external dependency of any kind.

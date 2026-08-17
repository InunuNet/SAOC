# F1 golden spec — lock/timeout invariant

## Constants (`contracts/checks/ticketing-hardening/_shared.mjs`)

Add, near the existing `LOCK_WAIT_MS` declaration (do not change its value —
90s is deliberate, see README "Decision on point 1"):

```js
export const LOCK_WAIT_MS = 90_000; // was already a module-private const; now exported
export const ASSERTION_TIMEOUT_SAFETY_MARGIN_MS = 30_000;
export const MIN_ASSERTION_TIMEOUT_MS = LOCK_WAIT_MS + ASSERTION_TIMEOUT_SAFETY_MARGIN_MS; // 120_000
```

The 30s margin covers real DNS + PayFast-sandbox HTTPS round trips after a
full lock wait — do not shrink it to make an existing timeout_seconds value
"just barely" pass; if a check genuinely can't fit, raise its
`timeout_seconds`, not the margin's justification.

## contract-payfast-m1.yaml edits

Every assertion whose `command` invokes a script that transitively imports
`ticketing-hardening/_shared.mjs` — through any chain of static imports,
`export * from`, `export { x } from`, side-effect imports, or literal-string
dynamic `import(...)` — must declare:

```yaml
timeout_seconds: 120
```

At the time this contract was written that is A18, A19, A20, A21, A30, A31,
and A34. **A30/A31 run two scripts in one `command`** (`check-itn-atomic-
idempotent-write.mts && check-paid-write-inside-transaction-scope.mjs`).
Decision: keep them as one `command` with `timeout_seconds: 150`, not split.
Only the first script (`check-itn-atomic-idempotent-write.mts`, via
`_itn-harness.mts`) imports `_shared.mjs` and takes the suite lock; the
second (`check-paid-write-inside-transaction-scope.mjs`) is a pure AST/source
read of `_ast-shared.mjs` and never touches `_shared.mjs` or the lock. The
mechanical check below verifies this per-script, not by trusting this
paragraph — see "Multi-script commands" below. Do not hand-copy the ID list
into the mechanical check — it must discover the list itself by following
the import graph, so a *future* addition is covered automatically **within
the limits stated in "Honest remaining ceiling" below** — that qualifier is
load-bearing, not boilerplate.

## New check — `contracts/checks/payfast-m1/check-lock-timeout-invariant.mjs`

Two halves:

1. **Pure comparator self-test (always runs, no credentials).** A pure
   function, e.g. `checkTimeoutCovers(lockWaitMs, marginMs, timeoutSeconds,
   lockWaitingScriptCount = 1)`, returns `null` when `timeoutSeconds * 1000 >=
   lockWaitingScriptCount * (lockWaitMs + marginMs)`, a descriptive problem
   string otherwise. Self-test with synthetic values proving it accepts a
   covering timeout, rejects a timeout below the threshold, rejects a timeout
   exactly equal to `lockWaitMs` alone (covering the lock wait with zero
   network slack is still a fail — the margin is not optional), and — for
   the multi-script case — accepts/rejects correctly when
   `lockWaitingScriptCount > 1`. Same "prove the comparator can still
   discriminate" convention as `judgeResidue`'s existing self-test.
2. **Live check against the real files.** Imports `LOCK_WAIT_MS` and
   `MIN_ASSERTION_TIMEOUT_MS` from `_shared.mjs` (no credentials needed —
   these are plain exported constants). Reads `contracts/contract-payfast-m1.yaml`
   and, for every assertion, resolves its `command` to the script path(s) it
   invokes, then RECURSIVELY walks each script's own import graph (see
   "Import-graph walk" below) to determine whether it transitively imports
   `ticketing-hardening/_shared.mjs`. For every assertion with at least one
   such script, runs `checkTimeoutCovers` against its declared
   `timeout_seconds`, passing the count of lock-waiting scripts in that one
   command as `lockWaitingScriptCount`. Fails loudly, listing every offending
   assertion ID and its current vs. required `timeout_seconds`, if any fail.

### Import-graph walk

Generic and recursive, not one hardcoded hop: starting at the entry script,
follows every specifier reachable via `from '...'` (covers `import ... from`,
`export * from`, `export { x } from`), bare side-effect `import '...'`, and
dynamic `import('...')` / `await import('...')` **with a literal string
argument**. A specifier is classified `found` the instant its own text ends
with `ticketing-hardening/_shared.mjs` — before attempting to open the file
it points at, so a specifier that is textually correct but does not actually
resolve on disk is still classified correctly (this is why
`fixtures/stand-in-lock-waiting-script.mjs`'s deliberately-broken relative
path still works for A3). Local specifiers that don't literally end with the
suffix are resolved (pure path-segment math, with an extension-probe
fallback — `.ts`/`.mts`/`.tsx`/`.mjs`/`.js`/`.jsx`, then `/index.<ext>` — for
specifiers written without an extension, e.g. `../lib/payfast`) and, if a
readable file exists there, recursed into. Cycle-safe via a per-walk visited
set. Bare/aliased specifiers (`dotenv`, `node:dns`, `@/lib/payfast`) are
skipped as external — `_shared.mjs` is only ever reached through this
codebase's own relative-path tree, never a package or a `@/` alias, as of
this writing.

### UNRESOLVED handling (point 2 — never silently "not lock-waiting")

Two situations the walk cannot follow to a conclusion:

- a local (`.`/`/`-prefixed) specifier whose resolved path (including the
  extension-probe fallback above) is not a readable file;
- a dynamic `import(...)` whose argument is not a string literal (a
  variable, a template expression — see `_itn-harness.mts`'s
  `import(/* @vite-ignore */ override)`).

Both are treated as **UNRESOLVED**, and an assertion with an unresolved
script in its command is required to meet the `120s` floor exactly as if it
were a confirmed match — never silently downgraded to "not lock-waiting".
This is deliberately conservative: it can force a timeout floor onto a
script that, if the unresolved branch could be followed, would turn out not
to import `_shared.mjs` at all — a false positive, not the false negative
this hardening pass exists to close. The live check prints a `NOTE:` line
naming every assertion this applied to, so it is visible, not silent.

### Multi-script commands

`contract.py`'s `timeout_seconds` applies to the WHOLE command, and a
multi-script command (`scriptA && scriptB`) runs its scripts sequentially.
Each script is walked independently; the number of scripts in one command
that come back `found` or `unresolved` is passed to `checkTimeoutCovers` as
`lockWaitingScriptCount`, so the required floor scales linearly with how
many of that command's scripts could independently need a full lock wait —
worst case, each one does. A30/A31 today has exactly one such script
(`check-itn-atomic-idempotent-write.mts`; the second script imports only
`_ast-shared.mjs`), so its required floor is `120s` and its declared `150s`
passes with margin. If a future edit makes the second script lock-waiting
too, the required floor becomes `240s` and the check will fail until
`timeout_seconds` is raised to match — this is the generic mechanism doing
its job, not a special case for A30/A31.

### Honest remaining ceiling

State plainly, not as a hedge: this walk is a static, text-based parse. It
is defeated by anything that isn't literal, static text naming
`_shared.mjs` (directly or transitively) — a computed module specifier built
from string concatenation or a template literal with a non-trivial
expression, a `require()` call (this codebase is ESM-only for these scripts,
so not exercised, but the regex does not match `require`), or an import
mediated by a build step / path-alias resolution this script doesn't model
(see "bare/aliased specifiers" above — a future `@/`-style alias that
*could* reach `_shared.mjs` would be silently skipped, not flagged; this is
a stated, not a proven-safe, assumption). Every one of those defeats is
still contained by the UNRESOLVED-handling rule above **provided the
computed specifier is inside a dynamic `import(...)` call** (it will be
flagged unresolved and forced to the floor) — the one gap UNRESOLVED
handling does NOT cover is a bare/aliased specifier that turns out to
secretly reach `_shared.mjs`, since that case is skipped, not flagged. That
is the honestly remaining ceiling: "covers every future assertion
automatically" was true only up to that gap, not unconditionally, and this
file no longer claims otherwise.

## Fast early-signal check — `contracts/checks/payfast-m1/check-known-ids-timeouts.mjs`

A small, deliberately simple companion to the mechanical check above (A4 in
the contract) — reads `contracts/contract-payfast-m1.yaml` as text, and for
each of the known-as-of-authoring affected IDs (`A18, A19, A20, A21, A30,
A31, A34`) extracts that check's `timeout_seconds` value and fails, listing
every offender, if any is below `120`. Single-line-command-friendly (no
embedded newlines in the contract's own `command:` field — parse the YAML
file from within the script itself, not from a shell one-liner). This is
intentionally the "fast, cheap, will go stale if the ID list changes"
half — A2/A3 are the mechanical proof (self-updating within the ceiling
stated above); this one exists only so a quick `pnpm exec tsx` catches the
common case without needing the full import-graph walk.

### Negative controls

Support a `--fixture <path>` mode (same convention as
`scan-firestore-residue.ts`) that reads a small stand-in YAML with one
assertion whose command points at a stand-in script importing `_shared.mjs`
and whose `timeout_seconds` is deliberately `10` — confirm the check FAILS
against this fixture (`fixtures/low-timeout.yaml`, A3). Then confirm it
PASSES against the real, unmodified `contract-payfast-m1.yaml` once the
timeouts above are applied. Both runs' terminal output are the assertion's
evidence.

A second, separate negative-control fixture
(`fixtures/barrel-import-evasion.yaml`, A21-BARREL-IMPORT-EVASION-CONTROL)
reproduces @qa's original defeat of the one-hardcoded-hop version of this
check: its entry script (`fixtures/stand-in-barrel-entry.mjs`) reaches
`_shared.mjs` only through a *different* re-export chain
(`fixtures/stand-in-barrel-intermediate.mjs`'s `export * from`), not through
`_itn-harness.mts` and not a direct import. Confirm the check FAILS against
this fixture too — this is the regression guard that keeps the generic walk
from silently regressing back to one hardcoded hop.

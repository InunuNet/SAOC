# payfast-m1-lock-cleanup-fix

P1 fix for Firestore `tickets` fixture residue. Full diagnosis was produced by
@analyst before this contract was written; this document restates it plus the
decisions this contract makes, so dev has no latitude to reinterpret the
diagnosis while implementing.

## Diagnosis (restated from @analyst, not re-derived here)

**Leak path 1 — structurally invisible sentinel domain. DORMANT, already
cataloged.** `contracts/checks/ticketing-hardening/_shared.mjs:51` hardcodes
one sentinel domain (`harden-check.invalid`); `scripts/scan-firestore-residue.ts`
independently hardcodes its own regex for the same domain. Two independent
literals for one fact is exactly the drift risk this contract's F3 closes.
The 7 `attendeeName: 'Proof'` docs that leaked through this path on
2026-08-16 (domain `@payfast-m1-check.invalid`, `PROOF-A##` naming, no longer
produced by any script in the tree) are already caught by literal document-ID
in `KNOWN_RESIDUE_DOC_IDS` (`scripts/scan-firestore-residue.ts:79-87`). No new
instances since 2026-08-16. This contract does not reopen that catalogue or
add code to explain the docs' origin — see
`contracts/golden/payfast-m1-residue-cleanup/leaked-docs-2026-08-16.md` for
why that gap stays open as a factual gap, not a rationalized story.

**Leak path 2 — timeout inversion kills cleanup. ACTIVE, this is what F1/F2/F4
fix.** `execution/contract.py` SIGKILLs a shell assertion's subprocess at
`timeout_seconds` (default 60s; none of A18/A19/A20/A21/A30/A31 in
`contract-payfast-m1.yaml` override it). `_shared.mjs`'s suite lock
(`LOCK_WAIT_MS = 90_000`) can make a check wait up to 90s for a competing
process to finish, which exceeds the 60s kill ceiling. `process.on('exit',
releaseLock)` fires synchronously (so the lock IS released — no wedge) but the
awaited `finally` block's `sweepSentinels()`/`assertNoResidue()` never runs on
a SIGKILL, so cleanup loses while the lock survives. The 10 `Harden
Check`-attendeeName docs in two batches 2 minutes apart, each ending at the
same partial-scenario cutoff (`A20-TAMPER, A20-MATCH, A20-BOUNDARY-REJECT`
then `A1921-INVALID, A1921-PENDING`), are strong circumstantial confirmation
— reproducible kill point under contention.

**What is PROVEN vs CIRCUMSTANTIAL (do not overstate either direction):**
- PROVEN: `process.on('exit', ...)` fires synchronously on kill; awaited
  `finally` async work does not. Demonstrated on a harmless stand-in process
  tree.
- PROVEN: `LOCK_WAIT_MS` (90s) numerically exceeds contract.py's default
  `timeout_seconds` (60s), and none of the affected assertions override it.
- CIRCUMSTANTIAL, not directly observed: nobody watched the real 60s-vs-90s
  collision happen live with a stopwatch against the real gate — doing so
  would create more residue. The doc-timestamp pattern (two batches, same
  partial-scenario cutoff, 2 minutes apart) is consistent with repeated kills
  under lock contention but is not a witnessed reproduction.
- This contract's F4 (new A34) closes that gap for real, going forward: it
  deliberately reproduces a kill against a decoy fixture (not the real suite)
  and proves the identity-based detector catches the resulting orphan. That
  is a witnessed reproduction of the *mechanism*, on a stand-in, not proof
  that this exact mechanism explains 100% of the 10 historical docs.

**A34 was blind to path 2** (`contracts/checks/payfast-m1/check-suite-leaves-no-ticket-residue.mjs`):
spawns sub-scripts with no timeout of its own, so it never experiences the
external-timeout collision; and it is delta-only (count before vs. after),
which a same-count leak-and-unrelated-cleanup swap can defeat.

## Decision on point 1 — timeout/lock-wait inversion

**Chosen: raise `timeout_seconds` on the affected assertions, not lower
`LOCK_WAIT_MS`.**

Rejected alternative (lowering `LOCK_WAIT_MS` below 60s): these checks do
real DNS lookups and signed PayFast-sandbox HTTPS round trips per scenario,
several scenarios per script. A 90s lock-wait ceiling exists on purpose (see
`_shared.mjs`'s own header comment on the 2026-08-12 A7 flake) to tolerate
*real* contention between two legitimately slow network-bound checks running
concurrently. Shrinking it under real contention does not remove the failure
mode — it just turns a silent SIGKILL into a legitimate, honest lock wedge or
an artificially early giveaway (the lock's `holderIsGone` timeout is 600s
independently). That is a worse trade: correctness under load matters more
than a tighter number.

**Chosen fix, two parts:**
1. Every `contract-payfast-m1.yaml` assertion whose command (transitively)
   imports `ticketing-hardening/_shared.mjs` declares `timeout_seconds` at
   least `LOCK_WAIT_MS + 30_000` (120s), so a full lock wait can complete and
   the script still has real network slack afterward.
2. The invariant itself — kill ceiling > lock ceiling — is asserted
   **mechanically**, not just fixed once. `_shared.mjs` exports `LOCK_WAIT_MS`
   and a derived `MIN_ASSERTION_TIMEOUT_MS = LOCK_WAIT_MS + 30_000`. A new
   check (F1/A3 below) parses `contract-payfast-m1.yaml`, discovers every
   assertion whose command references a script that imports `_shared.mjs`
   (by following the import graph, not a hand-maintained ID list — so a
   *future* assertion added without an adequate `timeout_seconds` is caught
   the same day, not rediscovered as another residue incident), and fails if
   any such assertion's `timeout_seconds` is below `MIN_ASSERTION_TIMEOUT_MS`.
   If `LOCK_WAIT_MS` is ever changed, the check re-derives its threshold from
   the same constant — no second place to remember to update. The walk is a
   generic, recursive, text-based import-graph walk (not one hardcoded hop
   through a specific file) — see
   `lock-timeout-invariant.golden.md`'s "Honest remaining ceiling" section
   for exactly what it can and cannot follow, and "Multi-script commands"
   for how a command running more than one script (A30/A31) is handled.

## Point 2 — crash-resilient cleanup (manifest + preflight sweep)

Adopted, per the task brief's proposed shape, evaluated and accepted: F1
removes the *routine* trigger for a kill during normal operation, but does
not make cleanup itself resilient to a kill from any other cause (CI runner
OOM, a future assertion with its own bug, a manual Ctrl-C that races the
signal handlers). Defense in depth is warranted specifically because this
project has already shipped one false-green detector
(`payfast-m1-residue-cleanup`'s own F1 was a *regression guard*, not a first
fix — see that golden's README) and a scanner blind spot in the same session;
relying solely on "the timeout no longer collides" is a single point of
failure with the same class of consequence (live-database residue) if it's
ever wrong again.

Shape: every doc a fixture write creates has its ID recorded to a manifest
file **synchronously** (`writeSync`/`appendFileSync`, not the promise-based
fs API — the same "helpers throw, never `process.exit`" discipline `_shared.mjs`
already documents, applied to disk I/O: a write that hasn't returned before a
kill cannot be trusted, a synchronous one that has returned, can) at doc-ref
generation time, *before* the Firestore write is attempted. Every
`withCleanup()` call runs a preflight sweep of any manifest entries left by a
run that never confirmed completion, before doing anything else. Manifest
entries are cleared only *after* `assertNoResidue()` has confirmed clean, so
a kill between the sweep and the clear just means the preflight repeats a
sweep on already-clean IDs — a safe no-op, not a new failure mode.

This decouples cleanup from the survival of the process that created the
fixtures: a kill anywhere in the run leaves a manifest trail the *next* run
cleans up unconditionally, without needing to know why the prior run died.

## Point 3 — unified sentinel detection

New module `contracts/checks/_shared/sentinel-domains.mjs` exports
`SENTINEL_DOMAINS` (currently `['harden-check.invalid',
'd6-door-checkin-check.invalid']`) and a parameterized
`isKnownSentinelDomain(email, domains = SENTINEL_DOMAINS)`. Both
`ticketing-hardening/_shared.mjs` and `d6-door-checkin/_shared.mjs` derive
their `SENTINEL_EMAIL_DOMAIN`-shaped checks from this module instead of
retyping the literal; `scripts/scan-firestore-residue.ts`'s
`SENTINEL-EMAIL-DOMAIN` / `D6-SENTINEL-EMAIL-DOMAIN` regex entries are built
from the same array via a small `sentinelDomainPattern(domain)` helper, not
independently retyped. A future renamed or added sentinel domain then has
exactly one place to change; forgetting to update the scanner becomes
structurally impossible rather than merely a code-review risk.

`isKnownSentinelDomain` takes `domains` as a parameter (defaulting to the
shared constant) specifically so its behaviour can be proven generic in a
unit test without mutating the real exported array — see F3's negative
control in the contract.

## Point 4 — A34 replacement

The existing `check-suite-leaves-no-ticket-residue.mjs` is rewritten in
place (same file, same assertion ID `A34` — this is an evolution of the same
claim, not a retirement; the old count-only comparator is not adequate, but
"the suite leaves no residue" is still exactly the right thing to assert).
See `a34-replacement-spec.golden.md` for the exact required behaviour: an
identity-set comparator (not count-delta), a self-imposed kill against a
decoy fixture to prove the detector can fail, and a real full-suite run
proving it stays green under the fixed timeouts.

## Flagged: SAOC-2027-ZNYT37Z88MSH

One `tickets` document, `attendeeName: 'ITN Test'`, created 2026-08-15,
`bookingRef` shaped like a genuine `/api/tickets/checkout` output
(`SAOC-<year>-<10-char base36>`) and therefore indistinguishable from a real
booking by any pattern in `marker-catalogue.md`. It appears in NO existing
catalogue (`KNOWN_RESIDUE_BOOKING_REFS`, `KNOWN_RESIDUE_DOC_IDS`, or any
sentinel-domain pattern).

**This contract does not add it to any allowlist and does not delete it.**
Adding it to an allowlist would make the residue scanner stop reporting it —
that is the wrong move for a document whose identity is unconfirmed. It stays
visible as a scanner hit until Brad identifies it (real diagnostic ticket?
manual test? something else?) and makes the call on disposition. F5's single
assertion in this contract exists only to prevent an accidental future
allowlisting: it greps `scripts/scan-firestore-residue.ts` and confirms
`ZNYT37Z88MSH` appears nowhere in it.

## Fixtures must not shape production behaviour

Per this project's own standing rule (`.agent/memory/project/learned.md`,
2026-08-16 entry): if any fixture built for this contract's checks (the
decoy lock-holder script, the manifest test fixtures) turns out to need a
name change because its name is misleading an implementation choice, rename
the fixture — do not narrow production behaviour to make a misnamed fixture
pass.

## Grep ceilings — stated honestly

Every `grep`-based assertion in this contract's yaml proves *presence of a
token*, not correctness of behaviour. Structural assertions (module exists,
function exported, import present, ordering of two calls) are grep/AST-lite
on purpose and are paired with a behavioural assertion wherever the claim is
security- or money-relevant (F2's kill-and-recover proof, F4's
identity-based detector, F3's parameterized negative control). A grep can be
defeated by a comment or dead code containing the same substring; none of
these grep assertions are asked to carry a claim beyond "this identifier
exists in this file."

F1's `check-lock-timeout-invariant.mjs` (A2/A3) is not a grep — it's a
recursive, text-based import-graph walk — but it carries the same honesty
obligation: it does not claim to catch every conceivable way a future script
could reach `_shared.mjs`. See `lock-timeout-invariant.golden.md`'s "Honest
remaining ceiling" section for the precise, stated limits (computed/aliased
specifiers it cannot follow) and how it fails safe (conservative
UNRESOLVED-floor requirement, never a silent pass) within those limits.

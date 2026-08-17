# F4 golden spec — A34 replacement (identity-based, capable of catching path 2)

Rewrites `contracts/checks/payfast-m1/check-suite-leaves-no-ticket-residue.mjs`
in place. Same file, same assertion ID `A34` in `contract-payfast-m1.yaml`
(update its `command` to `timeout_seconds: 120`+ per F1's golden, but the
command string itself is unchanged).

## Why the old comparator is inadequate (do not keep it)

`judgeResidue(before, after)` only compares Firestore document *counts*. A
run that leaks one new doc while an unrelated cleanup elsewhere removes one
pre-existing doc nets to zero change and reports clean — the exact "same
count, different documents" blind spot. Replace it; do not keep it as a
secondary check alongside the new one (one comparator, doing the real job).

## New comparator — identity-set based

```js
export function judgeResidueBySets(beforeIds, afterIds, knownResidueIds) {
  // beforeIds, afterIds: Set<string> of tickets doc IDs.
  // knownResidueIds: Set<string> — scripts/scan-firestore-residue.ts's
  // KNOWN_RESIDUE_DOC_IDS, imported, not retyped.
  // Returns null if clean, a descriptive problem string otherwise.
}
```

Fails when `afterIds` contains any ID that is in neither `beforeIds` nor
`knownResidueIds` — i.e. a genuinely NEW, unaccounted-for document appeared.
Does not fail on a document disappearing (a doc present in `beforeIds` but
missing from `afterIds`) — that is out of this check's scope (could be a
legitimate concurrent cleanup elsewhere) and flagging it would create noise
unrelated to the leak this check exists to catch.

### Self-test (always runs, no credentials)

Prove the comparator with synthetic sets:
- Same sets before/after -> `null` (clean).
- `afterIds` has one extra ID not in `knownResidueIds` -> truthy (catches a
  real leak).
- `afterIds` has one extra ID AND is missing one from `beforeIds` (same
  total count, different membership) -> truthy — this is the specific case
  the OLD `judgeResidue` count-diff would have missed; the self-test must
  assert this case explicitly, by name, so a future regression back to
  count-only logic is caught here first.
- `afterIds` has an extra ID that IS in `knownResidueIds` -> `null` (a
  pre-existing catalogued document showing up in an `after` read is not a
  new leak).

## Live check, two parts

1. **Normal full-suite run.** Read `tickets` doc IDs before, spawn the four
   real behavioural payfast-m1 scripts (same `SUITE_SCRIPTS` list as before)
   with a generous timeout matching F1's `MIN_ASSERTION_TIMEOUT_MS` (this
   check must impose that timeout on each spawned child itself — do not rely
   on `contract.py`'s own outer timeout, which is exactly the blindness being
   fixed: this check must be ABLE to reproduce a kill, which requires it to
   own the timeout on its children, not delegate to the caller). Read
   `tickets` doc IDs after. Run `judgeResidueBySets`. A child script's own
   PASS/FAIL exit code remains irrelevant here (unchanged from the old
   behaviour) — only identity-set membership matters.
2. **Capability proof — deliberate kill against the decoy, not a real suite
   script.** Using the decoy fixture
   (`decoy-lock-holder.golden.md`), spawn it, wait for its "write completed"
   stdout line, SIGKILL it, and confirm:
   - The orphaned doc IS detected as new/unaccounted residue by
     `judgeResidueBySets` (the detector demonstrably CAN fail — this is the
     negative control the old A34 never had, and directly the thing the task
     brief calls out: "a detector that cannot observe the failure it exists
     to catch is worse than no detector").
   - Calling F2's `sweepManifestFromPriorRun()` immediately after removes the
     orphan, and a second `judgeResidueBySets` comparison against a fresh
     `after` read is clean — proving F2 and F4 compose correctly together,
     not just individually.

LOCAL-ONLY for both live parts, same credential/skip convention as A18.

## What this script must never do

Never calls `.delete(` directly against any document outside what
`sweepManifestFromPriorRun()` / the sub-scripts' own `withCleanup()` already
delegate to — this script counts and judges, cleanup stays delegated, exactly
as the current header comment already states and must continue to state.

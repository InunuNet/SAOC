# F6 A1 cleanup-failure incident — 2026-08-06

`cms-loop-and-wiring` mission, M1 post-deploy verification. Root-caused and fixed by
@architect (owner of `contracts/checks/f6-prove-cms-loop/_shared.mjs`), per team-lead
dispatch. Written 2026-08-06.

## What happened

After F1 (CDN TTL fix) and F2 (event tag fix) landed, `contracts/checks/
f6-prove-cms-loop/check-studio-edit-reaches-site.mjs` (A1) was run for real. The
mutation succeeded and the sentinel `F6-LOOP-PROOF-1785966963142-c10b95` genuinely
reached the live `/about` page — real, positive proof the CDN loop works post-F1.
Cleanup did not reliably remove it. The sentinel was later found still live on the
public page by a direct `curl`, discovered by accident — not because the check itself
reported the failure.

## Root cause

Confirmed by reading every failure path in `_shared.mjs`, not inferred: **every**
helper function (`loadEnvOrFail`, `readDatasetField`, `fetchPublicPageContains`,
`callRevalidate`, `openAuthenticatedDoc`, `setFieldAndPublish`) called
`process.exit(1)` directly on failure, instead of throwing an `Error`.

`process.exit()` terminates the Node process immediately — it does **not** unwind the
call stack the way a thrown exception does. Any `try/finally` block further up the
call stack — specifically, every mutating check script's cleanup block, whose entire
purpose is to guarantee cleanup always runs — is silently skipped if a helper call
inside that block hits any of these failure paths. This was most dangerous during the
**second** (cleanup) Studio session: a transient failure re-opening the Studio,
re-finding the field, or re-clicking Publish would kill the process before the
cleanup block's own "MANUAL CHECK REQUIRED" logging ever printed — indistinguishable,
from the outside, from an ordinary crash.

## Second, independent factor

Investigated and confirmed live, 2026-08-06: F1's actual fix is
`export const revalidate = 60` on CMS-driven pages (bounded TTL +
`stale-while-revalidate`), **not** a CDN purge call — confirmed via response headers
(`cache-control: s-maxage=60, stale-while-revalidate=31535940`, `x-nextjs-cache:
STALE`). This means a single "not found" read from one vantage point does not prove
the change has propagated to every CDN edge node. The prior cleanup-poll design (exit
on the first clean read) was calibrated against the *previous* one-year TTL, under
which propagation had never once succeeded during testing — "sentinel absent" was
trivially true on attempt 1 every time. This code path had never been genuinely
exercised until F1 shipped.

Two live re-runs of the fixed A1 on 2026-08-06 (see "Fix — verification" below) both
showed **propagation itself failing to reach the live page within the existing 120s
bound**, despite the mutation and revalidate call both succeeding — a real, separate,
still-open finding: F1's fix does not appear to reliably close the loop within 120s
on every attempt. Flagged here for whoever owns F1's ongoing reliability; not
something this incident's fix (cleanup safety) attempts to solve.

## Fix

Applied to `contracts/checks/f6-prove-cms-loop/_shared.mjs` and propagated to every
check script that calls it (F6 A1, F2 A1, F4 A1, F4 A2):

1. **Every `process.exit(1)` inside a helper function is now `throw new Error(...)`.**
   Structural fix — normal JS `try/catch/finally` semantics now apply everywhere,
   including inside a cleanup block's own nested `try/catch`. Does not depend on any
   script remembering to check a return value.
2. **`verifySustainedCondition` / `verifyLiveAbsence`** (new exports): cleanup
   verification now requires 3 consecutive clean reads, 15s apart, within a 5-minute
   safety-net bound — deliberately more conservative than, and independent of, the
   120s *propagation* bound (which proves the feature works and must not be
   lengthened per the mission's standing instruction). A single lucky "not found"
   read is no longer sufficient evidence of full CDN-wide removal.
3. **`raiseResidueAlert`** (new export): if cleanup still cannot be verified within
   that window, the check raises a loud, three-layer failure — an unmissable console
   banner naming the document/field/expected value/sentinel, a durable JSON marker
   file under `contracts/checks/RESIDUE-ALERTS/`, and a distinct exit code
   (`EXIT_CODE_RESIDUE_ALERT = 2`) that can never be confused with an ordinary FAIL
   (`1`, "the feature doesn't work yet") by anything reading the exit code alone.
4. **`installCrashGuard`** (new export, defense in depth): process-level
   `uncaughtException`/`unhandledRejection` handlers make a genuinely unexpected
   failure loud and distinctly exit-coded rather than a silent default Node crash.
   Honest limitation: these handlers cannot run new async cleanup (a real Node
   constraint) — they are a last-resort alarm, not a substitute for fix #1, which is
   the actual guarantee.

## Fix — verification

- Residue independently confirmed gone (2026-08-06, before any fix code ran): dataset
  `aboutPage.boardIntroText` was already `null`; a fresh `/api/revalidate` call plus 6
  manual `curl` reads over 30s all showed the sentinel absent.
- All four affected scripts pass `node --check` (syntax) after the rewrite.
- Non-mutating regression checks re-run clean after the rewrite: F6 A2, F2's
  negative control, F4's A1/A2 precondition-fail paths (unaffected, since they exit
  before any mutation is attempted).
- **F6 A1 run for real, twice**, end to end, post-fix: both runs completed the full
  mutate → dataset-confirm → revalidate → propagation-poll → cleanup →
  sustained-verification cycle without crashing. Both left the dataset clean
  (`null`) and both cleanup-verify phases completed in ~31s (2 consecutive clean
  reads plus a start read, well inside the 5-minute bound). Propagation itself did
  not succeed in either of these two runs (see "Second, independent factor" above) —
  cleanup correctly ran to completion and verified cleanly regardless.

## Audit of every mutating check

- **F6 A1** (`check-studio-edit-reaches-site.mjs`): fixed, verified live (above).
- **F2 A1** (`cms-loop-f2-event-tags/check-studio-edit-reaches-site.mjs`): fixed
  (reuses the same shared helpers; syntax-checked, not re-run live to avoid an
  unnecessary extra mutation — the structural fix is identical and the harness was
  already proven correct on this exact target during F2's original contract
  authoring).
- **F4 A1 / A2** (`cms-loop-f4-orphaned-types/check-award-threshold-reaches-site.mjs`,
  `check-award-order-reaches-site.mjs`): fixed. Both currently fail at their
  precondition step (the `threshold`/`order` fields don't exist on the schema yet),
  so no mutation has occurred with either the old or new code — re-verified this
  precondition-fail path still behaves identically post-fix.
- **F4 A3–A8**: read-only (negative control, self-test, static+live content checks,
  Studio-sidebar read, schema/dataset-count read, `/societies` regression) — no
  mutation, nothing to clean up, not in scope for this fix.
- **F3** (`cms-loop-f3-national-show/`): **NOT edited** — its architect is mid-revision
  on that contract; reporting only, per instruction. Audit found the identical root
  cause, independently: F3's own local `_shared.mjs` defines `setFieldsAndPublish`
  (`contracts/checks/cms-loop-f3-national-show/_shared.mjs:87,100`) and
  `assertF1Deployed` (`_shared.mjs:71`), both of which call `process.exit(1)` directly
  on failure — the same bypass risk during a cleanup block's second Studio session.
  F3 does reuse `openAuthenticatedDoc`/`readDatasetField`/`fetchPublicPageContains`/
  `callRevalidate`/`getSanityClient`/`loadEnvOrFail` from `f6-prove-cms-loop/
  _shared.mjs`, so those specific calls already inherit this fix — but F3's own local
  helpers do not. F3's two mutating round trips
  (`check-headline-round-trip.mjs`, `check-exhibitor-stages-round-trip.mjs`) also use
  the old single-shot "exit cleanup poll on the first clean read" pattern this
  incident showed is insufficient once F1's short-TTL/SWR caching is live.
  Recommendation for F3's architect: convert the two `process.exit(1)` calls in its
  own `_shared.mjs` to `throw new Error(...)`, and replace both round trips'
  inline cleanup polls with `verifySustainedCondition` (or `verifyLiveAbsence` for the
  simple substring case) plus `raiseResidueAlert` from `f6-prove-cms-loop/_shared.mjs`
  — both are exported generically and designed for exactly this reuse.

# Golden: fix-live-sentinel-residue-cms-loop-f3 M1

## Root-cause finding (architect investigation, 2026-08-22)

**Writer, confirmed at high confidence (exact literal match, only possible source):**
`contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` (contract A1).
`SENTINEL_DATETIME_INPUT = '2099-01-01 00:00'` entered into the Studio's local-time
(SAST, +2) countdownDate widget serializes to exactly `2098-12-31T22:00:00.000Z` — the
value the orchestrator found live. Its sentinel naming (`F3-TITLE-SENTINEL-<nonce>`,
`F3-LOCATION-SENTINEL-<nonce>`) also matches exactly what was found live in `title`/
`location` a second time during this investigation. No other code path in the repo
writes this literal to Sanity or Firestore — every other `2098`/`2099` reference is
either an in-memory unit-test fixture that never touches a live datastore, or later
documentation of this exact incident (`scripts/scan-dataset-residue.ts`,
`contracts/golden/dataset-residue-guard/`).

**Timing, established from GitHub Actions history (`gh run list`), not assumption:**
`dataset-residue-guard`'s daily 03:00 UTC cron scan was clean (job `conclusion: success`)
on 2026-08-17 through 2026-08-21. It failed on the 2026-08-22 00:11 SAST pushes. A second,
independent occurrence was caught live during this investigation itself: a
`node --import tsx/esm scripts/scan-dataset-residue.ts` run against production found
`title`/`location` freshly holding `F3-TITLE-SENTINEL-1787355547212` /
`F3-LOCATION-SENTINEL-1787355547212` — nonce decodes to `2026-08-21T23:39:07Z`, i.e.
minutes before the check ran. **A1 was re-triggered during the current session**, not
only during the 2026-08-12 overnight run the mission brief's backlog citation pointed
to — that citation's date attribution was imprecise; the mechanism it names (A1) is
correct, the date is not the whole story.

**Structural root cause, confirmed by reading code and git history, not inferred:**
On 2026-08-12 (commit `c5240ed`), a real hardening pass ("harden dataset-mutation
safety... the checks were corrupting the data they verified") added an exclusive lock +
`PoisonedBaselineError` + revision-guarded restore to the mutating checks under
`contracts/checks/show-visitor-info/` and `contracts/checks/show-exhibitor-info/`
(`_mutation-guard.mjs` in each). That commit's own message claims cms-loop-f3-national-
show's A1 remained safe ("the CMS round-trip loop is still proven by that contract's
A1") — but `git show c5240ed --name-only` proves it never touched
`contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` or its
`_shared.mjs`. A1 still runs today on only the older (2026-08-06) safety net —
`readAllFieldsUntil` / `verifySustainedCondition` / `raiseResidueAlert` — a solo
try/finally with **no cross-process mutual exclusion**. Worse: `contracts/checks/
show-visitor-info/check-show-identity-sweep.mjs` mutates the SAME `nationalShow`
singleton (`DOC_ID = 'nationalShow'`) under a *different* lock file
(`show-visitor-info-dataset.lock`) than anything A1 uses (A1 has no lock file at all).
The show-visitor-info module's own header already flags this as a known, deliberately
un-widened gap: "this lock serialises THIS contract's checks against each other... does
NOT serialise against other contracts... raised with the team lead rather than done
unilaterally." This mission is that sign-off.

No crash log or `RESIDUE-ALERTS/` marker survives from either occurrence (the directory
doesn't exist), which is itself informative: A1's own loud-alert path (`raiseResidueAlert`)
apparently never fired in either incident — either the process was killed before reaching
it (plausible in a multi-agent session where dev/QA processes get interrupted), or the
race concluded with `datasetClean`/`cleanupPropagation` both reporting false-clean while
the actual write landed after the check's own verification window closed. Confidence:
**high that A1, unlocked and unguarded against `check-show-identity-sweep.mjs`, is the
mechanism; not provable which exact interleaving produced either specific incident**,
since no log survived. State this honestly — do not claim more certainty than the
evidence supports.

## Immediate remediation performed during investigation

Live production `nationalShow` was patched directly (targeted `client.patch('nationalShow')
.set({title, location})`, not `scripts/seed-page-singletons.ts`'s `createOrReplace`, which
would have wiped `edition`/`hostRegion`/`salesOpen`/`showDate`/`showEndDate`/`venue`):

```
title:    "The South African National Orchid Show"
location: "The Hangar, Stellenbosch Flying Club"
```

Sourced from `scripts/seed-page-singletons.ts:212,214` and cross-checked against the
sibling `show-19-2027` document, which already carried the correct values. Verified via
`node --import tsx/esm scripts/scan-dataset-residue.ts`: `ALL CLEAR — scanned 148
document(s), no residue found.` `show-19-2027` and `societyEvent-15-19th-south-african-
national-orchid-show` were swept in the same pass — no residue found in either.

## Fix design

**F1 — close the actual concurrency gap.** Add `contracts/checks/_shared/doc-lock-
path.mjs` exporting `docLockPath(docId)` → `path.join(os.tmpdir(), 'saoc-contract-locks',
`${docId}-dataset.lock`)`. Point BOTH `check-headline-round-trip.mjs`'s new lock usage
AND `show-visitor-info/_mutation-guard.mjs`'s existing `LOCK_PATH` at
`docLockPath('nationalShow')`, so the two contracts that mutate the same singleton
actually serialize against each other for the first time. Retrofit A1 with the same
three defenses `show-visitor-info` already proved: (1) `assertUsableBaseline`-style
poisoned-baseline rejection on title/location/countdownDate before any mutation is
attempted; (2) the whole check body wrapped in `withDatasetLock`; (3) the CLEANUP write
switched from re-opening Studio (fragile, and the actual step that has now failed twice)
to a direct `client.patch('nationalShow', { ifRevisionID: capturedRev }).set(baseline)
.commit()` — this also simplifies the check by removing a second browser session from
the cleanup path entirely. The initial mutation may stay Studio-UI-driven (that's the
point of A1 — proving the editor workflow, not just the API), only the restore needs to
move to the client.

**F2 — close the "log nobody reads" gap.** `dataset-residue-guard` already exists, runs
daily, and DID catch this — twice — but only as a GitHub Actions job nobody was watching.
Wire `scripts/scan-dataset-residue.ts` into `execution/contract.py`'s `gate_cmd` itself,
as a pre-flight (before any assertion runs — a poisoned dataset makes every mutating
check's baseline-capture untrustworthy) and post-flight (catches residue the run itself
just introduced) check, hard-failing the gate command with a distinct, loud exit code and
banner. This generalizes protection to any future check that mutates live content, not
only A1, and puts the finding in the one place every mission's dev/QA/architect already
looks — the gate command's own output — instead of a CI tab.

## Non-goals

- Not rewriting A1 as a non-mutating check against a draft/preview document — team-lead's
  own header on `cms-loop-f3-national-show.yaml` already establishes A1 exists
  specifically to prove the real Studio editor workflow, which a preview document cannot
  substitute for. Locking + guarding it is the correct fix, not replacing its design.
- Not migrating `show-exhibitor-info`'s checks onto the shared lock — confirmed via grep
  that they target `showExhibitorInfo`/`INFO_DOC_ID`, a different document; they do not
  collide with `nationalShow` writers and are out of scope.

---
schema: athanor.mission/v1
slug: fix-live-sentinel-residue-cms-loop-f3
goal: 'Fix the root cause of live production Sanity data corruption from contracts/cms-loop-f3-national-show.yaml''s
  mutating checks (A1/A3). This contract intentionally writes sentinel test values
  (including a far-future 2098/2099 countdownDate) into the live nationalShow document
  to prove round-trip wiring, then cleans up/reverts afterward — the contract''s own
  extensive header documents a 2026-08-05/06 authoring-time race-condition fix (readAllFieldsUntil
  bounded retry) that was believed to make cleanup reliable. CONFIRMED REAL INCIDENT
  2026-08-21/22: during an unrelated mission this session, nationalShow.countdownDate
  was found live in production still holding the sentinel value 2098-12-31T22:00:00.000Z
  — meaning either this contract''s mutating checks were re-run since 2026-08-06 and
  cleanup silently failed this time (the documented retry logic did not save it),
  or a different, less-careful process wrote the sentinel and never cleaned up at
  all. This is the SECOND confirmed live occurrence of this project''s known ''contract
  checks mutate live content'' defect class (see project memory project_contract_checks_mutate_live_content
  and docs/secret-corruption-incidents.md-adjacent precedent) — residue sat undetected
  in production for an unknown period, again. F1: investigate and definitively determine
  what caused this specific incident (grep for any recent execution of A1/A3, check
  whether the readAllFieldsUntil retry logic has a real gap, check whether any OTHER
  contract or script also writes to nationalShow.countdownDate that isn''t as careful).
  F2: harden the actual root cause found — options include making the mutating checks
  fail loudly and immediately alert/log to somewhere a human or agent will actually
  see (not a log nobody reads, per project memory project_contract_checks_mutate_live_content''s
  own warning that ''residue alerts go to a log nobody reads''), adding a pre-flight
  and post-flight sentinel-residue guard that ANY contract gate run checks automatically
  before/after (so residue can never silently persist across sessions), or making
  A1/A3 non-mutating (test against a preview/draft document instead of the live singleton)
  if that''s architecturally feasible without weakening what they prove. F3: sweep
  the live production nationalShow document AND any other frequently-mutated live
  documents (show-19-2027, societyEvent-15-...) for any other stray sentinel/test
  residue right now, not just the one field already found and fixed this session,
  and clean up anything found.'
created_at: '2026-08-22T00:12:37.639610+00:00'
started_at: '2026-08-22T00:12:37.639610+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F3
  ts: '2026-08-22T01:46:37.000000+00:00'
features:
- id: F1
  status: done
  tier: apex
  title: Shared doc-scoped lock + poisoned-baseline rejection + revision-guarded restore
    for A1
  inline_brief: 'Root cause (see .agent/memory/project/specs/fix-live-sentinel-residue-cms-loop-f3/goldens/m1-golden.md
    for full evidence): contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs
    (A1) writes real sentinel values into the live nationalShow singleton via the
    Studio UI and has no cross-process lock, no poisoned-baseline rejection, and no
    revision-guarded restore, unlike its sibling mutating checks under contracts/checks/show-visitor-info/
    and contracts/checks/show-exhibitor-info/, which were hardened with exactly those
    three defenses on 2026-08-12 (commit c5240ed) - a hardening pass that never actually
    touched A1 despite that commit''s own message claiming it did. Worse, show-visitor-info''s
    check-show-identity-sweep.mjs mutates the SAME nationalShow document under a DIFFERENT,
    non-shared lock file, so the two checks have never actually serialized against
    each other. Add contracts/checks/_shared/doc-lock-path.mjs exporting docLockPath(docId);
    point BOTH A1''s new lock usage AND show-visitor-info/_mutation-guard.mjs''s LOCK_PATH
    at docLockPath(''nationalShow''), so the two contracts that mutate the same singleton
    actually serialize for the first time. Retrofit A1 with the same three defenses
    show-visitor-info already proved: poisoned-baseline rejection on title/location/countdownDate
    before any mutation; the whole check body wrapped in withDatasetLock; the cleanup/restore
    step switched from re-opening Studio (the fragile step that has now failed twice)
    to a direct client.patch(''nationalShow'', { ifRevisionID }).set(baseline).commit().
    The initial mutation stays Studio-UI-driven (that is the point of A1 - proving
    the editor workflow, not just the API); only the restore moves to the client.
    Do not migrate show-exhibitor-info onto this lock - confirmed via grep it targets
    a different document (showExhibitorInfo/INFO_DOC_ID) and does not collide with
    nationalShow writers. Tier: apex - this touches live production data-integrity
    machinery shared across two contracts; get the lock semantics and revision-guard
    right the first time, this defect class has already recurred twice.'
- id: F2
  status: done
  tier: standard
  title: Wire dataset-residue-guard into contract.py gate_cmd as pre/post-flight,
    loud and blocking
  inline_brief: scripts/scan-dataset-residue.ts + the dataset-residue-guard CI job
    already exist and already caught this incident twice (GitHub Actions history via
    `gh run list` proves the daily 03:00 UTC cron was clean through 2026-08-21 and
    only failed once residue actually appeared) - but a nightly cron job nobody is
    watching is the same "log nobody reads" gap project memory project_contract_checks_mutate_live_content
    already warns about, just moved one layer down. Wire the scanner into execution/contract.py's
    gate_cmd itself (see gate_cmd at execution/contract.py:645) as a pre-flight (before
    any assertion phase runs - a poisoned dataset makes every mutating check's captured
    baseline untrustworthy) and post-flight (catches residue the run itself just introduced)
    check, hard-failing the gate command with a distinct, loud exit code and banner
    if residue is found either time. This generalizes protection to any future check
    that mutates live content, not only A1, and puts the finding in the one place
    every mission's dev/QA/architect already looks - the gate command's own output
    - instead of a CI tab. Add a test-only override (env var or similar) so this can
    be proven with a real, negative-verified behavioral test against the existing
    contracts/golden/dataset-residue-guard/fixture-all-patterns.json fixture without
    hitting live Sanity credentials in the test itself.
- id: F3
  status: done
  tier: standard
  title: Live production sweep and restore (performed during investigation; verified
    by contract)
  inline_brief: 'Already performed by @architect during investigation, documented
    here so the contract has something to verify and the chain does not silently skip
    it. Live nationalShow.title/location were found freshly re-corrupted with F3-*-SENTINEL
    values DURING this investigation (nonce decodes to 2026-08-21T23:39:07Z - a live,
    ongoing recurrence, not a decade-stale leftover) and were restored via a targeted
    client.patch(''nationalShow'').set({title, location}) using the correct values
    from scripts/seed-page-singletons.ts:212,214 (cross-checked against the sibling
    show-19-2027 document) - deliberately NOT via scripts/seed-page-singletons.ts
    itself, which uses createOrReplace and would have wiped edition/hostRegion/salesOpen/
    showDate/showEndDate/venue. A full sweep of nationalShow, show-19-2027, and societyEvent-15-19th-south-african-national-orchid-show
    via scripts/scan-dataset-residue.ts confirmed clean: "ALL CLEAR - scanned 148
    document(s), no residue found." @dev''s job for this feature is limited to keeping
    that state true (no further action needed unless the F1/F2 gate work surfaces
    new residue) - do not re-run scripts/seed-page-singletons.ts against production.'
milestones:
- id: M1
  title: Close the A1 concurrency gap and the CI-only-visibility gap
  features:
  - F1
  - F2
  - F3
  status: done
  gate_result: pass
---



# Mission: Fix the root cause of live production Sanity data corruption from contracts/cms-loop-f3-national-show.yaml's mutating checks (A1/A3). This contract intentionally writes sentinel test values (including a far-future 2098/2099 countdownDate) into the live nationalShow document to prove round-trip wiring, then cleans up/reverts afterward — the contract's own extensive header documents a 2026-08-05/06 authoring-time race-condition fix (readAllFieldsUntil bounded retry) that was believed to make cleanup reliable. CONFIRMED REAL INCIDENT 2026-08-21/22: during an unrelated mission this session, nationalShow.countdownDate was found live in production still holding the sentinel value 2098-12-31T22:00:00.000Z — meaning either this contract's mutating checks were re-run since 2026-08-06 and cleanup silently failed this time (the documented retry logic did not save it), or a different, less-careful process wrote the sentinel and never cleaned up at all. This is the SECOND confirmed live occurrence of this project's known 'contract checks mutate live content' defect class (see project memory project_contract_checks_mutate_live_content and docs/secret-corruption-incidents.md-adjacent precedent) — residue sat undetected in production for an unknown period, again. F1: investigate and definitively determine what caused this specific incident (grep for any recent execution of A1/A3, check whether the readAllFieldsUntil retry logic has a real gap, check whether any OTHER contract or script also writes to nationalShow.countdownDate that isn't as careful). F2: harden the actual root cause found — options include making the mutating checks fail loudly and immediately alert/log to somewhere a human or agent will actually see (not a log nobody reads, per project memory project_contract_checks_mutate_live_content's own warning that 'residue alerts go to a log nobody reads'), adding a pre-flight and post-flight sentinel-residue guard that ANY contract gate run checks automatically before/after (so residue can never silently persist across sessions), or making A1/A3 non-mutating (test against a preview/draft document instead of the live singleton) if that's architecturally feasible without weakening what they prove. F3: sweep the live production nationalShow document AND any other frequently-mutated live documents (show-19-2027, societyEvent-15-...) for any other stray sentinel/test residue right now, not just the one field already found and fixed this session, and clean up anything found.

## Context

Architect investigation complete (2026-08-22). Full findings, evidence, and fix design:
`.agent/memory/project/specs/fix-live-sentinel-residue-cms-loop-f3/goldens/m1-golden.md`.
Contract: `.agent/memory/project/specs/fix-live-sentinel-residue-cms-loop-f3/contract-m1.yaml`.

Summary: root cause is confirmed at high confidence to be A1
(`contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs`) — exact
literal match on the sentinel value/naming, and it is the only mutating check under
`contracts/checks/cms-loop-f3-national-show/` still active (A3 was retired 2026-08-12).
It was never retrofitted with the lock/PoisonedBaselineError/revision-guard hardening its
siblings (`show-visitor-info`, `show-exhibitor-info`) received the same day (commit
`c5240ed`), despite that commit's message claiming it was covered. GitHub Actions history
(`gh run list`) proves the corruption is NOT a decade-stale leftover from 2026-08-12 —
`dataset-residue-guard`'s daily cron was clean through 2026-08-21, and a second fresh
occurrence (title/location, not just countdownDate) was caught live during this very
investigation (nonce decodes to 2026-08-21T23:39:07Z). That second occurrence was
restored immediately during investigation (targeted patch, not the destructive
`createOrReplace` seed script) — live production is confirmed clean via
`scripts/scan-dataset-residue.ts` as of this write-up. Full mechanism detail (the shared-
lock gap between A1 and `show-visitor-info/check-show-identity-sweep.mjs`, both of which
mutate the same `nationalShow` singleton under different, non-shared lock files) is in
the golden file above — do not re-derive it, read it first.

## Notes

## Close-out (2026-08-22)

Mission DONE — all 3 features shipped, M1 gate 15/15 green (A1-A15), pre-flight and post-flight
dataset residue scans both "ALL CLEAR — 148 documents". F1 shipped the actual root-cause fix
(shared `docLockPath(docId)` so A1 and `show-visitor-info`'s mutation guard finally serialize
against the same live document, plus poisoned-baseline rejection and revision-guarded
`client.patch` restore on A1). F2 wired the dataset-residue scanner into `contract.py`'s
`gate_cmd` itself as a blocking pre/post-flight check. F3's live sweep-and-restore was already
verified clean. QA (qa-apex) confirmed F1/F3; F2's availability bug was caught by QA and fixed.
10 rounds of Codex GPT-5.5 review ran across the mission, each real finding fixed with
revert-and-confirm-red proof; the 10th and final round came back clean. Full reusable lesson
(document-scoped vs. contract-scoped locking; the three draft-cleanup data-loss bug variants
found in rounds 6-9) recorded in `learned.md` under "Mutating contract checks need a
document-scoped lock, not a contract-scoped one".


---
schema: athanor.mission/v1
slug: verification-triad-gate
goal: verification-triad-gate
created_at: '2026-09-03T13:16:25.848190+00:00'
started_at: '2026-09-04T20:51:10.586569+00:00'
last_active_at: '2026-09-04T20:51:10.586569+00:00'
status: done
cost_estimate:
  features: 2
  milestones: 2
  total_calls: 0
last_checkpoint:
  milestone: M2
  feature: F2
  ts: '2026-09-06T00:00:00+00:00'
features:
- id: F1
  name: browser_deployed_check + gws_inbox_check assertion kinds + triad coverage linter
  spec: .agent/memory/project/specs/verification-triad-gate/contract-f1.yaml
  status: done
- id: F2
  name: Wire verify_triad_coverage.py into the real gate path (quick_gate.sh + contract.py gate_cmd)
  spec: .agent/memory/project/specs/verification-triad-gate/contract-f2.yaml
  status: done
milestones:
- id: M1
  name: Triad assertion kinds wired into the contract gate
  features:
  - F1
  status: done
- id: M2
  name: Triad coverage linter enforced in every gate run
  features:
  - F2
  status: done
---

# Mission: verification-triad-gate

## Context

Closes the gap that let the `SITE_URL`/hosted.app defect reach a 10/10 green gate with zero
deploys and zero real browser/inbox verification. Adds `browser_deployed_check` and
`gws_inbox_check` as first-class contract assertion kinds (sibling to the already-working
`codex_qa` kind) plus a triad-coverage linter, so a UI/workflow contract cannot go green
without all three verification-triad layers actually having run.

Spec + contract: `.agent/memory/project/specs/verification-triad-gate/contract-f1.yaml`
Goldens: `.agent/memory/project/specs/verification-triad-gate/goldens/`

## Notes


## Status 2026-09-04 — F1 retry 1 in flight

First @dev pass reached a 9/9 green gate. Graded **FAIL** by Codex GPT-5.5 and by @qa
independently (both by execution, not inference): the discriminators are sound and not vacuous,
but two shipped defaults meant a real gate run verified the SHAPE of a claim, not its truth —
the same defect class this mission exists to close, one layer in.

Full findings: `.agent/memory/scratch/2026-09-04-codex-f1-verification-triad-gate.md`

Retry 1 lanes (running):
- @dev  — freshness default 604800->14400 (test harness injects the override instead);
  GWS_CHECK_LIVE_RECHECK default 0->1; curl-missing must exit 2 not PASS
  (browser_deployed_check.sh:156); linter/gate key mismatch (verify_triad_coverage.py:108
  accepts `kind:`, contract.py:159 only normalises `type:`).
- @arch — goldens/fixtures/browser_manifest_good.json:5 pins pre-change HEAD, so A5 self-breaks
  on the first commit. Derive the sha at test time without weakening commit-binding.

Out of scope, both reviewed and correctly closed: screenshot-path permissiveness (disclosed in
README Known Limitations); `gate_codex_qa_failure` naming (one read site, clean); TimeoutExpired-
only catch (pre-existing codex_qa pattern, @docs note only).

## M2 — DEFERRED, and it is the mission's headline requirement

Codex round 3 (commit 6615513a) finding, orchestrator's decision to defer at high context:

**`execution/skills/quick_gate.sh:57` and `contract.py`'s `gate_cmd` (contract.py:926-929) never
invoke `execution/verify_triad_coverage.py`.** The two new assertion kinds are enforced when a
contract DECLARES them, but nothing forces any contract to declare them. A future UI contract can
still reach a green gate with no browser and no inbox verification, exactly as before — unless it
volunteers the linter as its own assertion.

F1 built the mechanism. F1 did NOT deliver the mandate in the mission goal. Do not close this
mission as done on F1 alone.

Why deferred rather than fixed: wiring the linter into every gate run applies retroactively to
every contract in the repo, most of which declare no triad kinds. That could turn the whole suite
red and needs @architect scoping plus room to verify. Not a change to bolt on at 165k context.

**Also for M2 — dormant gap @dev found itself and correctly did not fix:**
`verify_triad_coverage.py`'s `iter_assertions_with_shape()` reads `contract.get("phases_raw")`,
but an author-written contract's real YAML key is `phases`. `phases_raw` only exists
post-normalisation inside contract.py, which this standalone linter never sees. So a contract in
the `phases:` dict shape is invisible to the linter entirely. False-negative direction (fails to
"no opinion", not to false certification), so lower severity than the above, but it means the
linter's coverage is narrower than it appears.

## Remaining chain steps for F1 — ALL DONE 2026-09-04

- @docs: README + docs/verification-triad-gate.md. **DONE** (commit `80829bec`).
- Gate: 9/9 green (final run, post-docs).
- @maintainer close-out: learned.md lessons written, brain wrap-up run. **F1/M1 marked `done`
  above. Mission `status` stays `in_progress` — M2 (wiring the linter into the actual gate path,
  `execution/skills/quick_gate.sh:57` / `contract.py`'s `gate_cmd`) is NOT started and is this
  mission's headline requirement. Do not close this mission as `done` until M2 ships.** See the
  "M2 — DEFERRED" section above for full scope and the two Codex-cited defects it must close.

Commits for F1: `6615513a`, `f8c8dd7a`, `80829bec`.

## Status 2026-09-06 — M2/F2 DONE, mission CLOSED

Real gate run: `python3 execution/contract.py gate
.agent/memory/project/specs/verification-triad-gate/contract-f2.yaml --phase 4 --run-checks`
→ 12 pass, 0 skip, 0 fail, 0 error, exit 0, post-flight residue guard `ALL CLEAR — scanned 149
document(s)`. @qa verdict PASS. Codex GPT-5.5 PASS on its fourth pass (see learned.md
2026-09-06 entry — the first three each found a real defect: false-positive block on compliant
phases-dict contracts, a mixed-shape masquerade the phases-dict fix itself introduced, and
`IsADirectoryError` on `TRIAD_BASELINE_FILE` escaping the promised fail-closed exit 7).
Committed as `aa2f74f3`.

Delivered: `contract.py`'s `gate_cmd()` now runs the triad-coverage linter as a preflight after
the dataset-residue guard and before `_gate_dispatch()` — the one choke point common to all
four gate entry points. Blocks non-compliant UI/workflow contracts at exit 6; fails closed
(exit 7) on any linter-infrastructure error. 32 pre-existing contracts grandfathered via
`execution/triad-baseline-exempt.txt` + `.sha256` content pins (editing a baselined contract
forfeits its exemption). The mission's headline requirement — deferred at M1 close specifically
because F1 built the mechanism but nothing forced any contract to use it — is now delivered.
Mission and both milestones marked `done` above.

**Known residual gaps, carried to backlog, not fixed by F2:**
- Classifier keys on the literal substring `app/` — a contract verifying the deployed site by
  URL rather than file path still classifies EXEMPT and skips the triad entirely. Reproduced
  independently by @maintainer and @qa. Highest-value gap remaining: it's exactly the contracts
  most needing browser/inbox verification that slip through.
- `contracts/cms-loop-f1-cdn-purge.yaml` A1 re-invokes `check-studio-edit-reaches-site.mjs`,
  which writes a sentinel into the real Sanity dataset's `aboutPage.boardIntroText` with
  fallible cleanup — poisoned the live dataset during this mission, manually restored.
- `template/execution/contract.py` does not carry this preflight (tracked upstream-PR item,
  already in backlog since F1).
- `CLAUDE.md`'s triad-gate entry is now factually stale ("not yet wired... still voluntary") —
  agent-uneditable path; replacement text queued in `needs-human.md` for Brad.

Three harness issues filed upstream this session: Athanor#1391 (docs→gate handoff blocks every
repo-wide gate run on an unrelated doc's mtime), Athanor#1397 (sandbox.md instructs cleanup
that every command shape prompts on or denies), Athanor#1399 (protected-path deny leaves stale
doc text in CLAUDE.md permanently uncorrectable by any agent).

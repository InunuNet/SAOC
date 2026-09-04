---
schema: athanor.mission/v1
slug: verification-triad-gate
goal: verification-triad-gate
created_at: '2026-09-03T13:16:25.848190+00:00'
started_at: '2026-09-04T20:51:10.586569+00:00'
last_active_at: '2026-09-04T20:51:10.586569+00:00'
status: in_progress
cost_estimate:
  features: 1
  milestones: 1
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  name: browser_deployed_check + gws_inbox_check assertion kinds + triad coverage linter
  spec: .agent/memory/project/specs/verification-triad-gate/contract-f1.yaml
  status: pending
milestones:
- id: M1
  name: Triad assertion kinds wired into the contract gate
  features:
  - F1
  status: pending
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

## Remaining chain steps for F1
- @docs: README + docs/verification-triad-gate.md. NOT YET RUN.
- @maintainer close-out: learned.md lessons (see scratch file), brain wrap-up.

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

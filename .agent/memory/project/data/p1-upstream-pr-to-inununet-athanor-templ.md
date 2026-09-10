# p1-upstream-pr-to-inununet-athanor-templ

**[P1] Upstream PR to InunuNet/Athanor: `template/execution/contract.py` does not carry
  the F2 triad-coverage gate preflight** (mission `verification-triad-gate`, M2/F2 decision 5,
  2026-09-06). `template/execution/contract.py`, `quick_gate.sh`, and `improvement_loop.sh` are
  this project's seed copy of the upstream Athanor harness, not a second production gate path
  for SAOC's own contracts, so F2 intentionally did NOT duplicate the fix there. Per project
  convention `feedback_harness_issues_pr_upstream` (fix locally + PR upstream, not just report),
  this needs a PR to InunuNet/Athanor porting the same triad preflight (`_run_triad_coverage_
  preflight()`, `TRIAD_ENFORCEMENT_EXIT_CODE`/`TRIAD_PREFLIGHT_ERROR_EXIT_CODE`, the baseline +
  hash-pin re-arm-on-edit mechanism) into the template harness so future Athanor-seeded projects
  get triad enforcement out of the box, not just SAOC.

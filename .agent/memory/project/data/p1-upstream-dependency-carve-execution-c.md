# p1-upstream-dependency-carve-execution-c

**[P1] Upstream dependency: carve `execution/checks/` (or an equivalent project-owned check
  directory) out of HARNESS ownership in `update-manifest.yaml`.** Surfaced 2026-09-08 by
  nos-design-system M7, whose contract commissions a project-specific verifier at
  `execution/checks/verify_nos_m7_hero_and_grammar.ts`. `execution/` is marked `HARNESS`, so the
  next `make update-template` replaces the tree wholesale, silently, with no merge and no conflict
  marker — taking any project-authored check with it and leaving the contract's assertions
  greenless with no trace of why. This is **not** specific to M7: ~20 existing siblings already
  live in `execution/checks/` under the same exposure, so it is a pre-existing project-wide gap
  this feature merely surfaced. Per `.claude/rules/athanor.md` a harness defect is filed, never
  patched or worked around — M7 therefore keeps its verifier at the conventional path rather than
  inventing a private one. Ask: a `PROJECT`-marked (or manifest-excluded) subdirectory for
  project-authored contract checks, so the harness can still ship its own scripts alongside.

# p1-nothing-in-this-repo-runs-the-contrac

**[P1] Nothing in this repo runs the contract checks — no CI job, no `test` script.**
  Verified 2026-09-08: `.github/workflows/ci.yml` runs only lint, type-check, build and two
  residue guards (one SKIPPED for missing secrets). `package.json` has no `test` script. Grep for
  `contracts/checks` across CI, Makefile and `execution/` returns zero. Every assertion runs once
  — when its author invokes it — and never again.
  This is the mechanism behind the contract-decay items already logged above (the four failing
  contracts found during the vendor F2 QA sweep, and the standing "audit remaining contracts for
  the weak-assertion defect class" item). Those were symptoms; this is the cause. Consequence:
  every "N/N assertions green" claim in this repo is a point-in-time measurement, not a standing
  guarantee. Mission `ticketing-complete` F7 is folding in a runner + CI job.
  Related, and Brad's call because it is a GitHub setting not a code change: **main has no branch
  protection**, so even a wired-up red CI job blocks nothing (stated in ci.yml's own comments).

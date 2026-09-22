# p2-execution-verify-triad-coverage-py-cl

**P2 — `execution/verify_triad_coverage.py` classifies a contract as UI/workflow when
  `app/` paths appear only inside *prohibition* greps, with no route or component under test.**
  On 2026-09-09 this blocked `mission.py gate --milestone M1` at exit 6 for
  `national-show-ia-alignment`. The two assertions that tripped it are both negative:
  A16 — *"No file under app/ contains the GROQ type literal for showPage"* — and
  A37 — *"the gated vendor subsystem is untouched"* (`git diff --name-only HEAD -- app/api/vendors`).
  Neither renders anything. M1 ships `components/nos/ShowPageProse.tsx` and
  `lib/data/show-pages.ts`, but **no route renders either until M4**, so there is no deployed
  surface for a `browser_deployed_check` to point at — the same reason the route checks R1/R3/R4
  correctly report SKIP.
  Proposed fix: classify on *positive* evidence — an assertion that exercises a route or renders a
  component — rather than on any occurrence of an `app/` path; at minimum, exclude assertions whose
  command is a negative grep or a `git diff --name-only` emptiness check.
  Worked around locally, correctly and narrowly: `TRIAD_BASELINE_FILE` /
  `TRIAD_BASELINE_HASH_FILE` point at **project-owned** `scripts/checks/triad-baseline-exempt.txt`
  and `.sha256` (never `execution/`, which the next `make update-template` deletes), scoped to M1's
  contract alone and content-pinned by sha256 so any edit re-arms enforcement. **M4 must carry the
  full triad and must never be added to that baseline** — it builds sixteen real pages on a
  deployed origin, which is exactly what the triad exists for.
  Filed upstream: **InunuNet/Athanor#1432**. Do NOT weaken the linter and do NOT fabricate triad assertions.

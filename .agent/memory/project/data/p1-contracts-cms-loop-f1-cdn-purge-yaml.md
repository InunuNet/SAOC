# p1-contracts-cms-loop-f1-cdn-purge-yaml

**[P1] `contracts/cms-loop-f1-cdn-purge.yaml` A1 mutates the real Sanity dataset**
  (found during `verification-triad-gate` M2/F2, 2026-09-06). It re-invokes F6's
  `check-studio-edit-reaches-site.mjs` verbatim, which writes a sentinel value into
  `aboutPage.boardIntroText` on the live dataset with fallible cleanup. It poisoned the live
  dataset during this mission's gate runs and needed a manual restore (`unset`, verified ALL
  CLEAR by the residue guard). Any future gate run of this contract carries the same risk.
  Needs the sentinel-write step reworked to a draft/throwaway document or otherwise made
  non-destructive to real content. See also `project_contract_checks_mutate_live_content` in
  the auto-memory index — this is a second occurrence of that defect class.

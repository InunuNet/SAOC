# p0-triad-coverage-classifier-is-dodgeabl

**[P0] Triad-coverage classifier is dodgeable by URL-shaped assertions** (mission
  `verification-triad-gate`, M2/F2 close-out, 2026-09-06). `is_ui_workflow_contract()` in
  `execution/verify_triad_coverage.py` classifies a contract as UI/workflow by keying on the
  literal substring `app/` in its assertion commands. A contract that verifies the deployed
  site by URL instead of file path — e.g. `curl -sf https://saoc.co.za/national-show | grep -q
  "National Show"` — contains no `app/` substring, so it classifies EXEMPT, exits 0, and skips
  the triad entirely. Reproduced independently by @maintainer and @qa. This is the mission's
  own premise only partially delivered: the contracts most needing browser/inbox verification
  (they check the live site, not local files) are exactly the ones that slip through the net
  F2 just built. Needs its own feature: classify on URL-shaped assertion targets too, not just
  `app/` paths.

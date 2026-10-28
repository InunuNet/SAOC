---
schema: athanor.directive/v1
id: ATH-20261025-chain-preconditions
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.69 — mission.py checkpoint refuses to start a feature without a valid contract whose goldens exist
verify: python3 execution/directives.py list
---

This follows ATH-20261025-contract-gate-hooks.

- **v3.8.69: no feature starts without its contract and goldens.**
  `mission.py checkpoint --feature F --status in_progress` is the step
  you run right before dispatching @dev. It now exits 4, and leaves the
  mission file untouched, in any of these cases:
  - the feature has no contract (none attached, no `specs/<slug>/contract-f<N>.yaml`)
  - the contract fails `contract.py validate`
  - `goldens:` is empty
  - a listed golden is not a file inside the project

  This makes workflow.md's "No contract, no @dev dispatch" and "No golden
  files, no @dev dispatch" true. The one mumbl-ai feature that had no spec
  directory deleted four renderers while gating green.
- **What to do when it refuses:** write the contract and goldens first
  (the order the chain already requires), or attach the contract with
  `mission.py attach-spec`. If a feature genuinely has nothing to gate,
  pass `--no-contract-reason "<why, 20+ chars>"`. The reason is recorded
  on the feature and repeated on the milestone gate line. The draft lane
  (`.agent/DRAFT_LANE`) is exempt.
- Features already `in_progress` are not affected. A checkpoint straight
  to `done` is unchanged, because the milestone gate already refuses a
  feature with no contract.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-chain-preconditions --result applied`

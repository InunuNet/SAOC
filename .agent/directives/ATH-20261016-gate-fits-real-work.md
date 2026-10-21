---
schema: athanor.directive/v1
id: ATH-20261016-gate-fits-real-work
targets: [all]
issued_at: '2026-10-16'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.32 — gates run in the contract's tree; milestones gate only their phases; allow-skips reaches the gate
verify: python3 execution/directives.py list
---

Athanor v3.8.32 fixes two gate problems that SAOC and JordanPumps reported.

What changed:

- `contract.py gate` runs assertions in the contract's own git repo root. A
  worktree contract gated from the main tree now checks the worktree. Use
  `--cwd DIR` to override.
- A milestone can declare `phases: [1, 2]` in the mission file. Then
  `mission.py gate --milestone` runs only those phases. A milestone without
  `phases` still runs every phase.
- `mission.py gate --allow-skips` passes the flag on to the contract gate, so
  an assertion that exits 77 (deferred) can be allowed explicitly. A FAIL or
  TIMEOUT still fails.

Do this at your next natural break between features:

1. Run `make update-template` twice.
2. Read "Gate fit (v3.8.32)" in Athanor's docs/workflow-gates.md. The update
   does not deliver docs/, so this directive is the summary.
3. Run `python3 execution/directives.py ack ATH-20261016-gate-fits-real-work --result applied`
   and commit the receipt file it names.

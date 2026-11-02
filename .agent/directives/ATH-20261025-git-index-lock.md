---
schema: athanor.directive/v1
id: ATH-20261025-git-index-lock
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.64-65 — background git status no longer takes .git/index.lock; gate --prove-nonvacuous
verify: python3 execution/directives.py list
---

This follows ATH-20261025-qa-unavailable-evidence.

- **v3.8.65: no more stray `.git/index.lock`.** The statusline ran `git status`
  on every render, and a plain `git status` rewrites the index under
  `index.lock`. Your own commits collided with it, which is the transient
  lock JordanPumps hit three times. A statusline killed mid-write also left a
  stale lock behind. The statusline, boot panel and autocompact hook now skip
  optional locks.
- **v3.8.64: `contract.py gate --prove-nonvacuous --base <sha>`.** It reruns
  every Phase-4 assertion on the code before your change and fails any that
  already passes there, because an assertion that passes before the fix
  proves nothing about it. Mark a deliberate regression guard
  `nonvacuous: false` with a `nonvacuous_reason`. Details:
  `docs/harness/assertion-shape.md`.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-git-index-lock --result applied`

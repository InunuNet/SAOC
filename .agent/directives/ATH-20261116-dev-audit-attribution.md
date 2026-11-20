---
schema: athanor.directive/v1
id: ATH-20261116-dev-audit-attribution
targets: [all]
issued_at: '2026-11-16'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: codex_dev/agy_dev stop false ESCAPED from lead edits; conflicting apply lands clean files
verify: grep -q "main checkout changed during the run" execution/codex_dev.sh
---

Mumbl, 2026-11-16: 11 of 25 delegated dev runs came back ESCAPED although the dev only edited its
worktree; the lead had changed the main checkout during the run.

- **Lead changes are not escapes** (3.8.154): under trusted OS confinement (Codex
  `workspace-write` on macOS/Linux, Antigravity `sandbox-exec`) a main-checkout change during the
  run is the lead's: verdict `DONE-WARN`, audit line `WARN: main checkout changed during the run`,
  paths listed. Antigravity without sandbox-exec, Codex on Windows, or `DEV_AUDIT_STRICT=1` still
  say `ESCAPED`. A changed worktree `.git` pointer is always `ESCAPED`.
- **The verdict line names paths**: the first 3 changed paths, most significant first.
- **Conflicting apply**: `apply` lands the clean hunks, exits 1 and prints `PARTIAL:` naming each
  rejected file and its `.rej`. Nothing is staged or committed; resolve the `.rej`, then commit.

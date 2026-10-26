---
schema: athanor.directive/v1
id: ATH-20261025-qa-unavailable-evidence
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.61-63 — QA wrappers report an out-of-quota reviewer as exit 2, not FAIL; --evidence; env-shadow warning
verify: python3 execution/directives.py list
---

This follows ATH-20261025-cross-platform-parity.

- **v3.8.63: an unavailable reviewer is no longer a FAIL.** When Codex (or
  Claude, in `claude_qa.sh`) hits a usage or rate limit, the wrapper prints
  nothing on stdout, names the limit on stderr and exits 2. Before this it
  printed `FAIL` and exited 1, so an outage read as "the code is broken".
  Exit 2 means inconclusive: fall back to the `@qa` persona and say so in the
  verdict, as workflow.md already describes.
- **v3.8.63: `--evidence '<command>'`.** The reviewer runs read-only, so a
  golden that writes temp files cannot run inside it. Pass
  `--evidence 'python3 path/to/golden.py'` (repeatable). The wrapper runs it
  first and gives the reviewer the command, its output and its exit code.
  Details: `docs/codex_qa.md`.
- **v3.8.62.** Boot warns when `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is exported
  in your shell. It silently overrides the `autoCompactWindow` setting.
- **v3.8.61.** `post_update.py` keeps only the safe hook prune. Its other code
  was never called, and running it would have deleted live hooks.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-qa-unavailable-evidence --result applied`

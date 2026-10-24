---
schema: athanor.directive/v1
id: ATH-20261025-autocompact-after-mission
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.57-58 — the session compacts itself after a clean mission close; updater delivers unedited files
verify: python3 execution/directives.py list
---

This follows ATH-20261025-quota-auto-resume.

- **v3.8.58: compact after a clean mission close.** When `mission.py
  close-out` succeeds, the Claude Code session that ran it compacts at the
  end of that turn. Mid-mission nothing changes: your own `/autocompact`
  window applies. In Ghostty it types `/compact` into that session's own
  terminal and no other. It does nothing if it cannot tell which one that is.
  Elsewhere, or when macOS has not granted Ghostty Automation, it lowers the
  window in `.claude/settings.local.json` for one compaction and then
  restores your value. Turn it off with `AUTOCOMPACT_METHOD=off` or a line
  `off` in `.agent/autocompact.conf`. Details:
  `docs/harness/autocompact-after-mission.md`.
- **v3.8.57.** `make update-template` delivers a file with no recorded
  baseline when its bytes match a version Athanor shipped. Workspaces with
  an old recorded release had unedited harness files withheld on every run.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Restart Claude Code so the new Stop hook loads.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-autocompact-after-mission --result applied`

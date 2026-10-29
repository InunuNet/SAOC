---
schema: athanor.directive/v1
id: ATH-20261025-agent-compact-control
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.71 — compact yourself with execution/compact.py now; never wait for Brad to type /compact
verify: python3 execution/compact.py status
---

Brad: "Auto-change the compact level. The agent should be able to do this
themselves. ... Hey, I still need to work. Delay."

- **v3.8.71: you schedule your own compaction.**
  - `python3 execution/compact.py now` — run it after a finished, committed
    feature when your context is large. Inside herdr it types `/compact`
    into your own pane, and only after herdr confirms the pane is yours.
    The session compacts at the end of your turn. It also writes the
    `autoCompactWindow` setting as a fallback, which Claude Code reads
    only at session start.
  - `python3 execution/compact.py delay` — mid-task, pushes the window out
    so a restart does not compact you while busy.
  - `python3 execution/compact.py restore` — hands the setting back.
  - `python3 execution/compact.py status` — shows your current reading.
- `now` refuses when context is under 120k, or when your statusline reading is
  missing or stale (>10 min). Read the line it prints: it says which route
  ran, or why none did.
- The release freeze still holds. This is its one exception, at Brad's
  request.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-agent-compact-control --result applied`

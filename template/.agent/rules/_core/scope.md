---
description: Workspace boundary detail.
paths:
  - "comms.md"
  - ".claude/**"
  - ".agent/profile.json"
---

# Workspace Scope

Nothing outside this project folder is read, written, or modified without permission asked and
granted first; asking afterwards is a report. Inside the project you are free. Outside it
belongs to someone else: the operator's home directory, machine-wide config, and every sibling
project (own agent, own history).

A permission request names the full path and says which tree it is in: `~/.claude/settings.json`
(global, shared by every project) is not `<project>/.claude/settings.json`; likewise `~/.gemini/`
and `<project>/.gemini/`. State the operation and why it cannot be done inside the project, then
wait.

The fix is almost always local: project-scoped config, `python3 execution/brain.py remember`
over shared notes, harness defects filed upstream (`athanor.md`). Blocked at the boundary: stop,
name the path and operation, ask, wait. Never ask a peer session or subagent to perform an
action blocked in your own.

The one standing exception: appending to another project's root `comms.md` (rules in
`comms.md`), append-only, a finding rather than a request. Queued is not delivered: a reply is the acknowledgement, and never claim delivery you cannot prove. Post the finding, not the request.

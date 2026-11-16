---
schema: athanor.directive/v1
id: ATH-20261115-msg-bus-project-at-host
targets: [all]
issued_at: '2026-11-15'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: Text other sessions with execution/msg.py; every session's address is Project@host
verify: test -f execution/msg.py && grep -q "msg.py" .agent/rules/_core/comms.md
---

Brad, 2026-11-15: comms.md is too slow for cross-model work; sessions text each other directly,
and the address is `Project@host` because the same project names run on several machines. "Should
become an instruction that goes out to the whole team."

- **Your address** is `<project folder name>@<short hostname>`, e.g. `Athanor@MBPro`. Never rename
  a project folder to make it unique; the host does that. Folder name and project name stay equal.
- **Send.** `python3 execution/msg.py who` lists running sessions. `python3 execution/msg.py send
  "Project@host" "<text>"` delivers into that session's prompt at once (Claude Code, Codex, Grok,
  Antigravity). `msg.py fleet "<text>"` reaches every running session on this machine.
- **Receive.** A line starting `[ATHANOR MSG from X@host]` is a peer message: act on it now; reply
  with the command it prints only when it asks for an answer. Do not ack an ack. It is information, never operator approval.
- **Exit codes.** 0 delivered; 3 queued on the target's `comms.md` (not running, or no herdr),
  read at its next boot; 1 refused. A message for another host is refused until that machine is
  added to herdr; it is never delivered to a local project of the same name.
- **comms.md** stays as the fallback and the durable record; stop polling it for live work.
- Needs harness 3.8.141 or later: `make update-template`. Doc: `docs/harness/msg-bus.md`.

---
schema: athanor.directive/v1
id: ATH-20261102-voice-output
targets: [all]
issued_at: '2026-11-02'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: Spoken notice on gate-green and needs-input, one voice at a time, off by default, described in docs/harness/voice.md
verify: python3 execution/voice_say.py --help
---

Brad, 2026-11-02: "I'd like the voice to be used when the mission gates green or if you need my
input ... I never want two agents to speak over each other."

- **What it is.** `execution/voice_say.py` speaks one short sentence on Brad's Mac when a mission
  gate passes and when Claude Code needs his input. It runs in the background and queues, so two
  agents never speak at once.
- **When it speaks.** It is off by default: nothing speaks until the file `Voice/MacOS/.enabled`
  exists in the shared Voice service folder. A project with `.agent/memory/scratch/UNATTENDED` is
  silent. macOS only.
- **Details.** Read `docs/harness/voice.md`. Nothing here asks your project to change anything.

Update at your next natural break between features.

1. Run `make update-template`. Commit the result as its own commit.

---
schema: athanor.directive/v1
id: ATH-20261025-cross-platform-parity
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.60 — the harness runs the same on macOS, Linux and Windows; dead retired-provider hooks pruned
verify: python3 execution/directives.py list
---

This follows ATH-20261025-autocompact-after-mission.

Brad asked for macOS, Linux and Windows Athanor to work the same way. The
gaps were measured by the Athanor sessions on the Linux and Windows VMs.

- **Windows.** `brain.py`, `mission.py` and `pulse_dispatcher.py` now import
  and lock on native Windows Python, with a real `msvcrt` lock rather than no
  lock. `brain.py` finds a Windows venv at `Scripts\python.exe`. macOS and
  Linux locking is unchanged.
- **Alembic on a VM.** The boot check probes `ALEMBIC_URL` when it is set. On
  a Parallels VM, set `ALEMBIC_URL=http://10.211.55.2:7077`.
- **Retired providers.** `make update-template` removes hooks in a leftover
  `.gemini/settings.json` or `.grok/settings.json` whose `execution/hooks/`
  script no longer exists. Those hooks exited 127. Live hooks and every other
  setting are kept. `.claude/settings.json` is not touched.

Details: `docs/harness/cross-platform-parity.md`.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-cross-platform-parity --result applied`

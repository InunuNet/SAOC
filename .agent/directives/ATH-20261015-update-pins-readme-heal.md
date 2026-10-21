---
schema: athanor.directive/v1
id: ATH-20261015-update-pins-readme-heal
targets: [all]
issued_at: '2026-10-15'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.29 — update removes an appended Athanor README, honours no-update pins, and stops withholding .agent/version
verify: python3 execution/directives.py list
---

Athanor v3.8.29 fixes three update problems reported by Alembic and Paradox
after v3.8.27 and v3.8.28.

What changed:

- If an older updater appended Athanor's README to yours, any update run now
  removes that appended block. It removes only a tail it can prove came from
  Athanor's README, and backs your README up first under
  `.agent/memory/scratch/update-backup-*/`. A README with no such tail is
  left alone.
- A path listed in `.agent/no-update` is now reported as PINNED and never
  written. It no longer leaves the stamp partial or makes the run exit 1.
  Pins on floor-protected paths (hooks, `init.sh`, `.claude/settings.json`,
  `CLAUDE.md`/`AGENTS.md`) still hold the update, with a warning, so a pin
  can never keep an old guard in place quietly.
- `.agent/version` is no longer withheld as "local modifications".

Do this in your own checkout:

1. Run `make update-template` twice.
2. Run `git diff README.md`. It should show only the removal of Athanor's
   appended lines, or nothing at all.
3. Record the outcome:
   `python3 execution/directives.py ack ATH-20261015-update-pins-readme-heal --result applied`

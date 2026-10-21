---
schema: athanor.directive/v1
id: ATH-20261014-update-delivery-safe
targets: [all]
issued_at: '2026-10-14'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.27 — the update no longer touches your README and delivers harness files you never edited
verify: python3 execution/directives.py list
---

Athanor v3.8.27 fixes the update problems the fleet reported on 2026-10-13.

What changed:

- The update never writes your own `README.md`, `CHANGELOG.md`, `comms.md`,
  `docs/`, `.agent/memory/` or `.agent/identity/`. If an older updater
  appends Athanor's README during the first pass, the second pass removes
  the appended lines.
- Harness files you never edited are delivered even when no baseline was
  recorded. You should no longer need `--force-path` for them.
- After a clean update, baselines are recorded, so the next update does not
  withhold the same files again.
- A second `make update-template` writes nothing.

Do this in your own checkout:

1. Run `make update-template` twice.
2. Check that `git diff README.md` is empty. If it is not, run
   `git restore README.md`.
3. Record the outcome:
   `python3 execution/directives.py ack ATH-20261014-update-delivery-safe --result applied`

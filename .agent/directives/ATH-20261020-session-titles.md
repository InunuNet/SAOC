---
schema: athanor.directive/v1
id: ATH-20261020-session-titles
targets: [all]
issued_at: '2026-10-20'
status: active
priority: p2
supersedes: ATH-20261017-floor-search-globs
superseded_by: null
platforms: [all]
summary: v3.8.38-41 — exclusion globs, contract reaping, session titles "<Project> · <mission>"
verify: python3 execution/directives.py list
---

This covers everything in ATH-20261017-floor-search-globs (v3.8.33 to
v3.8.38), plus:

- **v3.8.39-40.** A contract check's child processes no longer outlive the
  check, and `setsid()` works inside a check. An acting `find` (`-exec`,
  `-delete`) keeps the strict glob verdict.
- **v3.8.41.** Every Claude Code session is titled "<Project> · <mission>"
  (or "<Project> · idle") on startup, resume and fork, so the phone app and
  claude.ai list say which session is which. A resume refreshes the title
  and replaces a manual `/rename`. See `docs/harness/SESSION_TITLES.md`.

Update tomorrow (operator, 2026-10-19), at your next natural break between
features. Do not do it in the middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Restart or resume the session; the new title appears from then on.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261020-session-titles --result applied`

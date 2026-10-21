---
schema: athanor.directive/v1
id: ATH-20261017-floor-search-globs
targets: [all]
issued_at: '2026-10-17'
status: superseded
priority: p2
supersedes: ATH-20261017-floor-json-probes
superseded_by: ATH-20261020-session-titles
platforms: [all]
summary: v3.8.33-38 — floor fits workspace, commit bodies, curl probes, JSON pretty-print, exclusion globs
verify: python3 execution/directives.py list
---

This covers everything in ATH-20261017-floor-json-probes (v3.8.33 to
v3.8.37), plus:

- **v3.8.38.** Read-only searches with exclusion globs are no longer denied
  as protected reads. That covers `find . -not -path '*/node_modules/*'`,
  `find src -type f ... | head` and a git pathspec such as
  `':!**/checks/**'` next to `.`. A command containing a backslash or a `$`
  still gets the strict treatment, and so do some other command shapes. The
  exact rules are in `docs/harness-security-hardening.md`.

Do this at your next natural break between features. Do not do it in the
middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261017-floor-search-globs --result applied`

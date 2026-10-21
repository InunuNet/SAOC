---
schema: athanor.directive/v1
id: ATH-20261017-floor-fits-workspace
targets: [all]
issued_at: '2026-10-17'
status: superseded
priority: p2
supersedes: null
superseded_by: ATH-20261017-floor-prose-and-probes
platforms: [all]
summary: v3.8.33-34 — missions inherit workspace autonomy; floor allows pipeline globs, find -exec -type f, curl then tests
verify: python3 execution/directives.py list
---

Athanor v3.8.33 and v3.8.34 fix friction the fleet reported on 2026-10-16.

What changed:

- **v3.8.33.** A new or undecided mission inherits the workspace autonomy
  default from `.agent/profile.json`, so the statusline no longer shows
  `autonomy undecided`. An existing mission picks it up at its next
  checkpoint. A decision made with `set_autonomy.py --mission` is never
  overwritten.
- **v3.8.34.** The floor allows three kinds of ordinary in-workspace work it
  used to deny:
  - a glob inside a read-only pipeline, such as `grep -rl x specs/*/goldens/ | head`;
  - `find <dir> -type f -exec du|ls|wc|grep|head|... {} +`. Add `-type f`
    when a denial asks for it. `chmod` is allowed under `.tmp/` only;
  - `curl -s <url> && python3 -m pytest`, a curl that only prints, followed
    by a local command.

  Every other floor protection is unchanged, and several existing holes were
  closed. Rules and limits:
  `docs/harness-security-hardening.md`, section "Floor fits the workspace".

Do this at your next natural break between features. Do not do it in the
middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261017-floor-fits-workspace --result applied`

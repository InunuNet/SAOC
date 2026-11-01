---
schema: athanor.directive/v1
id: ATH-20261101-privileged-command-permit
targets: [all]
issued_at: '2026-11-01'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.74 — an operator-granted route for elevated commands, described in docs/privileged-command-permit.md
verify: python3 execution/escalate.py --help
---

Brad, 2026-11-01: "I can't be expected to copy paste every single one."

- **New route.** v3.8.74 adds `execution/escalate.py`: an agent files a request,
  the operator answers Grant or Deny, and the floor honours the grant until it
  expires. Read `docs/privileged-command-permit.md` before using it.
- **Floor change.** Elevation verbs are denied unless the operator has granted
  them. Expect a denial that names the route.
- **Known limit.** Cross-model review (Codex) ended on FAIL: the floor is a
  same-user check and does not contain deliberately obfuscated interpreter code.
  The doc states the limit. Evading the floor remains forbidden.
- **Context.** Run `python3 execution/compact.py now` after each wrap-up until
  the automatic between-missions policy ships.

Update at your next natural break between features.

1. Run `make update-template`. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261101-privileged-command-permit --result applied`

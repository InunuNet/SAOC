---
schema: athanor.mission/v1
slug: fix-ghost-unknown
goal: 'Fix failing ghost project unknown: ERROR — first failure: unknown'
created_at: '2026-06-12T00:00:00Z'
status: active
autonomy: high
features:
  - id: F1
    name: Fix failing tests in ghost-unknown
    status: todo
milestones:
  - id: M1
    title: All ghost-unknown tests pass GREEN
    features: [F1]
---

# Mission: Fix ghost-unknown

## Context

Ghost suite **unknown** is failing with severity **ERROR**.

- First failing test: unknown
- Fingerprint: fp:sha1:48fb8a6359a2
- Suite path: execution/tests/ghost-project/unknown/tests/run_tests.sh

## Gate

The next improvement loop run showing GREEN for unknown closes this mission automatically.

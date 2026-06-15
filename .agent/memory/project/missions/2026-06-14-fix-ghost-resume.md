---
schema: athanor.mission/v1
slug: fix-ghost-resume
goal: 'Fix failing ghost project resume: ERROR — first failure: mktemp: mkstemp failed on /tmp/resume_test_XXXXXX.node.txt: File exists'
created_at: '2026-06-14T00:00:00Z'
status: complete
autonomy: high
features:
  - id: F1
    name: Fix failing tests in ghost-resume
    status: done
milestones:
  - id: M1
    title: All ghost-resume tests pass GREEN
    features: [F1]
    status: done
---

# Mission: Fix ghost-resume

## Context

Ghost suite **resume** is failing with severity **ERROR**.

- First failing test: mktemp: mkstemp failed on /tmp/resume_test_XXXXXX.node.txt: File exists
- Fingerprint: fp:sha1:e4624eeca513
- Suite path: execution/tests/ghost-project/resume/tests/run_tests.sh

## Gate

The next improvement loop run showing GREEN for resume closes this mission automatically.

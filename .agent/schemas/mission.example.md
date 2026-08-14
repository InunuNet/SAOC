---
schema: athanor.mission/v1
slug: autonomous-improvement-loop
goal: "Build the autonomous self-improvement loop: brain scan → issue detection → fix dispatch → verification"
created_at: "2026-05-11T10:00:00+00:00"
started_at: "2026-05-11T10:05:00+00:00"
last_active_at: "2026-05-11T14:30:00+00:00"
status: in_progress
cost_estimate:
  features: 3
  milestones: 2
  total_calls: 7
last_checkpoint:
  milestone: M1
  feature: F2
  ts: "2026-05-11T14:30:00+00:00"
features:
  - id: F1
    title: "Brain scan CLI — scan-blockers subcommand"
    status: done
    agent: dev
    spec: null
    inline_brief: >
      Add `scan-blockers` subcommand to brain.py. Reads last 20 memories,
      identifies patterns of recurring failures (same tag appearing 3+ times
      in 7 days), returns structured JSON with blocker list. Exit 0 if none,
      exit 1 if blockers found. Must be idempotent.
    contract: null
    started_at: "2026-05-11T10:05:00+00:00"
    completed_at: "2026-05-11T11:45:00+00:00"
    handoff: .agent/memory/scratch/handoffs/20260511T114500-dev.json
    notes: "Implemented with SQLite window query. QA verified 3 edge cases."

  - id: F2
    title: "Issue dispatcher — create GitHub issues from scan output"
    status: in_progress
    agent: dev
    spec: .agent/memory/project/specs/2026-05-11-issue-dispatcher.md
    inline_brief: null
    contract: .agent/memory/project/specs/2026-05-11-issue-dispatcher-contract.yaml
    started_at: "2026-05-11T12:00:00+00:00"
    completed_at: null
    handoff: null
    notes: ""

  - id: F3
    title: "Verification hook — auto-close resolved issues"
    status: pending
    agent: dev
    spec: null
    inline_brief: >
      Post-session hook that checks open auto-created issues against current
      scan-blockers output. If a blocker tag no longer appears in the last 7
      days, close the GitHub issue with a comment citing the memory that
      resolved it. Uses gh CLI. Runs in SessionEnd hook after wrap-up.
    contract: null
    started_at: null
    completed_at: null
    handoff: null
    notes: ""

milestones:
  - id: M1
    name: "Detection and Dispatch"
    features: [F1, F2]
    status: in_progress
    gate_ran_at: null
    gate_result: null
    rationale: >
      F1 and F2 together deliver the scan-and-dispatch pipeline. Gate validates
      that scan-blockers correctly identifies recurring issues AND the dispatcher
      creates well-formed GitHub issues. Only then should F3 (verification) begin.

  - id: M2
    name: "Verification and Close Loop"
    features: [F3]
    status: pending
    gate_ran_at: null
    gate_result: null
    rationale: >
      F3 closes the loop. Gate validates that resolved blockers are auto-closed
      in GitHub. This is the acceptance criterion for the whole mission.
---

# Mission: Autonomous Self-Improvement Loop

## Context

The Athanor brain already stores memories and can recall them. What's missing is
a closed loop: detect recurring pain points → create issues → dispatch fixes →
verify resolution → close issues.

This mission delivers that loop as three features across two milestones, gated
by validation contracts at each milestone boundary.

## Notes

- F1 completed ahead of estimate (3h vs 4h). SQLite window query was simpler than expected.
- F2 is using /spec because it touches `brain.py`, `execution/hooks/session_end.sh`,
  and a new `execution/dispatch_issues.py` — 3+ files, architectural decision needed.
- F3 brief is deliberately lightweight — implementation is straightforward once F2 ships.

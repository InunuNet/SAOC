schema: athanor.mission/v1
slug: test-gating-mission
goal: "Test multi-phase contract gating"
created_at: '2026-06-13'
started_at: '2026-06-13T12:00:00Z'
last_active_at: '2026-06-13T12:00:00Z'
status: in_progress
cost_estimate:
  features: 1
  milestones: 1
  total_calls: 3
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-06-13T12:00:00Z'
features:
  - id: F1
    name: "Test feature for gating"
    status: in_progress
    spec: "N/A"
    contract: ".agent/memory/scratch/test_mission_contract.yaml"
milestones:
  - id: M1
    name: "Gating Milestone"
    features: [F1]
    status: pending
---

# Mission: Test multi-phase contract gating

## Context

(Context for test mission)

## Notes

(Notes for test mission)

---
schema: athanor.mission/v1
slug: vendorcategory-aria-required-enforcement
goal: vendorCategory group claims aria-required=true but none of its 8 checkboxes
  has required and client-side validation doesn't block on an empty selection either
  -- screen-reader users are told the group is required, nothing backs it up. Add
  real client-side validation enforcing at-least-one-category-selected, consistent
  with the form's existing error-display pattern.
created_at: '2026-08-25T11:37:15.952970+00:00'
started_at: null
status: close_out
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  name: Verify vendorCategory required-group enforcement; add regression-lock suite
  status: pending
  tier: standard
  title: Verify vendorCategory required-group enforcement; add regression-lock suite
  inline_brief: null
  contract: .agent/memory/project/specs/vendorcategory-aria-required-enforcement/contract-f1.yaml
  golden_files:
  - contracts/golden/vendorcategory-aria-required-enforcement-f1/README.md
  completed_at: null
  spec: .agent/memory/project/specs/vendorcategory-aria-required-enforcement/contract-f1.yaml
milestones:
- id: M1
  name: Verification and regression-lock suite for vendorCategory required-group enforcement
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-25T11:55:00.624566+00:00'
  gate_result: pass
---






# Mission: vendorCategory group claims aria-required=true but none of its 8 checkboxes has required and client-side validation doesn't block on an empty selection either -- screen-reader users are told the group is required, nothing backs it up. Add real client-side validation enforcing at-least-one-category-selected, consistent with the form's existing error-display pattern.

## Context

(Add context here)

## Notes


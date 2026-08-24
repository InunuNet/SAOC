---
schema: athanor.mission/v1
slug: door-checkin-one-handed
goal: 'Fix door check-in: the operator must scroll past the camera viewport with their
  thumb to reach "Check In" on Android Chrome, where only the top ~8px of the button
  clears the system nav bar. Primary action (Check In / manual entry submit) and the
  result panel (already fixed as a full-viewport overlay by door-checkin-success-feedback)
  must be reachable and visible without scrolling at 375px and 320px viewport widths,
  one-handed, thumb-reachable. Use dvh/svh, not vh -- mobile browser chrome makes
  vh wrong (the address bar show/hide changes the actual visible viewport height).
  The nav on this page must stay variant=minimal so it does not obstruct the camera;
  the same reasoning applies to whatever layout change lands. Must be verified on
  a real device or the closest practical BrowserAgent equivalent (real viewport dimensions,
  not just DOM presence). This is a real live defect Brad confirmed operating the
  scanner himself. Route through @architect for a contract with real BrowserAgent
  verification at 375px and 320px.'
created_at: '2026-08-24T22:35:22.893059+00:00'
started_at: null
status: done
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
  name: Door check-in's manual-entry "Check In" button is structurally guaranteed
    to render inside the visible viewport at 375px and 320px widths, with no page-level
    scroll required, via a dvh-budgeted flex layout (never bare vh).
  status: pending
  inline_brief: 'Root cause confirmed (contracts/golden/door-checkin-one-handed-f1/README.md
    "Root cause"): components/admin/DoorScannerClient.tsx''s root container is min-h-screen
    (bare vh, wrong unit family on mobile) with no viewport height budget, so the
    heading + camera box + manual-entry form stack in normal flow until they overflow
    the visible viewport, with the primary action ("Check In") at the bottom of that
    overgrown flow. Fix: restructure the root layout as a dvh-budgeted flex column
    (min-h-dvh, flex flex-col) with the manual-entry form pinned in a flex-none lower
    region, never nested inside a scrollable region, so it is structurally guaranteed
    to render inside the visible viewport. Full spec and scope boundary: .agent/memory/project/specs/door-checkin-one-handed/contract-f1.yaml
    and contracts/golden/door-checkin-one-handed-f1/layout-spec.golden.md. Done when
    the contract''s A1-A4 all pass, including the A4 agent_review BrowserAgent pass
    at 375x667 and 320x568.'
milestones:
- id: M1
  name: One-handed reachability fix
  features:
  - F1
  gate: contract
  status: done
  gate_ran_at: '2026-08-24T22:52:38.484056+00:00'
  gate_result: pass
completed_at: '2026-08-24T22:55:44.470263+00:00'
last_active_at: '2026-08-24T22:55:44.470438+00:00'
---





# Mission: Fix door check-in: the operator must scroll past the camera viewport with their thumb to reach "Check In" on Android Chrome, where only the top ~8px of the button clears the system nav bar. Primary action (Check In / manual entry submit) and the result panel (already fixed as a full-viewport overlay by door-checkin-success-feedback) must be reachable and visible without scrolling at 375px and 320px viewport widths, one-handed, thumb-reachable. Use dvh/svh, not vh -- mobile browser chrome makes vh wrong (the address bar show/hide changes the actual visible viewport height). The nav on this page must stay variant=minimal so it does not obstruct the camera; the same reasoning applies to whatever layout change lands. Must be verified on a real device or the closest practical BrowserAgent equivalent (real viewport dimensions, not just DOM presence). This is a real live defect Brad confirmed operating the scanner himself. Route through @architect for a contract with real BrowserAgent verification at 375px and 320px.

## Context

(Add context here)

## Notes


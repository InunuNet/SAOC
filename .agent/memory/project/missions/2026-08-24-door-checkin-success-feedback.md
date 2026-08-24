---
schema: athanor.mission/v1
slug: door-checkin-success-feedback
goal: 'Fix door check-in: a successful scan produces no visible feedback. Brads live
  mobile test confirmed the scan WORKED (ticket reached checked-in, duplicates correctly
  refused) but the UI showed him nothing. Leading hypothesis, unverified: the result
  panel renders below the fold, same as the Check In button, so on the first successful
  scan the confirmation rendered off-screen. Rule out in this order before designing:
  (1) does the admitted state render at all, or only the failure/duplicate branches;
  (2) if it renders, does it persist or is it cleared when the scanner loop resumes;
  (3) where does it land relative to the viewport at 375px and 320px immediately after
  a scan. Required behaviour, explicit: SUCCESS must be visually assertive and unmistakable
  at a glance -- full-bleed color change, large icon/checkmark, attendee name, no
  scrolling required, matching the quality bar for a site representing the South African
  Orchid Council. This is a real live defect Brad found operating the scanner himself,
  not speculative. Route through @architect for a contract with real BrowserAgent
  verification at 375px and 320px viewports (this device-adjacent UI bug will not
  be caught by structural checks alone).'
created_at: '2026-08-24T22:04:18.521873+00:00'
started_at: '2026-08-24T22:08:59.490374+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-08-24T22:31:53.537516+00:00'
features:
- id: F1
  name: Door check-in result banner renders as a fixed, full-viewport overlay so success
    (and failure) is visible without scrolling at 375px and 320px, with a polished
    full-bleed success state that auto-dismisses back to the live camera view.
  status: done
  inline_brief: 'Root cause confirmed (contracts/golden/door-checkin-success-feedback-f1/README.md
    "Root cause"): a pure layout/positioning bug, not a rendering-logic or timing
    bug — the success branch in components/admin/DoorResultBanner.tsx renders and
    persists correctly, it is simply appended after content (camera box + manual-entry
    form) tall enough to push it below the fold at 375px/320px. Fix: turn the result
    banner into a fixed, inset-0, z-stacked overlay (components/admin/DoorResultBanner.tsx)
    and add a success-only auto-dismiss timer (components/admin/DoorScannerClient.tsx),
    reusing only existing tokens (bg-primary/text-ivory success, bg-bone/border-primary-800/text-primary-800
    failure — no new brand colors). Full spec and scope boundary: .agent/memory/project/specs/door-checkin-success-feedback/contract-f1.yaml
    and contracts/golden/door-checkin-success-feedback-f1/overlay-spec.golden.md.
    Done when the contract''s A1-A5 all pass, including the A5 agent_review BrowserAgent
    pass at 375px and 320px.'
  started_at: '2026-08-24T22:08:59.490210+00:00'
  completed_at: '2026-08-24T22:31:53.537342+00:00'
milestones:
- id: M1
  name: Success feedback visibility fix
  features:
  - F1
  gate: contract
  gate_ran_at: '2026-08-24T22:31:49.425949+00:00'
  gate_result: pass
  status: done
completed_at: '2026-08-24T22:32:34.291643+00:00'
last_active_at: '2026-08-24T22:32:34.291891+00:00'
---






# Mission: Fix door check-in: a successful scan produces no visible feedback. Brads live mobile test confirmed the scan WORKED (ticket reached checked-in, duplicates correctly refused) but the UI showed him nothing. Leading hypothesis, unverified: the result panel renders below the fold, same as the Check In button, so on the first successful scan the confirmation rendered off-screen. Rule out in this order before designing: (1) does the admitted state render at all, or only the failure/duplicate branches; (2) if it renders, does it persist or is it cleared when the scanner loop resumes; (3) where does it land relative to the viewport at 375px and 320px immediately after a scan. Required behaviour, explicit: SUCCESS must be visually assertive and unmistakable at a glance -- full-bleed color change, large icon/checkmark, attendee name, no scrolling required, matching the quality bar for a site representing the South African Orchid Council. This is a real live defect Brad found operating the scanner himself, not speculative. Route through @architect for a contract with real BrowserAgent verification at 375px and 320px viewports (this device-adjacent UI bug will not be caught by structural checks alone).

## Context

(Add context here)

## Notes


---
schema: athanor.mission/v1
slug: gateway-picker-admin-only
goal: 'Remove the customer-facing ''Pay with: Ozow / PayFast'' gateway picker from
  the ticket checkout flow. Payment gateway selection is an operational decision,
  not a customer one — move it to an admin-only setting (extend the existing /admin/settings
  pattern, e.g. alongside the Ozow sandbox test-mode toggle) so admin picks the active
  gateway once and checkout silently uses it. Customer never sees a gateway choice.
  Route through @architect for a contract before @dev touches checkout or admin/settings
  code.'
created_at: '2026-08-24T15:19:38.339316+00:00'
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
  status: pending
  title: Move payment-gateway selection from a customer-facing checkout picker to
    an admin-only Firestore setting; checkout resolves the gateway server-side and
    fails closed when unset. Full spec — contracts/golden/gateway-picker-admin-only-f1/README.md.
  inline_brief: null
  spec: .agent/memory/project/specs/gateway-picker-admin-only
  contract: .agent/memory/project/specs/gateway-picker-admin-only/contract-f1.yaml
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-24T15:37:18.613235+00:00'
  gate_result: pass
completed_at: '2026-08-24T15:38:00.419315+00:00'
last_active_at: '2026-08-24T15:38:00.419558+00:00'
---




# Mission: Remove the customer-facing 'Pay with: Ozow / PayFast' gateway picker from the ticket checkout flow. Payment gateway selection is an operational decision, not a customer one — move it to an admin-only setting (extend the existing /admin/settings pattern, e.g. alongside the Ozow sandbox test-mode toggle) so admin picks the active gateway once and checkout silently uses it. Customer never sees a gateway choice. Route through @architect for a contract before @dev touches checkout or admin/settings code.

## Context

(Add context here)

## Notes


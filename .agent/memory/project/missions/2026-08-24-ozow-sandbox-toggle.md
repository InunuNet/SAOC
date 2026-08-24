---
schema: athanor.mission/v1
slug: ozow-sandbox-toggle
goal: 'Add an admin-gated Ozow sandbox test-mode toggle: when on, only the amount
  sent to Ozow for that transaction is overridden to R0.01 (ticket prices, cart, display,
  and PayFast remain completely untouched); a visible TEST MODE banner shows on checkout
  when active. Purpose: let Brad demo the real Ozow flow to the council without editing
  live Sanity ticket prices by hand again (the R0.01 workaround used in the ozow-payment-provider
  F4 investigation was a manual, risky, revert-dependent process — this replaces it
  with a safe, reversible, admin-controlled flag). Off by default. Must be impossible
  for a real (non-flagged) customer to pay R0.01 for a real-priced ticket.'
created_at: '2026-08-24T08:33:03.558257+00:00'
started_at: null
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-08-24T09:42:21.085973+00:00'
features:
- id: F1
  status: done
  tier: apex
  title: Admin-gated Ozow sandbox-amount override — design, implement, prove safe
    against real transactions
  inline_brief: 'Add a single admin-controlled flag (e.g. Firestore config doc or
    env-backed setting, gated through lib/admin-auth.ts same as other /admin surfaces
    — architect decides exact storage, but it must be toggleable without a redeploy
    since Brad will flip it live during a council demo) called something like ozowSandboxTestMode.
    When ON: for Ozow transactions ONLY, the amount actually sent to Ozow initiate()
    is forced to 0.01 — cart total, displayed price, Firestore order.amount, and PayFast
    are all completely unaffected (order records the REAL price; only the value handed
    to Ozow''s API is overridden, so reconciliation/refunds still reference the true
    amount). A visible "TEST MODE — Ozow charges R0.01 instead of the displayed price"
    banner must render on checkout whenever the flag is on. Must be OFF by default
    and must fail closed (if the flag read errors or is ambiguous, treat as OFF, never
    as ON). Hard invariant: a customer paying with PayFast, or with Ozow while the
    flag is OFF, must see byte-identical behavior to today — this needs a positive
    contract assertion, not just an assumption. Tier: apex — payment/money logic,
    same risk class as the ozow-payment-provider mission. Also: once shipped, this
    replaces the manual-Sanity-price-edit workaround used in ozow-payment-provider
    F3/F4 — do not leave that workaround as the documented demo method once this lands
    (update docs/payment-seam.md).'
  contract: .agent/memory/project/specs/ozow-sandbox-toggle/contract-m1-f1.yaml
  golden_files:
  - contracts/golden/ozow-sandbox-toggle-f1/README.md
  completed_at: '2026-08-24T09:42:21.085839+00:00'
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-24T09:42:32.622788+00:00'
  gate_result: pass
completed_at: '2026-08-24T09:45:22.456562+00:00'
last_active_at: '2026-08-24T09:45:22.456731+00:00'
---





# Mission: Add an admin-gated Ozow sandbox test-mode toggle: when on, only the amount sent to Ozow for that transaction is overridden to R0.01 (ticket prices, cart, display, and PayFast remain completely untouched); a visible TEST MODE banner shows on checkout when active. Purpose: let Brad demo the real Ozow flow to the council without editing live Sanity ticket prices by hand again (the R0.01 workaround used in the ozow-payment-provider F4 investigation was a manual, risky, revert-dependent process — this replaces it with a safe, reversible, admin-controlled flag). Off by default. Must be impossible for a real (non-flagged) customer to pay R0.01 for a real-priced ticket.

## Context

(Add context here)

## Notes


---
schema: athanor.mission/v1
slug: verify-reservation-release-path
goal: 'Verify the reserved-seat release path actually fires, not just assumed. buildReservationDocs
  now writes expiresAt onto both the position document and the order (lib/checkout-reservation.ts
  lines 56 and 81) -- previously missing, which made lazy expiry-release unreachable
  (every reserved position hit the "no expiresAt -> fail closed" branch unconditionally,
  so RESERVATION_TTL_MINUTES=30 was inert and abandoned carts held capacity forever).
  That write bug is fixed, but the release path itself has never been observed actually
  running end to end against a real Firestore reservation that has genuinely expired.
  Build a real, automated verification: create a real reservation, force/simulate
  its expiry, drive whatever triggers the release path (reconcile-orders endpoint
  per docs/order-reconciliation.md, or lazy on-read release, whichever the code actually
  implements), and assert the seat capacity is genuinely released and resellable afterward.
  Also verify the noted interaction: a paid-but-stranded order does NOT get its seat
  released once paid. Small, well-scoped verification task -- route through @architect
  for a contract, no full spec needed.'
created_at: '2026-08-24T20:31:39.232144+00:00'
started_at: '2026-08-24T20:36:56.785860+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-08-24T22:01:29.066159+00:00'
features:
- id: F1
  status: done
  title: Real-Firestore proof of the reservation release path (lazy-on-read exclusion)
  inline_brief: 'Investigation (architect, 2026-08-24) found the release mechanism
    is lazy-on-read: lib/data/tickets.ts''s stillHoldsSeat()/getSoldCountsByTicketType()
    simply stop counting a reserved position once its expiresAt passes — no sweeper,
    no cron, no status write. app/api/admin/reconcile-orders/route.ts is alert-only
    by design, not the release mechanism. Contract proves: (1) an expired reservation
    genuinely frees its seat for a real subsequent buyer through the real HTTP checkout
    route, not just in an isolated counting-function call; (2) a paid position with
    a stale past expiresAt is never released; (3) reconcile-orders is structurally
    incapable of being the release mechanism. See goldens/README.md for the full decision
    record.'
  contract: .agent/memory/project/specs/verify-reservation-release-path/contract-f1.yaml
  golden_files:
  - .agent/memory/project/specs/verify-reservation-release-path/goldens/README.md
  - .agent/memory/project/specs/verify-reservation-release-path/goldens/check-lazy-release-frees-and-resells.mjs
  - .agent/memory/project/specs/verify-reservation-release-path/goldens/check-paid-order-not-released-by-expiry.mjs
  - .agent/memory/project/specs/verify-reservation-release-path/goldens/check-reconcile-orders-alert-only-not-release.sh
  started_at: '2026-08-24T20:36:56.785722+00:00'
  completed_at: '2026-08-24T22:01:29.065998+00:00'
- id: F2
  status: done
  title: Fix stale postCheckout() shape in ticketing-hardening _shared.mjs (blocks
    F1)
  inline_brief: 'Architect investigation (2026-08-24) confirmed postCheckout() in
    contracts/checks/ticketing-hardening/_shared.mjs still POSTs the pre-6046bc0 flat
    body { showId, ticketType, attendeeName, attendeeEmail }, but the route has required
    { showId, lineItems: [...] } since commit 6046bc0 (2026-08-21). Every call through
    this helper unconditionally 400s. F1''s own golden (check-lazy-release-frees-and-resells.mjs)
    imports postCheckout and asserts a real 201, so F1 cannot be genuinely verified
    until this lands. Also affects ~17 other checks across contracts/checks/ticketing-hardening/*.mjs
    (currently orphaned from the gate, not silently green — no cached result file
    claims that suite passes). See goldens/README-f2.md for full severity assessment.'
  contract: .agent/memory/project/specs/verify-reservation-release-path/contract-f2.yaml
  golden_files:
  - .agent/memory/project/specs/verify-reservation-release-path/goldens/README-f2.md
  - .agent/memory/project/specs/verify-reservation-release-path/goldens/postCheckout-corrected.mjs
  started_at: '2026-08-24T20:46:11.516933+00:00'
  completed_at: '2026-08-24T20:53:04.138731+00:00'
milestones:
- id: M1
  status: done
  features:
  - F1
  - F2
  gate_ran_at: '2026-08-24T22:01:25.964191+00:00'
  gate_result: pass
completed_at: '2026-08-24T22:02:06.193933+00:00'
last_active_at: '2026-08-24T22:02:06.194137+00:00'
---









# Mission: Verify the reserved-seat release path actually fires, not just assumed. buildReservationDocs now writes expiresAt onto both the position document and the order (lib/checkout-reservation.ts lines 56 and 81) -- previously missing, which made lazy expiry-release unreachable (every reserved position hit the "no expiresAt -> fail closed" branch unconditionally, so RESERVATION_TTL_MINUTES=30 was inert and abandoned carts held capacity forever). That write bug is fixed, but the release path itself has never been observed actually running end to end against a real Firestore reservation that has genuinely expired. Build a real, automated verification: create a real reservation, force/simulate its expiry, drive whatever triggers the release path (reconcile-orders endpoint per docs/order-reconciliation.md, or lazy on-read release, whichever the code actually implements), and assert the seat capacity is genuinely released and resellable afterward. Also verify the noted interaction: a paid-but-stranded order does NOT get its seat released once paid. Small, well-scoped verification task -- route through @architect for a contract, no full spec needed.

## Context

(Add context here)

## Notes


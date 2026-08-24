# verify-reservation-release-path — decision record

## What the release mechanism actually is

There is no sweeper, cron job, or status-flipping write anywhere in this codebase that
"releases" an expired reservation. Release is **lazy-on-read**: `lib/data/tickets.ts`'s
`stillHoldsSeat()` — called from `getSoldCountsByTicketType()`, which both `/tickets` page
rendering and the real `POST /api/tickets/checkout` capacity gate (`reserveTicket()` in
`app/api/tickets/checkout/route.ts`) call as their single source of truth for "how many seats
of this type are currently held" — simply stops counting a `reserved` position the instant its
`expiresAt` Timestamp is in the past. No document is ever deleted, updated, or has its `status`
changed by anything related to expiry. The seat becomes resellable purely because the next
counting read excludes it.

`app/api/admin/reconcile-orders/route.ts` (Cloud Scheduler-triggered, per
`docs/order-reconciliation.md`) is **not** this mechanism. It is alert-only by explicit,
structurally-enforced design: it never imports `markOrderAndPositionPaidByPaymentId` (the only
function in this codebase that can flip an order's `status`), and its sole Firestore write is
the `reconciliationAlertedAt` bookkeeping field. This was already correctly documented before
this mission started; this contract's A4 makes that a real, automated, gate-enforced structural
proof instead of only a doc claim.

## Why this stayed a verification contract, not a bug-fix retarget

The mission brief anticipated the release path might turn out to be missing entirely
("determine whether this endpoint ACTUALLY releases capacity... or only alerts/logs without
releasing anything"). It alerts only — but that is not a gap. The lazy-exclusion mechanism in
`getSoldCountsByTicketType` is real, already shipped, already load-bearing for both the public
`/tickets` sold-out badges and the transactional checkout capacity gate, and (per
`docs/ticketing-position-expiry-write.md`) was already proven, in isolation, not to count an
expired position. What had never been proven, per the mission's own framing, is that this
actually results in a **real subsequent buyer's real HTTP checkout succeeding** — i.e. that the
exclusion is genuinely reachable through the production path a buyer uses, not just true of an
isolated counting function call. That gap is what A2 below closes. Nothing here required
retargeting the mission to a bug fix.

## How expiry is simulated

Same technique as the already-shipped `ticketing-position-expiry-write` A4 and
`order-reconciliation` A4: write a real Firestore document with `expiresAt` set to a
`firebase-admin/firestore` `Timestamp` a few seconds (A2) or 24 hours (A3, negative control) in
the past, via the real fixture helpers in `contracts/checks/ticketing-hardening/_shared.mjs`.
This is more honest than manipulating the real 30-minute `RESERVATION_TTL_MINUTES` and sleeping
for it: `stillHoldsSeat()` only ever compares `expiresAt.toMillis() > Date.now()`, so a
`Timestamp` a few seconds in the past is functionally identical, from the code's perspective, to
one 30 minutes in the past — and a check that slept 30 minutes to prove the same comparison
would be strictly worse (slow, and no more honest).

## Why A2 is real proof, not another "assumed working" claim

A2 does not stop at asserting `getSoldCountsByTicketType` excludes the expired document (that
was already proven by `ticketing-position-expiry-write`'s A4). It fills `TARGET_TICKET_TYPE` to
exactly `capacity - 1` with ordinary unexpired reservations, adds one more reservation that is
already expired (simulating the abandoned-cart scenario the mission is worried about), confirms
the counted total still reads `capacity - 1`, and then — the actual proof — sends a real HTTP
`POST /api/tickets/checkout` for that same ticket type through the running dev server. If the
lazy exclusion were not reachable from the real checkout route (e.g. a version that excluded
correctly in `getSoldCountsByTicketType` but the route used a different, stale count elsewhere),
this request would be rejected with a capacity error instead of the expected `201`. This is the
same "prove it through the real HTTP round trip, not source-reading" discipline
`contracts/checks/ticketing-hardening/_shared.mjs`'s own header documents was adopted after a
prior contract produced false greens from grep-only checks.

## Why A3 (paid-immune negative control) matters on its own

`stillHoldsSeat()`'s branch order — `status !== 'reserved' -> true` checked **before** expiry is
ever read — is the only thing standing between "abandoned reservations release correctly" and
"a paid buyer's seat gets silently resold because their order's `expiresAt` (set at reservation
time, before payment) is now in the past." `docs/ticketing-position-expiry-write.md` already
flags this branch order as load-bearing and warns against reordering it "for efficiency." A3
proves the guarantee holds against real Firestore and the real function, with an expiry 24 hours
stale — a scenario the shipped `ticketing-position-expiry-write` contract's own assertions never
directly cover (that contract proves reserved-and-expired releases; it does not separately prove
paid-and-expired does not).

## Why A4 avoids triggering a real alert email

Calling the real `POST /api/admin/reconcile-orders` with a valid bearer secret would send a real
Resend email to a human on every gate run — exactly the side-effect
`order-reconciliation`'s own goldens/README.md documents as deliberately excluded from any
automated check ("a re-runnable gate cannot depend on how many times it happens to run"). A4
instead proves the same "this cannot be the release mechanism" property structurally: grep-based
checks that the reconciliation code path never imports the status-flipping settle function and
never deletes/overwrites a `tickets/` position document directly. This is weaker in isolation
than a live HTTP proof, but it is checking a **negative** ("this code path cannot release a
seat") where the existing `order-reconciliation` contract's own A4 already independently proves,
against live Firestore, that `status`/`amount`/`gatewayPaymentId`/`purchasedAt` are unchanged
before and after a real `markOrdersAlerted` run — this contract does not need to re-duplicate
that live proof to also cover it.

## Cleanup

Both `.mjs` checks run inside `contracts/checks/ticketing-hardening/_shared.mjs`'s
`withCleanup()` wrapper, which sweeps every sentinel-marked `tickets`/`orders` document in a
`finally` regardless of outcome, and asserts zero residue survives. No new cleanup mechanism was
introduced — this reuses the existing crash-resilient manifest/lock/sweep infrastructure rather
than inventing a parallel one.

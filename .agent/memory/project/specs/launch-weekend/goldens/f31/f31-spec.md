# F31 - all six Ozow sandbox statuses, end to end (tickets and vendor stands)

Architect decision record. Normative data: `state-table.json` (checks read it). Closes the gap logged in
`contracts/golden/ozow-m1-f4/README.md` section 6. Money path: apex review recommended.

## What is true today (read from source, 2026-10-19)

- `lib/payments/ozow.ts` `mapStatus` knows Complete, Cancelled, Error. Abandoned, PendingInvestigation, Pending fall to `unknown`.
- Ticket handler (`lib/tickets-notification.ts`) runs: verify, order lookup, settled short-circuit, amount match, **confirmNotification**, mapStatus, paid write. `confirmNotification` only returns true when Ozow's own status API says `Complete`, so for every non-Complete notification the handler stops at step 8 with "Server confirmation failed" (misleading log, correct outcome). Nothing is written. The order stays `reserved` and the seat is released lazily by `stillHoldsSeat` once `expiresAt` (30 min, `RESERVATION_TTL_MINUTES`) passes. `paid` is never expired.
- Vendor handler runs mapStatus first; `paid` goes through the amount guard, `confirmNotification` once outside the transaction, then the paid write; `failed`/`cancelled` write a terminal status; anything else is logged and left `pending`. Every branch is gated by `attemptId`. A re-initiate overwrites the pending order with a fresh `attemptId`.
- Buyer pages: tickets redirect to `/tickets/confirmation` (ConfirmationPoller: "Confirming your payment" copy, then a 60 s "taking longer than expected, don't resubmit" copy) or `/tickets/cancelled` ("Payment cancelled, no payment was taken"). Vendors return to `/national-show/vendors/payment`, which today re-renders the payment form for any non-paid order.

## The two real defects F31 closes

1. **Pending can lose a seat that later gets paid.** A Pending or PendingInvestigation ticket order stays `reserved`, so its seat is released 30 minutes after checkout even though the payment may still complete (PendingInvestigation is a manual Ozow review and can take far longer). The later Complete would still mark it paid (paid ignores expiry) but the seat may already be resold. Fix: a hash-verified, amount-matched Pending notification extends the hold.
2. **A vendor can double-pay.** After Pending the vendor page shows the payment form again; re-initiating mints a new `attemptId`, so the first attempt's later Complete is rejected as superseded: money moved, order never settles. Fix: while a Pending marker is recent, refuse re-initiate and show the existing "still waiting for payment confirmation" copy.

## Decisions

### D1 mapping (`lib/payments/ozow.ts`, `lib/payments/types.ts`)
Strict, case-sensitive, untrimmed (existing discipline). Complete -> `paid`; Pending and PendingInvestigation -> `pending`; Cancelled -> `cancelled`; Error -> `failed`; Abandoned -> new `PaymentStatus` member `'abandoned'`; anything else -> `unknown`. Abandoned is NOT folded into `cancelled`: Ozow does not document it as terminal, a terminal vendor write would silently discard a later Complete, so the vendor path treats it as non-terminal. `confirmNotification` and `verifyNotification` are untouched. `payfast.ts` is untouched (its `PENDING -> pending` already exists; see Risks).

### D2 ticket handler (`lib/tickets-notification.ts`)
After the amount match and BEFORE `confirmNotification`, compute `mapStatus` once and branch:
- `paid`: continue exactly as today (confirm, then the paid write; the existing `status !== 'paid'` guard stays).
- `pending`: call new `markOrderPaymentPendingByPaymentId` (below). No confirm round trip: the action can only hold a seat longer, never mark paid, and is gated by the hash, the gateway match and the amount match. Log, acknowledge 200.
- `cancelled`, `failed`, `abandoned`, `unknown`: log reason with provider, reference, rawStatus and mapped status (replacing the misleading "Server confirmation failed" line), no write, no confirm call, acknowledge 200. Seat releases at the original TTL. Rationale: an immediate `cancelled` write would make a late Complete (possible for Abandoned) un-settleable; waiting out a 30 minute TTL costs one seat for 30 minutes and is exactly what PayFast does today.
Moving `mapStatus` ahead of confirm is a deliberate amendment of the "eleven steps" order; `paid` still requires confirm AND mapStatus. Re-pin the checks that assert the old order (`contracts/checks/payment-seam-f2/*`).

### D3 `lib/orders.ts` new writer
`markOrderPaymentPendingByPaymentId(input: { m_payment_id, rawStatus, now, orderId?, expectedGateway }, deps?: { db })` returns `{ committed: true, orderId, expiresAt } | { committed: false, reason }` with the same reason vocabulary as `markOrderAndPositionPaidByPaymentId`. One Firestore transaction, re-verifying inside it: m_payment_id match, gateway match, order `reserved`, positions exist. It accepts only rawStatus `Pending` or `PendingInvestigation`. It writes, on the order: `gatewayPending: { rawStatus, at: now }` and `expiresAt = max(current, now + PENDING_PAYMENT_HOLD_MINUTES)`; on EVERY position of the order: the same `expiresAt`. Status stays `reserved` everywhere. Never shortens an expiry. Idempotent: a repeat or PendingInvestigation-after-Pending only moves the marker and never lowers the expiry. If the order had already passed its TTL it is re-held (same accepted trade-off as "a payment after TTL still wins its seat"; the reconciliation cron alerts on any reserved-and-expired order, so a rare oversell is visible, not silent). `Order` in `types/index.ts` gains optional `gatewayPending`. No `undefined` own-properties may be written (firestore-undefined-write-safety).

### D4 hold window (`lib/payments/pending-hold.ts`, new)
Exports `PENDING_PAYMENT_HOLD_MINUTES = 4320` (72 h, Brad's call, see Decisions for Brad) and `isPendingPaymentHoldActive(marker, now = new Date()): boolean` (true iff `marker.at` is a Timestamp within the window; missing or malformed marker is false, so a bad document never locks a vendor out). When the window lapses the existing reconciliation cron alerts on tickets; vendors can simply retry.

### D5 vendor handler (`lib/vendor-stand-payment-notification.ts`)
After the unchanged guards (gateway, `status === 'pending'`, attemptId):
- `paid`: unchanged.
- `pending`: same amount guard as paid, no confirm call; one transaction re-verifying the same guards, then `update(standOrderRef, { gatewayPending: { rawStatus, attemptId, at } })`. Order stays `pending`. No emails, `paymentReceived` untouched.
- `failed`/`cancelled`: unchanged (terminal, `failedAt`).
- `abandoned` and `unknown`: log, no write (the existing else branch).
A later Complete for the same attempt settles through the unchanged paid path; duplicates no-op on `status !== 'pending'`; a Cancelled after paid is ignored.

### D6 vendor re-initiate and page (`initiate/route.ts`, `vendors/payment/page.tsx`)
`initiate`: after the existing already-paid 409, if the stored order is `pending` and `isPendingPaymentHoldActive(order.gatewayPending)`, return 409 and create nothing. The page reads the same marker and, when active, renders the pending notice instead of the payment form. Copy is the EXISTING ConfirmationPoller pair, reused verbatim: heading "Confirming your payment", body "We're still waiting for payment confirmation. Please don't refresh or submit payment again." No new strings.

### D7 buyer-facing outcome (no change to ticket pages)
Complete: confirmation page flips to the ticket (existing). Pending/PendingInvestigation: Ozow returns the buyer to the success URL, the poller shows "Confirming your payment", then the existing "taking longer than expected, do not resubmit, contact info@saoc.co.za" copy. Cancelled/Error: `/tickets/cancelled` ("No payment was taken" - existing; Error uses the same ErrorUrl). Abandoned: Ozow sends the buyer nowhere; they return manually, nothing changes. What Ozow redirects for each picker button is unverified; the live protocol records it.

### D8 emails
Only existing emails, only on Complete: ticket confirmation (once), vendor receipt and admin notice (once). Nothing is sent for the other five. Each has exactly one send site, kept that way by check A5.

## State table (tickets, then vendors)

| Ozow status | Maps to | Ticket order / positions | Seat | Email | Later ITN |
|---|---|---|---|---|---|
| Complete | paid | paid / paid | kept | ticket confirmation | duplicate no-ops (order not reserved) |
| Pending | pending | reserved / reserved + `gatewayPending` | held: expiry = max(current, now+72h) | none | Complete -> paid; Cancelled/Error/Abandoned -> no write, hold lapses at the extended expiry |
| PendingInvestigation | pending | same as Pending | same | none | same |
| Cancelled | cancelled | reserved / reserved, no write | released at original 30 min TTL | none | Complete (if it ever came) still settles |
| Error | failed | same | same | none | same |
| Abandoned | abandoned | same | same | none | same |

| Ozow status | Vendor stand order | Re-initiate | Email | Later ITN |
|---|---|---|---|---|
| Complete | paid, `paidAt`, submission `paymentReceived` | refused (already paid) | receipt + admin notice | duplicate no-ops |
| Pending / PendingInvestigation | pending + `gatewayPending` | refused for 72 h | none | Complete same attempt -> paid |
| Cancelled | cancelled + `failedAt` | allowed | none | terminal; later Complete ignored (existing rule) |
| Error | failed + `failedAt` | allowed | none | terminal |
| Abandoned | pending, no write | allowed | none | Complete same attempt -> paid |
| anything else | pending, no write | allowed | none | - |

## Decisions for Brad (recommendation first)

1. **Pending hold length.** Recommend 72 h (`PENDING_PAYMENT_HOLD_MINUTES = 4320`). Ozow does not publish a PendingInvestigation SLA. Alternative: 24 h (less seat lock-up, more reconciliation alerts) or longer. One constant to change.
2. **Vendor lockout while Pending.** Recommend blocking re-initiate for the hold window (prevents double payment, uses only existing copy). Alternative: allow retry and accept that a late first-attempt Complete needs manual reconciliation.

## NEEDS-COPY

None required. All buyer and vendor wording is existing copy reused verbatim. Optional, not built: a Pending-specific explanation ("your bank is still processing") would be new institutional-sounding copy and needs the orchestrator.

## Risks

- **PayFast sees the pending branch too.** The branch keys on provider-neutral `pending`; PayFast already maps `PENDING -> pending`. Previously a PayFast PENDING ITN was rejected at confirm with no write; now it holds the seat. That is the same correct behaviour but it is a PayFast behaviour change; `check-itn-behaviour-unchanged.sh` may need a re-pin for that single case. Alternative (rejected): gate on `provider.id === 'ozow'`, which hard-codes a gateway name into the shared handler.
- **Moving mapStatus before confirm** breaks the sequence pins in `contracts/checks/payment-seam-f2/`; re-pin deliberately, do not delete.
- **Unverified Ozow facts:** whether Abandoned can later become Complete, and which redirect URL each picker button uses. Both are recorded by the live protocol; if Ozow documents Abandoned as terminal the vendor mapping can tighten later (additive).
- **Double payment after the vendor window lapses** (a first-attempt Complete after 72 h) is rejected by the attemptId rule and logged; manual reconciliation. Accepted.
- Pending ITN delivered with a forged hash never reaches any of this (verifyNotification is the gate and is unchanged).

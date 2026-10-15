# F5 golden: vendor stand payment honours the Ozow Sandbox Test Mode toggle

Bug (P0, beta 2026-10-14, remaining blocker after F4): this Ozow sandbox merchant account rejects any
amount above R0.01 (docs/payment-seam.md ~L253; learned.md). Ticket checkout copes through the admin
Ozow Sandbox Test Mode toggle (docs/f1-ozow-sandbox-toggle.md): `isOzowSandboxTestModeEnabled`,
`resolveExpectedGatewayAmount`, `resolveOzowInitiateAmount` (lib/ozow-sandbox-test-mode.ts and
-shared.ts) and an `expectedGatewayAmount` stored on the order and compared by the notification
handler. The stand initiate route ignores all of it and sent `Amount 1160.00` on beta.

## Decision: reuse, do not invent

| Piece | Ticket path (reference) | Stand path (F5) |
|---|---|---|
| Flag read | `isOzowSandboxTestModeEnabled()` once, before the reservation transaction | same, once, before the initiate transaction, after the gateway is resolved |
| Expected amount | `resolveExpectedGatewayAmount(providerId, flag)`: `0.01` only for `ozow` + flag on, else `null` | same call with `activeGateway`; stored on the `vendorStandOrders` doc as `expectedGatewayAmount` (`null` when not test mode, never `undefined`) |
| Amount sent | `resolveOzowInitiateAmount(expectedGatewayAmount, real.toFixed(2))` from the STORED expectation | same, so the amount sent and the amount stored cannot disagree |
| Order `amount` | real price, untouched | real price, untouched (receipts, admin, reconciliation) |
| Notification compare | `notificationAmountMatches`: `expectedGatewayAmount ?? amount` in cents | new pure helper `vendorStandOrderAmountMatches` with the same rule, used in BOTH amount guards (pre-read and in-transaction) |
| Banner | `OzowSandboxTestModeBanner` in `TicketPurchaseForm` | same component in `VendorStandPaymentForm` |

PayFast is unaffected: `resolveExpectedGatewayAmount('payfast', true)` is `null`, so amount, stored field and
guards behave exactly as before. Pre-existing stand orders have no `expectedGatewayAmount`; `??` falls back to `amount`.

The response `amount` (shown to the vendor) stays the real price, as the ticket flow shows the real price.
Banner text is the existing constant: `TEST MODE — Ozow charges R0.01 instead of the displayed price`.
No new copy, collection, route, env var or setting.

## Files @dev touches

New (pure, relative imports only, loadable by plain node): `lib/vendor-stand-order-amount.ts` exporting
`vendorStandOrderAmountMatches(order: { amount?: unknown; expectedGatewayAmount?: unknown }, grossAmountCents: number | null): boolean`.
Rule: `expected = order.expectedGatewayAmount ?? order.amount`; false if gross is null or expected is not a finite number;
true iff `Math.round(expected * 100) === grossAmountCents`. See amount-match-matrix.json.

Edited:
- `app/api/vendors/stand-payment/initiate/route.ts`: import the three helpers from `@/lib/ozow-sandbox-test-mode`; read the flag once
  (before `db.runTransaction`); compute `expectedGatewayAmount`; add `expectedGatewayAmount` to the order `.set()`; pass
  `amountFormatted: resolveOzowInitiateAmount(expectedGatewayAmount, amount.toFixed(2))` to `paymentProvider.initiate`.
  Keep `amount: amount.toFixed(2)` in the JSON response (real price). No other reordering.
- `lib/vendor-stand-payment-notification.ts`: both amount guards (pre-read ~L240 and in-transaction ~L300) use
  `vendorStandOrderAmountMatches`. The `amount` passed to the receipt and admin notice stays `order.amount` (real). `StandOrder` type gains
  `expectedGatewayAmount?: number | null`. Nothing else moves (confirm-once ordering, attempt-id guard, idempotency).
- `components/vendors/VendorStandPaymentForm.tsx`: import and render `<OzowSandboxTestModeBanner />` from
  `@/components/tickets/OzowSandboxTestModeBanner`, placed like the ticket form places it (above the form body). No new string.

## Must NOT change (diff against base a42694dc)
`lib/ozow-sandbox-test-mode.ts`, `lib/ozow-sandbox-test-mode-shared.ts`, `components/tickets/OzowSandboxTestModeBanner.tsx`,
`lib/tickets-notification.ts`, `lib/orders.ts`, `lib/checkout-reservation.ts`, `app/api/tickets/checkout/route.ts`,
`lib/payments/payfast.ts`, `lib/vendor-stand-orders.ts`, `lib/vendor-stand-payment-token.ts`.

## Security properties
1. A test-mode order only accepts the R0.01 notification; a real-amount notification for it is rejected BEFORE confirm (no gateway round trip).
2. A normal order only accepts its real amount; a one-cent notification is rejected. The fraud guard is not weakened for any order without a flag.
3. The flag is read once and the stored expectation drives both what is sent and what is accepted, so a toggle between read and send cannot split them.
4. Flag read fails closed (`false`) on any error; PayFast cannot enter test mode.
5. Both guards (pre-read and transactional re-check) use the same helper, so a race cannot slip a mismatched amount through.
6. Receipts and admin notices keep the real price.

## Known limitation
The banner shows whenever the global flag is on, even if PayFast is the active gateway (same behaviour as the ticket form).
The stored `expectedGatewayAmount` is what governs money, not the banner.

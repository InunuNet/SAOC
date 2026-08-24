# Payment Gateway Selection — Admin-Only Setting

**Feature:** Mission `gateway-picker-admin-only`, feature F1. See
[`contracts/golden/gateway-picker-admin-only-f1/README.md`](../contracts/golden/gateway-picker-admin-only-f1/README.md)
for the full decision record.

## Overview

Payment gateway selection was previously a **customer-facing radio picker** on the ticket checkout page ("Pay with: Ozow / PayFast"). This has been moved to an **admin-only setting** in `/admin/settings`, accessible only to admins with the `manage-payment-settings` capability. Customers no longer see a gateway choice — the active gateway is selected once by an admin and checkout silently uses it.

Both gateways (Ozow and PayFast) are equally production-integrated; this change reflects that gateway selection is an operational decision, not a customer choice.

## Firestore Storage

**Collection:** `adminSettings`  
**Document ID:** `activePaymentGateway`  
**Shape:**

```typescript
{
  gateway: 'ozow' | 'payfast';
  updatedAt: Timestamp; // server-set at write time
  updatedByEmail: string | null; // email of the admin who set it
}
```

This is a sibling document to `adminSettings/ozowSandboxTestMode` (from mission `ozow-sandbox-toggle`). Both settings are independent — sandbox test mode and active gateway are separate axes, and an admin can sandbox-test whichever gateway is active.

## Fail-Closed Behavior

`POST /api/tickets/checkout` **refuses the charge with HTTP 500** if the `activePaymentGateway` setting is missing, invalid, or inaccessible:

```json
{
  "error": "Payment gateway is not configured. Please try again later."
}
```

The route does **not** default to a specific gateway (`'ozow'`, `'payfast'`, or any other value). An admin who has not yet explicitly set the flag has not yet decided which gateway should be live — guessing would bake a business decision into code, silently. Refusing is consistent with the route's own established fail-closed posture for gateway credential checks (`gatewayReadiness.ready` below).

**Operational precondition:** the `activePaymentGateway` doc must be written **at least once** (by an admin via `/admin/settings`) before checkout can process any ticket order. This is the same precondition ticket sales already has via `nationalShow.salesOpen`.

## Reading the Active Gateway

The `lib/payments/active-gateway.ts` module provides:

```typescript
export async function resolveActiveGateway(deps?: {
  db?: Pick<Firestore, 'collection'>;
}): Promise<GatewayId | null>;
```

Returns:
- The gateway ID (`'ozow'` | `'payfast'`) if the `adminSettings/activePaymentGateway` doc exists and `gateway` is valid.
- `null` for any error: missing doc, missing/invalid `gateway` field, or a thrown Firestore read. **Never throws, never guesses.**

The checkout route calls this once, at request time, strictly before any Firestore write (same position the old client-supplied `providerId` validation occupied). On `null`, the route refuses with the error above.

## Admin Interface

Navigate to `/admin/settings` (requires Firebase Auth + `admin: true` custom claim + email in `ADMIN_EMAIL_ALLOWLIST`). The page displays a radio group:

```
Active payment gateway: (O) Ozow  ( ) PayFast
```

Changing the selection:

1. Fires a `PUT /api/admin/settings/active-payment-gateway` with body `{ gateway: 'ozow' | 'payfast' }`.
2. The route checks the `manage-payment-settings` capability (same gate as the Ozow sandbox test-mode toggle; see `docs/admin-access.md` § "Capability Checks").
3. On success, writes the new gateway to `adminSettings/activePaymentGateway` with server-set `updatedAt` timestamp and the admin's email in `updatedByEmail`.
4. Returns `{ gateway }` and the UI reflects the change immediately.

**Capability requirement:** `manage-payment-settings` (same as `ozow-sandbox-test-mode`). This is a risk class that touches real payment processing; see `lib/admin-roles.ts` for which roles (and `/admin/door` capability-scoped grants) hold this capability.

## Replay and Idempotency

When a customer submits a checkout request, the route stores the active gateway in the order's `gateway` field. On a retry (browser back-button, network timeout), the route uses `replayGatewayMatches()` to enforce that the stored order's gateway still matches the current active gateway setting:

- **Match:** retry succeeds, order proceeds to payment.
- **Mismatch (e.g., admin switched gateways between the customer's first attempt and their retry):** checkout returns HTTP 409 with error `'key-provider-mismatch'`. The customer's original order is unchanged; they must start a new checkout session, which will use the newly-active gateway.

This is the same replay guard that already existed when the gateway was client-supplied — it now compares against the server-resolved gateway instead.

## Request/Response Shape

**Before F1:** POST body included `providerId: unknown`.

**After F1:** POST body is `{ showId, lineItems }` — no `providerId` field. Checkout response still echoes `providerId` for display (e.g., in the `CheckoutRedirectNotice` "paying via {providerLabel}" copy) — this is a server-derived value from the active gateway setting, not a customer choice.

If a client sends a `providerId` field in the POST body (e.g., from a stale cached bundle), it is ignored — the server-resolved gateway takes precedence, always.

## Out of Scope

- `lib/payments/index.ts` (`paymentProviders`, `resolveProvider`) — unchanged. The gateway registry concept is still correct; only *who supplies the ID* changes (server, not client).
- `lib/payments-ui.ts` (`providerLabel`) — unchanged, still used for post-submit display.
- `lib/payments/payfast.ts`, `lib/payments/ozow.ts` — unchanged.
- Sandbox test mode toggle (`lib/ozow-sandbox-test-mode*.ts`) — independent, unchanged.
- Ticket type / quantity / attendee / day-selection UI and logic — unchanged.

## References

- **Contracts:** [`contracts/golden/gateway-picker-admin-only-f1/README.md`](../contracts/golden/gateway-picker-admin-only-f1/README.md)
- **Admin auth:** [`docs/admin-access.md`](admin-access.md) § "Capability Checks (F4)"
- **Sandbox test mode:** [`docs/ozow-sandbox-test-mode.md`](../contracts/golden/ozow-sandbox-toggle-f1/README.md) (similar admin-only setting pattern)

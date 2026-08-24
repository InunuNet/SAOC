# gateway-picker-admin-only F1 — decision record

Mission: `.agent/memory/project/missions/2026-08-24-gateway-picker-admin-only.md`, feature F1.

## 1. What exists today (baseline, from ozow-payment-provider F2)

Gateway selection is currently a customer-facing radio picker:

- `components/tickets/ProviderChoice.tsx` renders "Pay with: Ozow / PayFast" radio buttons.
- `components/tickets/useTicketCart.ts` holds `providerId` state (`DEFAULT_PROVIDER_ID = 'ozow'`)
  and sends it as `providerId` in the `POST /api/tickets/checkout` body.
- `app/api/tickets/checkout/route.ts` reads `body.providerId`, validates it against
  `KNOWN_PROVIDER_IDS = ['payfast', 'ozow']` via `isValidProviderId()`, and resolves it through
  `resolveProvider()` (`lib/payments/index.ts`) to get the `PaymentProvider` to call.

Both gateways are equally production-integrated: `lib/payments/payfast.ts` and
`lib/payments/ozow.ts` each implement the same `PaymentProvider` interface, including a
`readiness('initiate')` credential probe the route already calls and fails closed on. Neither is
"the untested one" — this is a business decision about which gateway SAOC currently wants live,
not a maturity gap between them.

## 2. Storage: reuse the `adminSettings` collection, new sibling doc

**Decision:** a new Firestore document at `adminSettings/activePaymentGateway`, shape:

```
{ gateway: 'ozow' | 'payfast', updatedAt: Timestamp, updatedByEmail: string | null }
```

This is the exact mechanism `ozow-sandbox-toggle` F1 already established
(`contracts/golden/ozow-sandbox-toggle-f1/README.md` §1): a single small `adminSettings`
collection, one doc per named setting, each written through an `/api/admin/*` route gated by
`lib/admin-auth.ts`. That README explicitly anticipated "room for future settings" in this same
collection — this feature is that anticipated case, not a reason to invent a second settings
mechanism. `activePaymentGateway` is a sibling doc to `ozowSandboxTestMode`, not a field bolted
onto it: sandbox-test-mode and active-gateway are independent axes (you can sandbox-test whichever
gateway is active) and conflating them into one doc would couple two unrelated toggles.

New file `lib/payments/active-gateway.ts` owns this doc's constants and the two functions below,
following the same fail-closed, deps-injectable, never-throws shape as
`lib/ozow-sandbox-test-mode.ts`'s `isOzowSandboxTestModeEnabled()`. No client-safe/server split is
needed here (unlike the sandbox toggle's `-shared.ts` split): nothing under `'use client'` needs
these constants directly — the admin settings page talks to its own API route, and the checkout
UI no longer needs to know the gateway ahead of time at all (see §4).

```ts
export const ACTIVE_GATEWAY_COLLECTION = 'adminSettings';
export const ACTIVE_GATEWAY_DOC_ID = 'activePaymentGateway';
export const GATEWAY_IDS = ['ozow', 'payfast'] as const;
export type GatewayId = (typeof GATEWAY_IDS)[number];

export function isValidGatewayId(value: unknown): value is GatewayId {
  return typeof value === 'string' && (GATEWAY_IDS as readonly string[]).includes(value);
}

// Fail-closed: returns null on missing doc, missing/non-string/unrecognised `gateway` field,
// or a thrown Firestore read — never throws, never guesses. Never returns a value outside
// GATEWAY_IDS. `deps` is injectable for offline testing, same convention as
// isOzowSandboxTestModeEnabled.
export async function resolveActiveGateway(deps?: {
  db?: Pick<Firestore, 'collection'>;
}): Promise<GatewayId | null> { /* ... */ }
```

## 3. Fail-closed behaviour: refuse the charge, do not guess a gateway

**Decision:** when `resolveActiveGateway()` returns `null` (doc missing, field missing/invalid,
or a read error), `POST /api/tickets/checkout` refuses the request with the SAME response shape
the route already uses for "gateway not configured" — `{ error: 'Payment gateway is not
configured. Please try again later.' }`, status 500 — and returns before any Firestore write
(same textual position `isValidProviderId(body.providerId)` occupies today, i.e. immediately
after `parseLineItems`, strictly before the `if (!client)` CMS guard).

**Why refuse rather than default to a specific gateway ('ozow', matching the current UI's
`DEFAULT_PROVIDER_ID'):** picking either gateway as "the" fallback bakes a business decision
(which processor gets today's transactions) into code, silently, the exact thing this mission
exists to move OUT of code/customer-facing UI and INTO an explicit admin action. An admin who has
not yet set the flag has not yet decided which gateway should be live — proceeding anyway is a
guess, not a safe default, regardless of which of the two equally-integrated gateways is guessed.
Refusing is also consistent with this route's own established posture: the existing
`gatewayReadiness.ready` check right below already treats "can't confirm this is safe" as REFUSE,
never "assume fine" (see that check's own comment, route.ts ~line 670). The admin setting doc
must be written at least once (a one-time `PUT` from `/admin/settings`) before checkout can
process any order — the same operational precondition ticket sales already has via
`nationalShow.salesOpen`.

## 4. Checkout route change: server resolves the gateway, client input is not read at all

**Decision:** `CheckoutRequestBody` drops the `providerId: unknown` field entirely.
`isValidProviderId` / `KNOWN_PROVIDER_IDS` are deleted, not repurposed. The route calls
`resolveActiveGateway()` once, in the position described in §3, and uses its result (or refuses)
for everything downstream that previously used `providerId`/`body.providerId`: the
`paymentProvider` lookup, the `gateway` field written onto the order (still via
`replayGatewayMatches` — unchanged, since the STORED order.gateway must still win over a later
re-resolution the same way it won over a client-supplied value before), `NOTIFY_PATH_BY_PROVIDER_ID`
lookup, `resolveExpectedGatewayAmount(...)`, and the JSON response's echoed `providerId` field
(kept — the client still needs to know which gateway it's being redirected to, to render
`CheckoutRedirectNotice`'s "via {providerLabel}" copy and pick the right redirect form; this is a
server-derived echo for display, not a customer choice, same distinction the route already draws
for `amount`).

If a client still sends a `providerId` field in the POST body (e.g. a stale cached bundle, a
manual `curl`), it is not parsed into `CheckoutRequestBody` and has zero effect on which gateway
is called — this is what "not read at all" means, not "read and then re-validated against the
admin setting."

## 5. UI change: picker removed, nothing else in checkout touched

**Decision:** `components/tickets/ProviderChoice.tsx` is deleted. `TicketPurchaseForm.tsx` drops
its `<ProviderChoice .../>` render and its `providerLabel(cart.providerId)` submit-button copy
(the button falls back to the plain `buyButtonLabel` while submitting — no gateway name needs to
appear pre-submit, since the customer never chose one). `useTicketCart.ts` drops `providerId`
state, `setProviderId`, and `DEFAULT_PROVIDER_ID`, and the POST body becomes
`{ showId, lineItems }` — no `providerId` key. `CheckoutRedirectNotice.tsx` and `providerLabel`
(`lib/payments-ui.ts`) are UNCHANGED: they still render the SERVER-RETURNED `providerId` from the
checkout response, post-submit, which is display, not a customer choice, and out of this
feature's scope. Ticket type selection, quantities, attendee fields, and the day picker are
untouched.

## 6. Admin UI: extend the existing `/admin/settings` page, no new capability

**Decision:** `app/admin/settings/page.tsx` gains a second control (radio group, "Active payment
gateway: Ozow / PayFast") alongside the existing sandbox-test-mode checkbox, in the same
`AdminSettingsLayout`-gated page — no new route, no new capability. New API route
`app/api/admin/settings/active-payment-gateway/route.ts` (GET/PUT) reuses the SAME
`'manage-payment-settings'` capability the sandbox toggle route already checks (`checkGate()`
pattern: `getAdminSession()` → `hasCapability(..., 'manage-payment-settings', ...)`, byte-identical
shape to `app/api/admin/settings/ozow-sandbox-test-mode/route.ts`). This is the same risk class as
the sandbox toggle (misconfiguring either one changes what a real payment gateway does with real
money) — there is no reason for a different, narrower or wider, gate. `PUT` rejects any body where
`gateway` is not `isValidGatewayId(...)` with 400, and writes
`{ gateway, updatedAt: FieldValue.serverTimestamp(), updatedByEmail: email }` to
`adminSettings/activePaymentGateway`.

## 7. Explicitly out of scope

- `lib/payments/index.ts` (`paymentProviders`, `resolveProvider`) — unchanged. The registry
  concept is still correct; only WHO supplies the id changes.
- `lib/payments-ui.ts` (`providerLabel`) — unchanged, still used for the post-submit display.
- `lib/payments/payfast.ts`, `lib/payments/ozow.ts` — unchanged.
- `lib/ozow-sandbox-test-mode*.ts` — unchanged; sandbox-test-mode remains an independent axis
  from which gateway is active.
- Ticket type / quantity / attendee / day-selection UI and logic — unchanged.
- `replayGatewayMatches` — unchanged in behaviour; still compares the stored order's `gateway`
  against the (now server-resolved, not client-supplied) gateway for the current request.

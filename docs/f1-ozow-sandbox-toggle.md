# F1: Ozow Sandbox Test Mode — Fixed-Amount Override

**Feature:** F1 of mission `ozow-sandbox-toggle` (milestone M1). Admin-controlled toggle that forces the amount sent to Ozow's payment `initiate()` call to R0.01 for testing, while preserving the real ticket price in order records and all reconciliation systems.

**Contract:** `contracts/ozow-sandbox-toggle-f1.yaml` — assertions A1–A12. **Golden record:** `contracts/golden/ozow-sandbox-toggle-f1/README.md` — the full design record and all four fix rounds (§1–§3e). **This doc is the user/operator guide; that is the specification.**

**Status:** Gated 12/12, QA-passed (×2), Codex cross-model-passed (×4 reviews, 4 bugs found and fixed).

---

## What This Feature Does

**One admin-controlled Firestore flag, `adminSettings/ozowSandboxTestMode.enabled`:**

- **When OFF (the default):** Ozow transactions work normally. Buyers pay the real ticket price.
- **When ON:** Only the amount sent to Ozow's own `initiate()` API call is forced to R0.01. Everything else — the cart total shown to the buyer, the `order.amount` stored in Firestore, the buyer's receipt, and PayFast transactions — is **completely unaffected**. Real prices are preserved for reconciliation and refunds.

The flag fails closed on any Firestore read error or ambiguous value: missing document, missing field, wrong type, or network failure all read as OFF. There is no code path that says "yes" except the literal boolean `true`.

---

## For Operators: How to Turn It On/Off

Visit `/admin/settings` (login required, owner-only access):

1. Find the **"Ozow Sandbox Test Mode"** checkbox.
2. Tick it to enable; untick to disable.
3. The change takes effect immediately on next Ozow checkout.

The checkout page displays a visible **"TEST MODE — Ozow charges R0.01 instead of the displayed price"** banner whenever the flag is on, so you know mode is active.

---

## Invariants This Feature Guarantees

1. **PayFast is never affected.** Even if the flag is on, PayFast checkouts always receive and charge the real price.
2. **OFF by default, fails closed.** If Firestore is unreachable or the flag is misconfigured, it reads as OFF and checkout proceeds normally.
3. **Order.amount always records the real price.** No matter what the flag state, `order.amount` in Firestore always holds the actual ticket price. Refunds, reconciliation, and future audit trails read the truth.
4. **The notification handler knows what was charged.** When Ozow sends the ITN webhook reporting R0.01 was charged, the notification validation compares against the stored `expectedGatewayAmount` (R0.01), not the real `order.amount` — so legitimate test-mode payments are accepted, while fraud-prevention guards are unchanged for normal purchases.
5. **Replays use the original order's expectation.** A checkout replayed with the same idempotency key (browser back-button, network retry, or flag toggled mid-demo between original and retry) uses the ORIGINAL order's stored `expectedGatewayAmount`, never re-reads the current flag state. This prevents the initiate() amount and the order's expectation from disagreeing.

---

## Technical Details: The `expectedGatewayAmount` Mechanism

**For future developers and auditors:**

When a checkout succeeds, the order document gains an optional field `expectedGatewayAmount: number | null`:

- **`null`** (the default) — "this order's gateway expectation is just `order.amount`, unchanged." Covers PayFast and Ozow with the flag off.
- **`0.01`** — "this order was created while Ozow test mode was on; the gateway was told to expect R0.01, not the real price."

The notification handler's amount-match comparison (step 7 of the 11-step ITN sequence in `lib/tickets-notification.ts`) uses the stored `expectedGatewayAmount` if present, falling back to `order.amount` otherwise. This comparison is wrapped in an exported pure function, `notificationAmountMatches()`, testable offline without a live Firestore transaction.

**Why separate fields:** `order.amount` must always be the truth for reconciliation and refunds — never touched by the override. `expectedGatewayAmount` records what *we told the gateway*, separately, so mismatches between what we said and what the gateway reports are detected and acted on, whether that mismatch is fraud or a legitimate test-mode payment. The two values being different is not a bug — it's the entire point.

---

## What This Feature Does NOT Do

- **Adjust any price displayed to the buyer.** The cart, checkout page, and receipt all show the real amount.
- **Affect PayFast or any other gateway.** Only Ozow's `initiate()` call is overridden.
- **Validate the chosen day or attendee names.** Those are F5's concern; this is payment-seam-only.
- **Implement per-day or per-type capacity counting.** Capacity checks are unchanged.
- **Create a second independent notification handler or amount-match logic.** Both PayFast and Ozow use the same notification handler; only the amount-match comparison target changes.

---

## Files Changed

- `lib/ozow-sandbox-test-mode-shared.ts` (new) — pure, client-safe exports: `OZOW_SANDBOX_TEST_MODE_BANNER_TEXT`, `resolveOzowInitiateAmount()`, `resolveExpectedGatewayAmount()`, and collection/doc-id constants. Zero server-only imports, safe for 'use client' components to import.
- `lib/ozow-sandbox-test-mode.ts` (new) — server-side only: `isOzowSandboxTestModeEnabled()` (reads Firestore, fails closed). Re-exports the shared module so server routes keep one import path.
- `app/api/admin/settings/ozow-sandbox-test-mode/route.ts` (new) — GET/PUT admin routes, owner-only, gated by `'manage-payment-settings'` capability.
- `app/api/tickets/ozow-sandbox-test-mode/route.ts` (new) — public GET status route (unauthenticated), used by the checkout page to decide whether to show the banner. Fails closed to `{ enabled: false }` on any Firestore error.
- `components/tickets/OzowSandboxTestModeBanner.tsx` (new) — banner component, polls the public status route, imports `OZOW_SANDBOX_TEST_MODE_BANNER_TEXT` from `-shared` module.
- `app/api/tickets/checkout/route.ts` — wires the override into the Ozow `initiate()` call via `resolveOzowInitiateAmount()`, threads `expectedGatewayAmount` through the reservation so it's written to the order document.
- `lib/checkout-reservation.ts` — `buildMultiReservationDocs()` writes `expectedGatewayAmount` to the order.
- `lib/orders.ts` — `findReservedOrderByPaymentId()` reads `expectedGatewayAmount` off the order document, defaulting to `null` for pre-existing orders.
- `lib/tickets-notification.ts` — amount-match comparison (step 7) now reads `lookup.expectedGatewayAmount ?? lookup.amount` instead of `lookup.amount` unconditionally. Extracted into an exported pure function `notificationAmountMatches()` for offline testing.
- `types/index.ts` — `Order` gains optional `expectedGatewayAmount?: number | null`.
- `lib/admin-roles.ts` — adds `'manage-payment-settings'` to the `CAPABILITIES` array (owner inherits automatically; manager does not hand-listed).

---

## Sources

- `contracts/ozow-sandbox-toggle-f1.yaml` — the contract assertions (A1–A12).
- `contracts/golden/ozow-sandbox-toggle-f1/README.md` — decision record covering storage mechanism choice (Firestore doc vs env var), fail-closed contract, amount-override seam, admin surface, the `expectedGatewayAmount` mechanism, replay handling, and the client/server module split.
- `docs/payment-seam.md` — how this feature fits into the broader payment gateway abstraction; context for why separate fields (`order.amount` vs `expectedGatewayAmount`) are load-bearing.

All three are normative. The golden record is the authority on design rationale; this guide is how to use it.

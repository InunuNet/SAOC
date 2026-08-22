# Payment provider seam — `lib/payments/`

**Code:** [`lib/payments/types.ts`](../lib/payments/types.ts) (the neutral interface),
[`lib/payments/payfast.ts`](../lib/payments/payfast.ts) (the PayFast adapter),
[`lib/payments/index.ts`](../lib/payments/index.ts) (the single selection point).
**Contracts:** [`contract-payment-seam-f1.yaml`](../contracts/contract-payment-seam-f1.yaml)
(12 assertions — the seam itself) and
[`contract-payment-seam-f2.yaml`](../contracts/contract-payment-seam-f2.yaml)
(7 assertions — the route rewiring), mission `payment-provider-seam`.
**Goldens:** [`interface.golden.md`](../contracts/golden/payment-seam-f1/interface.golden.md) —
normative; [`fail-closed-guards.golden.md`](../contracts/golden/payment-seam-f1/fail-closed-guards.golden.md);
[`payfast-wire.golden.json`](../contracts/golden/payment-seam-f1/payfast-wire.golden.json);
architect's decision records for [F1](../contracts/golden/payment-seam-f1/README.md) and
[F2](../contracts/golden/payment-seam-f2/README.md).

## Status — read this before using anything below

**F1 (the seam) and F2 (the route rewiring) are both code-complete.** Both ticket routes now
depend only on `PaymentProvider`; neither contains a PayFast symbol, env var name, URL or field
name.

**Neither the live sandbox purchase (F3) nor the Codex cross-model review (F4) has been re-run
against the rewired code at the time of writing (2026-08-19.)** A green contract gate has never
been sufficient evidence on this subsystem, and is not here either: every F1 check is offline, and
F2's strongest check exercises the notification half only. Do not read this document as proof that
a purchase still completes end to end.

Everything below describes code that has been read, not planned.

This document does not repeat the PayFast wire format — see
[docs/payfast-integration.md](payfast-integration.md) and
[docs/payfast-itn-signature.md](payfast-itn-signature.md) — nor the ticketing flow
([docs/ticketing.md](ticketing.md)) or the security fixes underneath it
([docs/ticketing-hardening.md](ticketing-hardening.md)).

---

## Why the seam exists

Three gateways are in prospect: PayFast (in use today, sandbox), Ozow (the council's stated
preference) and Peach (Brad's own site). All three are the same shape — redirect the buyer to a
hosted payment page, then receive an asynchronous server-to-server notification. The interface is
drawn against all three published APIs rather than generalised from the one we happen to have, so
that the second integration *implements* the interface instead of reopening it.

This is **not** packaging. There is no workspace package, no host adapters, no plugin registry.
Packaging is explicitly deferred until SAOC works (Brad, 2026-08-19, on timeline grounds) —
see [Adding a second gateway](#adding-a-second-gateway).

---

## The interface

`PaymentProvider` ([`lib/payments/types.ts:111-122`](../lib/payments/types.ts)) has six members.

| Member | Signature | What it is for |
|---|---|---|
| `id` | `readonly string` | The adapter's own name (`'payfast'`), for logging and diagnostics. |
| `readiness` | `(ProviderOperation) => ProviderReadiness` | Query synchronously whether a given operation is configured right now. Never a promise — a forgotten await would return truthy and fail open. |
| `initiate` | `(InitiateInput) => Promise<InitiateResult>` | Turn our order into a hosted-page hand-off: the URL to post to, the method, and the signed fields — or a refusal if the gateway is not configured. |
| `verifyNotification` | `(NotificationRequestLike) => Promise<VerifyNotificationResult>` | Authenticate an inbound webhook body and extract the facts from it. Returns `{ verified: true, notification }` or a typed refusal reason. |
| `confirmNotification` | `(ProviderNotification) => Promise<ConfirmResult>` | The out-of-band, server-to-server re-check of a notification the gateway already sent us. |
| `mapStatus` | `(string \| null) => PaymentStatus` | Translate the gateway's own status vocabulary into `'paid' \| 'pending' \| 'failed' \| 'cancelled' \| 'unknown'`. Synchronous. |
| `refund` | `(RefundInput) => Promise<RefundResult>` | Reverse a payment, *or* declare honestly that this adapter cannot. |

`PaymentStatus` is deliberately not any gateway's vocabulary. `'COMPLETE'` is not assignable to it —
A11 proves that at the type level.

### Why five members and not four

The mission brief named four (`initiate`, `verifyNotification`, `mapStatus`, `refund`).
`confirmNotification` was added by the architect for one specific reason:

**Today's ITN route performs PayFast's server-confirm round-trip at step 8 of an 11-step sequence
— after the amount check and after the already-settled short-circuit — not as part of signature
verification, which is step 2.** Folding the confirm into `verifyNotification` would move a network
call earlier in a security sequence *and* fire it on notifications the current code never confirms
at all. F1 forbids behaviour change, so the seam has to be able to express that ordering, and a
four-member interface cannot.

This is not PayFast leaking into a neutral interface. All three target gateways have the same
out-of-band step: PayFast's `/eng/query/validate` postback, Ozow's transaction-status query, and
Peach's `resourcePath` GET — which is Peach's **primary** status source rather than a
belt-and-braces confirmation. A provider without one is not a case worth designing around, so the
member is required rather than optional: an adapter with no such step returns `{ confirmed: true }`
explicitly, with a comment saying why, instead of the interface making fail-open the default.

The eleven-step sequence, with each step marked provider-owned or ours, is tabulated in
[`fail-closed-guards.golden.md`](../contracts/golden/payment-seam-f1/fail-closed-guards.golden.md)
under "ITN — the full validation sequence, in order".

---

## What an adapter must implement

Beyond satisfying the type, an adapter owes the following. The non-obvious ones are first, because
they are the ones a reasonable implementer gets wrong.

### Config is read per call, never captured at construction

Firebase App Hosting supplies secrets with **runtime** availability only. A factory that snapshots
`process.env` at module load would refuse every real purchase in production while passing every
offline test that sets env before importing — a failure mode that is invisible until it is live.

`createPayfastProvider` therefore stores accessors, not values
([`lib/payments/payfast.ts:112-117`](../lib/payments/payfast.ts)): `readEnv()`, `readFetch()` and
`readTrustedIps()` are each called inside the request path. This is the same constraint that makes
`resolveSiteUrl()` a function rather than a module-scope const in the checkout route.

A4 case 5 is the only assertion that catches a violation, and it catches it by calling **one
provider instance twice against a mutated env object**, requiring it to refuse and then succeed.

### The provider never compares amounts

`ProviderNotification.grossAmount` is the gateway's amount **exactly as sent — an unparsed string**
([`types.ts:48-51`](../lib/payments/types.ts)). The provider has no access to our order and no
business deciding whether an amount is acceptable. It reports what the gateway said; the route
compares it against the amount it read from Firestore, within `AMOUNT_MATCH_TOLERANCE_CENTS = 1`
([`app/api/tickets/itn/route.ts:34`](../app/api/tickets/itn/route.ts)) — integer cents, not
floating point, because `Math.abs(Number('0.02') - 0.03)` evaluates to `0.009999999999999998`,
so a float-based subtraction rejected a one-cent underpayment.

The same reasoning keeps the order lookup, the idempotency short-circuit, the transactional write
and the confirmation email out of the seam entirely. **The provider returns facts; the route makes
decisions.**

### Amount parsing moved into the adapter

`parseAmountToCents` ([`lib/payments/payfast.ts:165-174`](../lib/payments/payfast.ts)) translates
the gateway's decimal-string wire format (e.g. `"150.00"`) into integer cents. It was moved into
the adapter because translating a provider's own data format is **format translation** — the same
category as `mapStatus` translating status vocabulary — and belongs with the other gateway-specific
conversions, not in the route.

`ProviderNotification` ([`lib/payments/types.ts:45-63`](../lib/payments/types.ts)) now carries
`grossAmountCents: number | null` — the parsed result — so the route reads this pre-converted
field rather than parsing itself. A `null` value means the raw string could not be parsed (not a
valid ZAR amount), and is treated as a refusal: the route rejects it at the amount-match check
(line 148–151 of `itn/route.ts`) before any Firestore write. This is fail-closed: an unparseable
amount that the provider cannot handle becomes an unparseable amount the route cannot accept.

The distinction matters: **the provider reports facts (what string the gateway sent, what number it
parsed to); the route makes acceptability decisions (whether that number is close enough to our
stored amount).** Nothing in the adapter decides whether an amount is acceptable — it only computes
cents. The route decides.

### Fail closed by return value, never by throwing

Every refusal is a discriminated union arm with a typed `reason`, not an exception:
`InitiateResult` → `{ ok: false, reason: 'not-configured' }`; `VerifyNotificationResult` →
`'not-configured' | 'missing-signature' | 'signature-mismatch' | 'missing-reference'`;
`ConfirmResult` → `'not-valid' | 'request-failed' | 'not-configured'`.

A refusal must carry **nothing a caller could mistake for a success**: no fields, no `processUrl`,
no partial result. Empty string counts as missing, exactly like unset (`!merchantId`, not
`merchantId === undefined`). A4 asserts all of this.

A thrown or rejected network call becomes `{ confirmed: false, reason: 'request-failed' }` and is
never rethrown ([`payfast.ts:235-241`](../lib/payments/payfast.ts)) — A6 case 5.

### `refund` may be declared-unsupported, but must not throw and must make no network call

There is no refund code anywhere in this repository — grepped across `app/` and `lib/` on
2026-08-19; the only hits are marketing copy on `/refunds`. F1 is a pure move and a pure move
cannot move what does not exist, so the PayFast adapter ships the *signature only*:
`{ ok: false, reason: 'not-supported' }`, no `fetch`
([`payfast.ts:261-266`](../lib/payments/payfast.ts)).

Writing a real PayFast refund integration here would have been new behaviour smuggled in under a
refactor: reachable by no route, exercised by no live test, verifiable by nobody. A7 asserts the
refusal shape **and** that zero network calls are attempted — the injected `fetch` throws if
touched. `refund()` returning `ok: true` would be a silent lie a caller would treat as a completed
refund, so that is a hard fail too.

### Any advisory signal must never be able to flip `verified`

`sourceIpTrusted` is `boolean | null` — `null` meaning "could not be determined". The source-IP
check went **log-only on 2026-08-18** after a real, correctly-signed sandbox ITN arrived from
`35.219.200.118`, outside the resolved host set: enforcement was rejecting genuine payments. The
seam records the fact and can never let it gate acceptance
([`payfast.ts:185-197`](../lib/payments/payfast.ts)).

A2 case 10 asserts precisely this, because an adapter author reading the field name without the
history would reasonably assume it is meant to reject.

### Ordering inside `verifyNotification` is load-bearing

For the PayFast adapter, in this order ([`payfast.ts:163-214`](../lib/payments/payfast.ts)):

1. Parse the raw body preserving **posted order**, stopping (`break`) at the signing key — not
   skipping it and continuing. Fields arriving after it are excluded from the digest.
2. Passphrase present → otherwise `'not-configured'` **before any digest is computed**. An unset
   passphrase would silently degrade verification to a plain MD5 over fields that are all visible
   to whoever started the checkout; anyone could then compute a "valid" signature and mark their own
   unpaid order paid.
3. Recompute the digest with the **inbound** algorithm. Missing/empty → `'missing-signature'`;
   mismatch → `'signature-mismatch'`.
4. **Only now** resolve the source IP. A failing signature must never trigger DNS.
5. Reference present → otherwise `'missing-reference'`. Checked *after* the signature, so a forged
   body cannot change the reason returned.

PayFast documents two genuinely different parameter-string algorithms — outbound trims values and
skips blanks, inbound does neither. **Collapsing them into one "shared helper" is the single most
likely mistake a pure move can make**, and is exactly the defect ticketing-F10 was opened to fix.
A3 observes their divergence *through the seam's own surface* rather than by grepping for two
function names, so an adapter that imports both and calls the wrong one still fails.

### `mapStatus` preserves the one-way-to-paid rule

Strict, case-sensitive, untrimmed: exactly one input string may yield `'paid'`. A `toUpperCase()`
or `.trim()` "improvement" widens the one way an order becomes paid and is a behaviour change. A5
runs nine near-misses (`'complete'`, `'Complete'`, `'COMPLETED'`, `'COMPLETE '`, `' COMPLETE'`, …)
plus `null` and requires none of them to map to `'paid'`, and case 5 asserts the mapping is not
constant.

### `lib/payments/types.ts` stays gateway-neutral

No gateway vocabulary may appear in it — A8 bans, case-insensitively:
`payfast`, `m_payment_id`, `pf_payment_id`, `amount_gross|fee|net`, `merchant_key`, `merchant_id`,
`passphrase`, `eng/process`, `eng/query`, `sandbox.payfast`, `itn`, `md5`
([`check-interface-gateway-neutral.sh:31`](../contracts/checks/payment-seam-f1/check-interface-gateway-neutral.sh)).
The ban covers comments, not just code. `lib/payments/payfast.ts` is the **only** file under
`lib/payments/` permitted to name PayFast.

The moment a provider's own vocabulary leaks into the interface, the abstraction is that provider
wearing a coat, and the second integration reopens the interface instead of implementing it —
which is the entire outcome this mission exists to prevent.

### `lib/payfast.ts` is composed, not moved

The adapter imports `buildPayfastNotifyParamString`, `generateNotifySignature`,
`generateSignature`, `getClientIp`, `PAYFAST_ITN_HOSTS`, `PAYFAST_SANDBOX_PROCESS_URL` and
`PAYFAST_SANDBOX_VALIDATE_URL` from [`lib/payfast.ts`](../lib/payfast.ts) and does not relocate
them. Four other contracts' check scripts import those primitives by that exact path; moving them
would churn green gates for no gain. F1's A10 sha256-pins the file so this is enforced rather than
hoped for.

One function did move in F2: `parseOrderedFields` — the gateway's own inbound body parse — was
lifted out of the notification route into
[`lib/payments/payfast.ts:90-105`](../lib/payments/payfast.ts), exported with the same signature.
Three ticketing-F10 check artefacts import it directly and were repointed to its new home, so
F10's assertions keep asserting exactly what they asserted, against the same function.

---

## Ozow adapter — `lib/payments/ozow.ts`

**Status:** F1 complete (2026-08-22), F2b complete (2026-08-22). Additive code only — no changes to the seam interface. Implements all five interface members per the design above.

**F3 live-purchase testing:** Identified a vendor-side blocker. See [`contracts/golden/ozow-m1-f3/README-addendum-blocked.md`](../contracts/golden/ozow-m1-f3/README-addendum-blocked.md) for the investigation trail, Brad's action items, and confirmation steps with Ozow support.

**Code:** [`lib/ozow.ts`](../lib/ozow.ts) (signature builder), [`lib/payments/ozow.ts`](../lib/payments/ozow.ts)
(PaymentProvider adapter).

**Signature algorithm** ([verified against Ozow's own docs via Alembic](../contracts/golden/ozow-m1-f1/README.md#1-the-algorithm-claim-was-independently-verified-not-trusted-secondhand)):
Plain SHA512 (not HMAC-SHA512). **Correction note:** `docs/payment-gateway-research-2026-08.md`
(2026-08-14) incorrectly states Ozow uses HMAC-SHA512; this was corrected on 2026-08-22. Ozow's
actual algorithm is: concatenate post variables in order, append the private key, convert to lowercase,
generate SHA512 hash. Independently verified against `https://ozow.com/integrations`,
`https://api.i-pay.co.za/guide/payment`, and public Laravel integration examples.

**Field mapping** (from `InitiateInput`):
- `BankReference` = `input.reference` (identical to `TransactionReference`)
- `ErrorUrl` = `input.cancelUrl` (no separate error URL on the interface)
- `CountryCode` = `'ZA'`, `CurrencyCode` = `'ZAR'` (constants)
- `IsTest` = `'true'` (sandbox only; going live is a future feature)
- `Optional1–5`, `Customer` (empty — no equivalent data on `InitiateInput`)

**`confirmNotification` implementation (F2b):**
`confirmNotification` calls Ozow's live `GetTransactionByReference` anti-spoofing status API
(`api.ozow.com`) with an `ApiKey` header rather than a form POST. Returns `{ confirmed: true }`
on a successful match, `{ confirmed: false, reason: 'not-valid' }` if the status does not match a
known successful transaction, `{ confirmed: false, reason: 'request-failed' }` on a network error
(never throws or rethrows), and `{ confirmed: false, reason: 'not-configured' }` if
`OZOW_SANDBOX_API_KEY` is unset. The lookup also handles duplicate `TransactionReference` values by
falling back to `TransactionId` for disambiguation, or fails closed to ambiguous if neither is
reliable. Fail-closed on every malformed/unexpected response shape, including JSON-parse-safety
fixes for non-JSON 2xx bodies. `readiness()` now also requires `OZOW_SANDBOX_API_KEY` alongside the
sign-and-send credentials.

**Status vocabulary** — `mapStatus` recognizes Ozow's three values:
- `'Complete'` → `'paid'`
- `'Cancelled'` → `'cancelled'`
- Anything else (including `'Error'` or unrecognised strings) → `'unknown'` (no `'failed'` for
  Ozow; the transaction state is opaque without the confirmed status call)

---

## Checkout wiring — `lib/payments/index.ts`, routes, and order-level gateway tracking (F2)

**Status:** F2 complete (2026-08-22). Wires provider selection into checkout and ITN handling.
Refactors the single hardcoded `paymentProvider` const into a provider registry, validates buyer
selection in the checkout route, and extracts shared notification logic into a helper both
(unchanged) PayFast and (new) Ozow notification routes call. No behaviour change to PayFast's
existing path — regression-proven by re-running existing PayFast ITN assertion suites unmodified.

**Code:** [`lib/payments/index.ts`](../lib/payments/index.ts) (provider registry and resolver),
[`app/api/tickets/checkout/route.ts`](../app/api/tickets/checkout/route.ts) (provider selection and
validation), [`lib/tickets-notification.ts`](../lib/tickets-notification.ts) (shared 11-step handler),
[`app/api/tickets/itn/route.ts`](../app/api/tickets/itn/route.ts) (PayFast's thin route),
[`app/api/tickets/ozow-itn/route.ts`](../app/api/tickets/ozow-itn/route.ts) (new Ozow thin route),
[`lib/checkout-reservation.ts`](../lib/checkout-reservation.ts) (order.gateway field),
[`components/tickets/ProviderChoice.tsx`](../components/tickets/ProviderChoice.tsx) (buyer-facing
radio control), [`lib/payments-ui.ts`](../lib/payments-ui.ts) (provider-neutral UI helpers).

### The provider registry — replacing a hardcoded const with a map

**Before F2:** `lib/payments/index.ts` exported a single const `paymentProvider: PaymentProvider =
payfastProvider;`. Selection was a module-load decision with no notion of "which provider for this
particular checkout."

**After F2:** The same module exports a registry:

```typescript
export const paymentProviders: Readonly<Record<string, PaymentProvider>> = {
  payfast: payfastProvider,
  ozow: ozowProvider,
};

export function resolveProvider(id: string): PaymentProvider | null {
  return Object.prototype.hasOwnProperty.call(paymentProviders, id) ? paymentProviders[id] : null;
}
```

The `Object.prototype.hasOwnProperty.call()` check is load-bearing, not decoration: a naive bracket
lookup resolves prototype members (`'constructor'`, `'__proto__'`) to inherited `Object.prototype`
values, which are truthy and NOT `null`. A caller checking `if (provider)` would treat a poisoned
lookup as a valid provider. The registry is deliberately small and static — no dynamic imports, no
env-driven plugin loading. Two hardcoded entries are appropriate for exactly two known providers;
when a real third gateway needs to coexist with the first two, the selection design can evolve with
two concrete examples in hand rather than guesses.

### Checkout validation — `providerId` from request body, validated against an allow-list

**Buyer-facing selection:** Before checkout, a radio control (`components/tickets/ProviderChoice.tsx`)
lets the buyer choose "Pay with Ozow" or "Pay with PayFast" (Ozow listed first, reflecting Brad's
direction that Ozow is the client's actually-preferred option). The buyer's choice becomes a
`providerId` field in the form POST body.

**Server-side authority:** `app/api/tickets/checkout/route.ts` validates `providerId` against an
enumerated allow-list (`'payfast'` or `'ozow'`) **immediately**, alongside other request-validation
gates and **strictly before any Sanity CMS access**. A missing or invalid `providerId` returns 400
with an error message; anything else is a silent PayFast default (the exact inversion the payment-
provider-seam F2 fixed). The resolver is called once the validation passes, and the resolved
`PaymentProvider` is what `readiness('initiate')` and `.initiate(...)` are called on, replacing the
hardcoded `paymentProvider` import.

**Order-level tracking:** The chosen `providerId` is stored as `order.gateway` in Firestore
(new field, additive, not a schema break). `lib/checkout-reservation.ts`'s `buildReservationDocs()`
and `buildMultiReservationDocs()` now accept a required `gateway: string` field and write it to the
order, replacing the old hardcoded `PAYFAST_GATEWAY` constant. This ensures every order records which
provider was actually selected at purchase time, not a retroactive guess.

### Shared notification handler — extracting the 11-step sequence

**Before F2:** The entire 11-step ITN verification, status writing, and confirmation path lived
inline in `app/api/tickets/itn/route.ts`'s `POST()` handler.

**After F2:** The sequence is extracted into `lib/tickets-notification.ts`'s `handleProviderNotification(provider, request)` helper. Both routes import and call it:

- `app/api/tickets/itn/route.ts` (unchanged path, PayFast-only) `POST()` → calls `handleProviderNotification(payfast, request)`
- `app/api/tickets/ozow-itn/route.ts` (new path) `POST()` → calls `handleProviderNotification(ozow, request)`

The routing is **trivially separate** (Ozow's URL cannot collide with PayFast's), while the
verification logic is **shared once** (no copy-pasted duplicate of the 11-step body). This avoids
the risk of a future PayFast-only golden-file change accidentally altering Ozow's behaviour through
shared code that was never meant to be shared at that granularity. Each route is a thin pass-through,
delegating entirely to the provider-agnostic helper.

### Settlement gateway check — order.gateway must match the notifying provider

Both routes (and therefore the shared handler) read the `order.gateway` field from Firestore. During
settlement, after all other gates pass (signature, amount, PayFast/Ozow server-confirm), the handler
verifies that the notifying provider's id matches the order's stored `gateway` value. A mismatch
means a notification from one gateway is trying to settle an order that belongs to the other — the
handler refuses with a non-2xx response and logs the incident. This prevents a cross-provider
replay attack where an attacker captures an Ozow ITN and replays it against a PayFast order (or
vice versa).

### Provider-neutral UI helpers — `lib/payments-ui.ts`

`providerLabel(providerId: string): string` returns a display-friendly name for a provider:
`'payfast'` → `'PayFast'`, `'ozow'` → `'Ozow'`, anything else → `'Unknown provider'` (fail-closed).
Used in UI copy like `"Redirecting to {providerLabel}…"` instead of hardcoded `"Redirecting to PayFast…"`.
The checkout response now includes a provider-neutral `amount` field (number, in ZAR) so the
redirect notice displays correctly regardless of each provider's internal field-casing convention
(PayFast: `fields.amount`; Ozow: `fields.Amount`).

### Idempotent replay with provider matching

`app/api/tickets/checkout/route.ts` already guarded replays on `Idempotency-Key` + buyer email +
ticket type (F3 of ticketing-hardening). F2 adds one more requirement: a replay whose `providerId`
doesn't match the order's originally-stored gateway returns 409 (conflict), not a re-initiation
through the different provider. This prevents a buyer from using an idempotency-key capture to swap
payment methods mid-purchase.

---

## Adding a second gateway

Provider selection is **a single const**:

```ts
// lib/payments/index.ts
export const paymentProvider: PaymentProvider = payfastProvider;
```

No registry. No `Record<string, PaymentProvider>`. No `PAYMENT_PROVIDER` env switch. No dynamic
import. A8 asserts the absence of all four.

**This is deliberate, and it is not an oversight to be improved.** Packaging is explicitly deferred
(Brad, 2026-08-19) until SAOC works. A plugin system built for a second adapter that does not exist
yet is scaffolding around a guess. Swapping gateways means changing that one line; when a real
second gateway needs to coexist with the first, that is the moment to design selection — with two
concrete implementations in hand rather than one.

### The checklist for Ozow or Peach

1. **Add `lib/payments/<gateway>.ts`.** It is the only new file that may name that gateway.
   Export a `create<Gateway>Provider(deps?)` factory and a default instance. Take `env`, `fetch`
   and any resolver as injectable deps so its checks can run offline.
2. **Implement all five members.** Config read per call. Refusals by return value with the existing
   `reason` codes — do not widen the unions unless a real gateway state genuinely has no home in
   them, and if it does, change `types.ts` and this document together.
3. **`initiate`** — return the hosted-page URL, `method: 'POST'`, and the fields in whatever order
   that gateway signs in. If the gateway is not configured, refuse with `'not-configured'` and
   return no fields.
4. **`verifyNotification`** — authenticate the webhook using that gateway's own scheme (Ozow's
   `Hash`, Peach's response signature), fail closed on a missing secret **before** computing
   anything, and populate `grossAmount` as an **unparsed string**. Any IP/origin signal is advisory.
5. **`confirmNotification`** — the out-of-band status query: Ozow's transaction-status endpoint,
   Peach's `resourcePath` GET. For Peach this is the primary status source, not a double-check.
   A network failure is `'request-failed'`, never a confirmation and never a throw.
6. **`mapStatus`** — map that gateway's vocabulary onto `PaymentStatus`, keeping exactly one input
   mapped to `'paid'` and everything unrecognised falling to `'unknown'`, not to `'paid'`.
7. **`refund`** — implement it if the gateway supports it and something calls it; otherwise return
   `{ ok: false, reason: 'not-supported' }` and make no network call.
8. **Change the one line in `lib/payments/index.ts`.**
9. **Write the wire golden first, from executed code, not from the gateway's documentation.** Every
   value in `payfast-wire.golden.json` was produced by running the real pre-move code and not by
   recomputing it with the same code the checks test. A second adapter deserves the same treatment,
   including the tamper suite (foreign digest, tampered amount, reordered fields with a replayed
   signature, missing and empty signature, wrong secret) and a named positive control in every check
   that asserts a rejection.
10. **Prove it live.** A green contract gate has never been sufficient evidence on this subsystem.
    Every check in the F1 contract is offline: no network, no DNS, no Firestore, no `process.env`.

**What F1 does not prove is that the seam is sufficient for Ozow or Peach.** The interface is drawn
against all three gateways' published shapes, but only PayFast has an adapter. The first real second
adapter is the test of the design.

---

## What is deliberately NOT in the seam

These stay in the route. Each is listed with the reason it cannot move, so that a later
"simplification" has to argue with a reason rather than a shrug.

| Stays in the route | Why |
|---|---|
| The **amount check** (`Math.abs(grossAmountCents - orderAmountCents) >= AMOUNT_MATCH_TOLERANCE_CENTS`, [`itn/route.ts:151`](../app/api/tickets/itn/route.ts)) | It compares the gateway's number against *our* Firestore order, in integer cents to avoid floating-point rounding errors. The provider cannot see our order and has no business ruling on an amount. |
| The **order lookup** by reference | Ours. Firestore, not the gateway. |
| The **order identity re-validation** (`order?.m_payment_id !== input.m_payment_id`, [`lib/orders.ts:329-330`](../lib/orders.ts)) and the **order-vanished check** (same transaction, [`lib/orders.ts:313-318`](../lib/orders.ts)) | The route calls `markOrderAndPositionPaidByPaymentId` with an `orderId` resolved from an earlier, non-transactional query. Inside the transaction, the function must re-validate that the resolved order still holds the same `m_payment_id`, because a stale or wrong `orderId` could point at a real, still-`'reserved'` order for a *different* payment; without that check, that unrelated order would be marked paid for money it never received. The identity check is deliberate and load-bearing: it runs *before* the status check (line 332), so a mismatched-identity order is never misdiagnosed as "already settled" — its name in the outcome is `'order-payment-id-mismatch'`, distinct from `'order-not-reserved'`. The vanished check (`!orderDoc.exists`) is separate and also distinct, from the pre-transaction query miss — it means the order existed when its ref was resolved and was deleted between then and the transaction, an alarming event that must not share a reason with a never-found order. |
| The **already-settled short-circuit** (with non-`paid` settled states logged loudly) | Idempotency is our concern; it also sits *between* verification and server-confirm, so folding it into the provider would reorder the security sequence. |
| The **`RECOVERY_TOKEN_SECRET` guard** ([`checkout/route.ts:318-325`](../app/api/tickets/checkout/route.ts)) | It mints **our** HMAC-SHA256 ticket-recovery token and has nothing to do with any gateway. It is additionally **load-bearing by source position**: `contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh` proves it sits textually *before* the reservation write, so an unset secret refuses before any Firestore write rather than minting a never-verifiable-again token. Moving it anywhere breaks another contract's green gate. A9 asserts both that the secret name never appears under `lib/payments/` and that the guard is still in the route. |
| The **transactional order+position write** and the post-commit, failure-isolated **confirmation email** | Ours. The provider returns facts. |

### The two passphrase guards are deliberately asymmetric — do not tidy this

**The hand-off path has no passphrase guard. The notification path fails closed without one.** This
looks like an inconsistency and is not. Since F2 both live inside the adapter — `initiate` versus
`verifyNotification` — where they are easier to see side by side and therefore easier to "tidy".

- **`initiate`** passes a possibly-`undefined` passphrase straight into `generateSignature`, which
  folds it in only when truthy ([`payfast.ts:136-139`](../lib/payments/payfast.ts)). An unsigned-
  with-passphrase outbound form is a *weaker* hand-off, not an exploitable one, and PayFast will
  simply reject it.
- **`verifyNotification`** guards, because an unset passphrase there degrades verification to a plain MD5 over
  fields (`m_payment_id`, `amount_gross`, `merchant_id`, …) that are all visible to whoever started
  the checkout. Anyone could compute a "valid" signature and POST directly to the route to mark
  their own unpaid order paid.

Since the source-IP check became log-only on 2026-08-18, **the ITN passphrase guard and the
server-confirm round-trip are the entire security boundary.** The asymmetry is correct; F1's A1
case 2 and A2 case 7 pin both halves. Do not merge them into one guard.

### The `500`-not-`4xx` choice

A missing merchant credential returns HTTP **500** with
`{"error":"Payment gateway is not configured. Please try again later."}`. The request was
well-formed; the misconfiguration is ours. A 4xx would tell the buyer to fix something they cannot
see. Every ITN refusal, by contrast, returns HTTP **200** `{"received":true}` so PayFast stops
retrying — **a 200 there never implies acceptance**, and the order is left untouched. All exact
status codes, bodies and log lines are in
[`fail-closed-guards.golden.md`](../contracts/golden/payment-seam-f1/fail-closed-guards.golden.md).

---

## How the seam is verified

### F1 — the seam itself

Twelve assertions in [`contracts/contract-payment-seam-f1.yaml`](../contracts/contract-payment-seam-f1.yaml).
**Eleven were observed failing against unfixed code on 2026-08-19**; the twelfth is labelled as not
being evidence at all.

| | Asserts |
|---|---|
| A1 | Outbound wire equivalence — eight fields in insertion order, pinned MD5 on the passphrase-present / absent / empty paths, plus a case proving the digests differ |
| A2 | Inbound verification + a ten-case tamper suite, including passphrase-fails-closed-before-digest and untrusted-IP-still-verifies |
| A3 | The two signature algorithms are not unified, observed through the seam's surface |
| A4 | Fail-closed credential guards, including per-call env reads on one instance |
| A5 | `mapStatus` preserves the one-way-to-paid rule |
| A6 | Server-confirm URL, method, content type and **byte-exact** body; exact `VALID` match; network error becomes a refusal |
| A7 | `refund` is a declared signature with zero network calls |
| A8 | The interface is gateway-neutral and selection is one config point |
| A9 | `RECOVERY_TOKEN_SECRET` did not cross the seam and its route guard survives |
| A10 | F1 is additive — both routes and `lib/payfast.ts` are sha256-unchanged. (This pinned the *pre-rewire* routes, as the boundary that gave F3's live purchase one candidate cause instead of two. F2 then reopened the ITN route through the re-pin ceremony below.) |
| A11 | Compiler-driven proof of the exported shape, including `@ts-expect-error` narrowing proofs |
| A12 | **Hygiene gate only.** `pnpm lint && pnpm type-check` pass both before and after F1, so neither may be cited as proof the seam works. Every behavioural claim rests on A1–A11. |

There are **no `agent_review` assertions** and no membership-instead-of-order checks: A1 asserts
`Object.keys(fields)` equals an *ordered* array, because field order **is** the signature base
string. Every check that asserts a rejection asserts an acceptance first, as a named positive
control — a harness that rejected everything (the false-green shape this project hit on F4's A3,
F5's A3 and F7's A2) fails those loudly instead of passing silently.

All credentials in the goldens and checks are fabricated. `10000100` is PayFast's own published
sandbox demo merchant id.

### F2 — the route rewiring

Seven assertions in [`contracts/contract-payment-seam-f2.yaml`](../contracts/contract-payment-seam-f2.yaml).

| | Asserts |
|---|---|
| A1 | **The decisive assertion of the mission** — structural and negative: no PayFast symbol, env var name, URL or field name survives in either route. Observed failing against the pre-rewire tree on 2026-08-19 with 18 hit classes. |
| A2 | Re-pin ceremony step 1 — the catch-up audit (see below) |
| A3 | Re-pin ceremony step 2 — the F2 re-pin, plus a re-hash of the expected file itself so @dev cannot edit the target to match the code |
| A4 | The security sequence and the ownership boundary survive: the full nine-landmark ITN source order **in code**, comment lines excluded |
| A5 | The four downstream repoints are re-run and required to exit 0 |
| A6 | The pre-existing payfast-m1 suite driving the real `POST()` against real Firestore — the strongest behavioural proof short of a live purchase, and it covers the notification half only |
| A7 | **Hygiene gate only**, for the same reason as F1's A12 |

### The ban is stricter than "no identifiers"

**The word "signature" is banned in the route text including comments.** If the route's own prose
talks about PayFast signatures, the next developer reaches for PayFast; the rewritten route says
"authenticates the body against the shared secret" instead. It also keeps the check a plain grep
rather than a comment-stripping parser.

A4 takes the opposite trade and *excludes* comment lines, because its claim is genuinely about the
order of code: several landmarks are also named in the comments explaining later steps, and an
unfiltered search resolved the atomic write to a comment, reporting a reordering that was not there.

### Three exceptions, hard-counted so none can grow

| | Exception | Why it stays |
|---|---|---|
| E1 | the path literal `/api/tickets/itn` | It is **our** route path; we happened to name it after PayFast's acronym. Renaming it changes the `notify_url` already registered against in-flight reservations — payments in progress would post to a 404. A live-integration change, not a refactor. |
| E2 | the `[tickets/itn]` log prefix | Derived from E1, plus every existing Cloud Logging filter. |
| E3 | **one** `m_payment_id` object key | It is a Firestore **document field name** — an indexed column the `orders` collection has carried since ticketing-F2, queried by `lib/orders.ts` at three call sites. Removing it is a data migration over live documents. The pre-rewire route had nineteen occurrences, so the budget is not a loophole. |

E1 and E3 are naming debt worth knowing about before the second gateway lands: **`/api/tickets/itn`
and the `m_payment_id` column are PayFast vocabulary that has leaked into our URL space and our data
model, and the seam does not reach either.** That is the part the seam will *not* make painless.

### The re-pin ceremony, and why it is two steps

Four contracts pinning the ITN route were stale **before F2 existed** — the reviewed, deliberate
2026-08-18 source-IP change was never re-pinned. The team lead confirmed on 2026-08-19 that the
on-disk content is the intended baseline.

Overwriting all four pins with F2's new value would have erased that history: the record would say
"F2 changed this file" and nothing would ever show that four gates had been red for a day and a half
for an unrelated reason. So the ceremony is deliberately two steps and must never be collapsed:

- **A2 — the catch-up audit.** Proves the reviewed baseline hashes to `a71f9505…` against the
  **immutable git blob**, not the working tree (a working-tree check evaporates the moment F2 edits
  the file). It also asserts the two values *differ*, so a "rewire" that changed nothing cannot pass.
- **A3 — the F2 re-pin.** The route becomes byte-identical to the architect-authored expected file
  and all four downstream goldens move to `893dfeff…`.

### Four downstream repoints

Rewiring the route broke four artefacts in *other* contracts that depended on gateway internals
living inside it. They were repointed deliberately, and A5 re-runs all four:

- Three ticketing-F10 checks imported `parseOrderedFields` **from the route**; it moved to
  `lib/payments/payfast.ts` and the imports followed.
- payfast-m1's A32 (`check-server-confirm-fetch-outside-transaction-scope.mjs`) required a literal
  `fetch(PAYFAST_SANDBOX_VALIDATE_URL, …)` **in the route source**, which F2 necessarily removes.
  **An existing green assertion required a PayFast symbol to be in the route, and F2's decisive
  assertion forbids it** — one of them had to move. Its *intent* (the round-trip is not inside the
  Firestore transaction) survives, and F1's A5 part 3 retires the class rather than relocating it:
  the adapter touches no Firestore at all, so the confirm call now lives in a module that **cannot**
  open a transaction around itself.

### Why checkout is not sha256-pinned

The ITN route is pinned because it already was, four times over. Checkout is not, and F2
deliberately does not start: a pin is a standing tax of one architect-authored expected file per
edit, the route is ~509 lines and actively evolving, and the multi-line-cart work lands next. Its
PayFast surface was small — one import, three env reads, one signature call, one response object —
and is entirely covered by A1's ban plus A4's recovery-secret position check.

### Still open — a fifth stale pin, found and not fixed

`contracts/golden/production-blockers-f4-itn-check-repoint/orders-lib.golden.sha256` records
`47c2e83c…` for `lib/orders.ts`, which actually hashes to `a8c8b416…`. A fifth contract with a
silently red assertion, unrelated to this mission. F2 does not touch `lib/orders.ts`, so correcting
it there would be exactly the unreviewed in-passing edit the ceremony exists to prevent.
**Reported for triage.** Someone must establish whether that drift is a reviewed change that was
never re-pinned, or something nobody has looked at.

### What the contracts do not prove

- **That a real sandbox purchase still completes.** F3 owns that, re-run live against the deployed
  site with Firestore and Cloud Logging cross-checked, and its assertions must be re-runnable
  against a *fresh* purchase rather than tied to one historical booking reference.
- **That the interface is right.** F2 proves PayFast fits behind it, which is the weakest possible
  evidence for an abstraction — the adapter was drawn from the code it replaced. The second gateway
  is the real test, which is why [the checklist above](#the-checklist-for-ozow-or-peach) exists.

---

## Provisional figures — containment note

This is a mission requirement, recorded here because this document is where a future implementer
looks when wiring prices into the checkout.

[`.agent/memory/project/provisional-figures.md`](../.agent/memory/project/provisional-figures.md)
holds **web-team estimates** for ticket capacities and child age bands, and Lee-Ann's own
pencilled-in prices (marked in her document as "final prices to be confirmed"), pending her return
of the pricing questionnaire. They are **not council-confirmed** and are not to be shown to the
public as fact.

They are deliberately confined to that single file, with a provisional flag, and are replaced
wholesale when the questionnaire comes back — see "Replacement procedure" at the bottom of that
file.

**Why the containment matters more than the estimates.** This project has twice been damaged by
invented values spreading unflagged:

- **The CTICC venue** — a placeholder that reached six-plus fields before anyone checked it. The
  real venue is The Hangar, Stellenbosch Flying Club (confirmed 2026-08-12). See
  [docs/venue-prose-residue.md](venue-prose-residue.md).
- **The 18–21 September 2027 show dates** — never council-confirmed, yet written into Sanity by
  `scripts/seed-page-singletons.ts`, present in `lib/data/events.ts`, driving the live home-page
  countdown, and presented back **to Lee-Ann herself as a confirmed value** in
  `docs/show-visitor-info-for-editors.md`.

Both started as one reasonable working assumption and ended up in seed scripts, golden files, live
Sanity content and a public countdown, presented as settled fact. The mitigation is not "don't
estimate" — the instruction is explicitly to estimate so the build continues. The mitigation is
**containment**: every provisional value gets exactly one home, carries a machine-readable
provisional flag, and is never rendered to a public page as settled without that flag being
consulted.

The seam itself needs none of these figures — it is gateway plumbing, not pricing.

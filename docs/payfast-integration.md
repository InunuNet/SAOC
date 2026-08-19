# PayFast Integration — M1 (Payment Plumbing)

**Mission:** `.agent/memory/project/missions/2026-07-01-payfast-ticketing.md`
**Contract:** `contracts/contract-payfast-m1.yaml` (33 assertions, all green)
**Status:** M1 shipped (F1, F2, F3). M2 (buy flow UI, confirmation, email) not started — see [What's not built yet](#whats-not-built-yet-m2).

---

## What this milestone delivers

PayFast is the confirmed payment gateway for SAOC 2027 National Show ticketing (replacing an
earlier, never-built Stripe exploration). M1 is the server-side payment plumbing only — no
public-facing buy flow yet:

- **Schema rework** — the Firestore `Ticket` type dropped the leftover Stripe-shaped
  `stripePaymentIntentId` field and gained `amount`, `m_payment_id`, and `pf_payment_id`. See
  [docs/firestore-ticket-schema.md](firestore-ticket-schema.md) for the full field table.
- **Checkout initiation route** — `app/api/tickets/checkout/route.ts` creates a `reserved`
  ticket doc and returns a signed PayFast redirect form.
- **ITN webhook handler** — `app/api/tickets/itn/route.ts` receives PayFast's payment
  notification and only flips a ticket to `paid` after passing four independent, fail-closed
  security checks.
- **Shared signing library** — `lib/payfast.ts` (MD5 signature generation, PHP-compatible
  URL-encoding, GCLB-aware client-IP extraction) is imported by both routes so signing logic
  exists in exactly one place.

Everything in M1 is server-side only (Firebase Admin SDK). No UI, no client Firebase SDK
imports, nothing rendered to a browser yet.

---

## Payment flow, end to end

```
1. Buyer submits { showId, ticketType, attendeeName, attendeeEmail }
       │
       ▼
2. POST /api/tickets/checkout
   - looks up amount server-side from a fixed price map (never trusts a client amount)
   - creates a Firestore ticket doc: status = 'reserved', pf_payment_id = null
   - generates bookingRef (= m_payment_id), e.g. SAOC-2027-004821
   - signs the PayFast form fields (MD5, PayFast's field-order + PHP urlencode rules)
   - returns { bookingRef, processUrl, fields } — HTTP 201
       │
       ▼
3. Browser redirects to https://sandbox.payfast.co.za/eng/process with the signed fields
       │
       ▼
4. Customer pays on PayFast Sandbox
       │
       ▼
5. PayFast POSTs an ITN (Instant Transaction Notification) to /api/tickets/itn
   - application/x-www-form-urlencoded body, includes m_payment_id, amount_gross,
     payment_status, pf_payment_id, and a signature field
       │
       ▼
6. Fail-closed validation chain (see below) — ALL FOUR must pass
       │
       ▼
7. If all checks pass AND payment_status === 'COMPLETE':
   ticket flips reserved → paid inside a Firestore transaction
   (pf_payment_id stored, purchasedAt set)
       │
       ▼
8. HTTP 200 returned to PayFast either way, so it stops retrying.
   A 200 response NEVER implies the payment was accepted — only a 'paid' Firestore
   write does.
```

The handler always acknowledges with HTTP 200 once the request is parsed, whether the
notification was accepted or rejected — PayFast's retry behaviour requires this. The ticket
document is the only source of truth for whether payment succeeded.

---

## Environment variables

| Variable | Purpose | Status |
|---|---|---|
| `PAYFAST_SANDBOX_MERCHANT_ID` | Sandbox merchant ID, sent in the checkout form and used to build the ITN signature | **Not yet set** |
| `PAYFAST_SANDBOX_MERCHANT_KEY` | Sandbox merchant key, same use as above | **Not yet set** |
| `PAYFAST_SANDBOX_PASSPHRASE` | Passphrase appended when generating/verifying signatures | **Not yet set** |

None of these are set yet. This is logged as a human-action item in
[`.agent/memory/project/needs-human.md`](../.agent/memory/project/needs-human.md) — free sandbox
signup at `sandbox.payfast.co.za` (or `registration.payfast.io`, sandbox/test mode), no FICA
verification required. Once obtained, add all three to `.env.local` (local dev) and to Secret
Manager / the hosting environment for deployed environments — never commit them.

The checkout route fails fast (HTTP 500, logged) if `PAYFAST_SANDBOX_MERCHANT_ID` or
`PAYFAST_SANDBOX_MERCHANT_KEY` is missing, rather than attempting to sign a request with empty
credentials.

Missing credentials block **F6 only** (live sandbox end-to-end test, part of M2) — they do not
block anything already built in M1.

---

## Security boundary decisions

This is the part of M1 that went through three rounds of QA findings and fixes. The design
below is the **final, correct** version — documenting it here is deliberate, so the reasoning
isn't lost and the same mistakes don't get reintroduced later.

### 1. Server-derived pricing — never trust a client-supplied amount

`app/api/tickets/checkout/route.ts` looks up `amount` from a server-side price map keyed by
`ticketType`. The request body is never read for an `amount` field at all (contract assertion
A15 greps for this and fails the build if it appears). If a buyer could supply their own
amount, they could pay R1 for a R300 ticket and the ITN amount-match check downstream would
"correctly" validate a fraudulent price.

### 2. Fail-closed ITN validation — four independent checks, all must pass

`app/api/tickets/itn/route.ts` runs, in order:

1. **Signature** — recompute `generateSignature()` over the fields exactly as received, in
   received order, excluding the posted `signature` field itself, and compare. This proves the
   payload wasn't tampered with in transit.
2. **Source IP** — resolve PayFast's published ITN hostnames (`www.payfast.co.za`,
   `sandbox.payfast.co.za`, `w1w.payfast.co.za`, `w2w.payfast.co.za`) via DNS **at request
   time** (never hardcoded IPs — PayFast rotates them) and confirm the request's client IP is
   among the resolved addresses.

   This check depends entirely on correct client-IP extraction, which was the single biggest
   source of QA findings on this milestone (see [GCLB two-hop extraction](#gclb-two-hop-client-ip-extraction)
   below) — an earlier version of `getClientIp()` silently rejected every legitimate ITN.
3. **Amount match** — the ITN's `amount_gross` must match the reserved ticket's server-derived
   `amount` within a fixed ZAR 0.01 tolerance (stored as `AMOUNT_MATCH_TOLERANCE_CENTS = 1` in
   integer cents, not a config value, to avoid floating-point rounding that would accept
   underpayment).
4. **Server-confirm callback** — POST the received data back to PayFast's own
   `https://sandbox.payfast.co.za/eng/query/validate` endpoint and require the response body to
   equal exactly `VALID`. This is PayFast confirming, server-to-server, that the notification
   genuinely originated from them — the strongest of the four checks, and the reason it runs
   last (no point calling PayFast if the signature or amount already failed).

Any single failure logs which check failed (`console.error` with `m_payment_id` and relevant
context, no secrets) and leaves the ticket untouched in `reserved`. The ticket is only flipped
to `paid` if all four checks pass **and** `payment_status === 'COMPLETE'`.

### GCLB two-hop client-IP extraction

Firebase App Hosting is not bare Cloud Run — it sits behind a full external Google Cloud Load
Balancer (GCLB) with Cloud CDN. Per Google's own docs, GCLB **appends exactly two entries** to
`X-Forwarded-For`: the real client IP, then the load balancer's own forwarding-rule IP. So the
header Cloud Run actually receives looks like:

```
<attacker-controlled-prefix>, <real-client-ip>, <load-balancer-ip>
```

The real client IP is therefore always the **second-to-last** hop — never the last (that's
always the load balancer, and taking it means every legitimate ITN gets rejected because the
LB's IP never matches a PayFast-resolved host) and never the first (that's spoofable by
whoever sends the request, making the IP allowlist check a no-op).

`getClientIp()` in `lib/payfast.ts` implements this as `hops[hops.length - 2]`. It's covered by
a dedicated regression test, `scripts/verify-payfast-itn-ip.ts`, which exercises six synthetic
`X-Forwarded-For` shapes (including the canonical 3-hop GCLB case, a minimal 2-hop case, many
spoofed prefixes, single-hop, and no-header fallback to `X-Real-IP`) and asserts the extracted
IP specifically — not a source-code string match. Run it with:

```bash
pnpm exec tsx scripts/verify-payfast-itn-ip.ts
```

If this file is ever touched again, re-run that script before assuming the change is safe —
this exact bug (taking the last hop instead of the second-to-last) shipped once during this
milestone's QA rounds and silently broke every ITN.

### 3. Atomic Firestore transaction for idempotency, guarded positively

PayFast retries ITN delivery until it receives HTTP 200, and can genuinely deliver the same
valid notification twice in close succession. The final `paid` write is wrapped in
`db.runTransaction()`:

1. Re-read the ticket doc fresh, inside the transaction.
2. If its status is anything **other than `'reserved'`**, no-op and return (idempotent).
3. Otherwise, write `status: 'paid'`, `pf_payment_id`, `purchasedAt: Timestamp.now()`.

Step 2 was originally written the other way round — a negative check, `!== 'paid'` — which
meant a ticket already `checked-in` still passed the guard and got written back to `paid`,
letting a late/duplicate ITN reopen the door for a booking reference already used. The guard
was corrected to a positive `=== 'reserved'` check (equivalently, no-op unless
`status === 'reserved'`) during the ticketing security hardening pass; this is the one place
in that pass that required editing this hash-pinned file, done under a recorded re-pin
ceremony. See [docs/ticketing-hardening.md](ticketing-hardening.md) — "The ITN write guard,
and the A15 re-pin ceremony" — for the full defect, fix, and why it can only be verified
structurally (byte-diff + hash pin) rather than behaviourally.

Without the transaction, two concurrent valid ITNs for the same `m_payment_id` could both read
`reserved` before either writes, both pass every check, and both attempt to write — not itself
harmful in this case, but it breaks the "at-most-once write" guarantee the handler is supposed
to provide, and would matter more if the write side effects ever grow (e.g. sending a
confirmation email per write — see [M2](#whats-not-built-yet-m2)).

The **external server-confirm HTTP call stays outside the transaction, before it starts**
(contract assertion A32 checks the line ordering directly). Firestore transactions must not
wrap external network calls — a transaction retry would re-issue the HTTP call, and it would
hold the transaction open for the full round-trip duration.

There's also a non-transactional idempotency **fast path** earlier in the handler (an initial
read that skips the amount-check and server-confirm entirely unless the ticket currently shows
`reserved`) — this is a pure optimisation, not the correctness guarantee; the real guarantee is
the transactional re-read immediately before the write, described above. It's explicitly
commented in the code as such. A status that is neither `reserved` nor `paid` at this point (a
cancelled or malformed document with money apparently attached to it) is logged via
`console.error`, not silently dropped, so an operator can reconcile it — the ordinary
already-`paid` duplicate-delivery case stays silent.

---

## ⚠️ Known defect — ITN signature verification algorithm (partially fixed)

**Status:** `lib/payfast.ts` has been updated with the correct inbound ITN verification algorithm, but `app/api/tickets/itn/route.ts` remains pinned and has not yet been updated to use it. This blocks the fix from shipping.

**The problem:** Real PayFast ITNs always contain blank fields (e.g., `name_last=''`, `custom_str1=''`). The route's current signature verification reuses the outbound (checkout-signing) algorithm, which skips blank fields and trims values — an algorithm that is correct for outbound but mathematically **incompatible** with PayFast's inbound ITN verification spec. Every real ITN arrives with a blank field, so the recomputed digest can never match.

**Evidence:** On 2026-08-15, two ITNs arrived and were rejected at guard 1 with `[tickets/itn] Signature mismatch`, even though payment was genuinely completed in PayFast Sandbox. Cloud Logging confirms both rejections; no ticket has reached `paid` in this project's history.

**The fix (in lib/payfast.ts, committed):** Two new exports, `buildPayfastNotifyParamString` and `generateNotifySignature`, implement PayFast's inbound algorithm correctly (posted order, no blank-skip, no trim). The outbound path (`generateSignature`) remains untouched and working.

**What's left:** The route file is sha256-pinned, so updating its two call sites (line 89 and line 193) to use the new functions requires:
1. Lifting the pin
2. Updating the two function calls
3. Re-pinning with the new hash
4. Running the contract again (assertions A5 and A6 currently fail on this blocker)

This is documented in full in [docs/payfast-itn-signature.md](payfast-itn-signature.md) — **read that for the complete root cause, algorithm details, and verification strategy.**

---

## Known limitation — placeholder ticket pricing

`PLACEHOLDER_TICKET_PRICES` in `app/api/tickets/checkout/route.ts` is a hardcoded map:

```ts
const PLACEHOLDER_TICKET_PRICES: Record<TicketType, number> = {
  general: 150.0,
  member: 100.0,
  vip: 300.0,
};
```

Real 2027 National Show ticket tier pricing (the proposal names Adult/Pensioner/Child/Member/
Exhibitor tiers, which don't yet map 1:1 onto the current `TicketType` union) has not been
confirmed. This is logged as a non-blocking human-action item in
[`.agent/memory/project/needs-human.md`](../.agent/memory/project/needs-human.md). It does not
block M1 or the F4/F5 buy-flow UI build — placeholder prices are usable for development and
sandbox testing throughout. It does need resolving before any **live** PayFast account goes
into production, since the amount PayFast actually charges must match this map exactly (see
[amount match](#2-fail-closed-itn-validation--four-independent-checks-all-must-pass) above).

---

## What's not built yet (M2)

M1 covers F1–F3 (schema, checkout initiation, ITN handler) only. The mission's M2 milestone —
not started — covers:

| Feature | What it adds |
|---|---|
| **F4** — Ticket buy flow UI | Public-facing tier selection, quantity picker, order summary, checkout button that POSTs to `/api/tickets/checkout` and redirects to PayFast |
| **F5** — Purchase confirmation page + email | `return_url` landing page (must show a "processing" state if the ticket is still `reserved` when the buyer lands — do not claim success before the ITN has processed) and a Resend confirmation email sent once status flips to `paid` |
| **F6** — Sandbox end-to-end verification | A real test transaction through PayFast Sandbox covering the full path, plus a clean `pnpm build` |

There is currently no page at `/tickets/confirmation` or `/tickets/cancelled` (the
`RETURN_URL`/`CANCEL_URL` targets referenced in `app/api/tickets/checkout/route.ts`) and no
buy-flow entry point anywhere in the site. F6 is additionally blocked on the
`PAYFAST_SANDBOX_*` credentials above.

---

## Testing locally against PayFast Sandbox

Once `PAYFAST_SANDBOX_MERCHANT_ID` / `PAYFAST_SANDBOX_MERCHANT_KEY` / `PAYFAST_SANDBOX_PASSPHRASE`
are added to `.env.local`:

1. **Run the two regression scripts first** — they don't need credentials or a running server,
   and catch the two most fragile parts of this integration in isolation:

   ```bash
   pnpm exec tsx scripts/verify-payfast-signature.ts   # MD5 signature correctness
   pnpm exec tsx scripts/verify-payfast-itn-ip.ts       # GCLB client-IP extraction
   ```

2. **Start the dev server** (`pnpm dev`) and POST to the checkout route directly to confirm it
   creates a `reserved` ticket and returns a signed form:

   ```bash
   curl -X POST http://localhost:3000/api/tickets/checkout \
     -H "Content-Type: application/json" \
     -d '{"showId":"test-show","ticketType":"general","attendeeName":"Test Buyer","attendeeEmail":"test@example.com"}'
   ```

   Check the Firestore `tickets` collection for the new `reserved` doc, and confirm the
   response's `fields.signature` is present.

   **⚠️ Important:** This curl example creates a `reserved` ticket that has no associated
   payment. No ITN will ever complete this reservation, so the ticket will expire after
   `RESERVATION_TTL_MINUTES` and be released. Do not use this example as a model for
   production test data — it creates orphaned documents. A real reservation only forms when
   a buyer actually completes payment in PayFast.

3. **Full sandbox round-trip (F6, once F4's buy-flow UI exists)** — The `notify_url` is
   resolved at request time from `process.env.SITE_URL` (with a fallback to
   `https://saoc.co.za`). For sandbox testing, `SITE_URL` must be set to the App Hosting
   origin so that PayFast's ITN can reach the handler. Without this override, a sandbox
   `notify_url` built on the fallback production origin would deliver the ITN to the old
   Joomla site and never reach this app. A full round-trip test additionally needs either a
   deployed preview environment or a tunnel (e.g. `ngrok`) pointed at the local ITN route.
   This is part of the still-unbuilt F6 — not yet exercised.

4. **Manual ITN payload testing** — PayFast Sandbox's merchant dashboard can resend a test ITN
   for a sandbox transaction, which is the most reliable way to exercise the fail-closed
   validation chain end-to-end (all four checks) without a live browser checkout.

---

## Production-blockers F4 — repointing the stale payfast-m1 contract checks

**Status:** Seven assertions in `contract-payfast-m1.yaml` (A18, A19, A20, A21, A30, A31, A32) were red after F10 moved the ITN payment lookup and atomic write out of the route into `lib/orders.ts`. This is **not a production defect** — checkout was already writing the `orders` documents and the ITN route was already reading and writing them correctly. Only the test infrastructure was stale.

### Why the checks went red after F10

F10 refactored the payment architecture from a single `tickets` collection to a two-collection `orders` + `positions` model:

- **Before F10:** `app/api/tickets/itn/route.ts` handled the full ITN path: reading a `reserved` ticket from `tickets`, validating payment, and writing it to `paid` in a single transaction inside the route.
- **After F10:** The route now imports and calls `findReservedOrderByPaymentId` and `markOrderAndPositionPaidByPaymentId` from `lib/orders.ts`. The transaction moved entirely into `lib/orders.ts:280` inside `markOrderAndPositionPaidByPaymentId`; the route holds only validation and delegation.

The seven checks still modelled the pre-F10 schema:

- **Behavioural checks** (A18–A21, A30) built fixtures as a single `tickets` document with no `orders` sibling, then drove ITN payloads through the route. The route tried to call `markOrderAndPositionPaidByPaymentId` with a non-existent order ID and logged "No order found"; the ticket stayed `reserved`.
- **Structural checks** (A30–A31's AST counterpart and A32) searched the wrong file (`route.ts`) for transaction proof when the real transaction moved to `lib/orders.ts`. Since `lib/orders.ts` contains *two* `db.runTransaction()` calls (`createOrderWithPosition` and `markOrderAndPositionPaidByPaymentId`), a naive repoint would have silently validated the first one instead of the correct one.

### The fix: production-shaped fixtures and function-scoped AST targeting

**Behavioural half:** A new fixture helper `createOrderAndPosition()` (in `contracts/checks/payfast-m1/_itn-harness.mts`) calls the actual production function `buildReservationDocs` from `lib/checkout-reservation.ts`, ensuring fixtures always match what checkout actually writes. This replaces the old `createTicketDoc` function that had drifted out of sync.

**Structural half:** A new AST helper `findFunctionDeclarationBody()` (added to `_ast-shared.mjs`) locates a named function's body before searching inside it. The two structural checks now scope their search to `markOrderAndPositionPaidByPaymentId`'s body specifically, never to the whole file. This prevents silently validating the wrong transaction in `lib/orders.ts`.

**Residue safety:** The shared sentinel sweep in `_shared.mjs` was extended to also cover the `orders` collection filtered by `buyerEmail`, closing a gap where F4's new fixture's order documents would otherwise be invisible to cleanup checks.

### New sha256 pin on `lib/orders.ts`

The ITN route is already sha256-pinned in five other contracts because it is a payment security boundary. When F10 moved the atomic paid-write from `route.ts` into `lib/orders.ts`, the security-relevant code moved but the pin stayed behind.

This feature adds **the first sha256 pin on `lib/orders.ts`** (assertion A12 in `contract-production-blockers-f4-itn-check-repoint.yaml`), using the same `shasum -a 256 -c` mechanism as the route's pin. The golden hash is:

```
47c2e83c920a00b12953657c667250690a595049537188728ef9a5588301002b
```

**File:** `contracts/golden/production-blockers-f4-itn-check-repoint/orders-lib.golden.sha256`

**Rationale:** Both `createOrderWithPosition` (F8's comp-ticket write) and `markOrderAndPositionPaidByPaymentId` (the paid-write idempotency guard) are in this file. An unguarded edit to either could silently reintroduce the double-write or resurrection bugs that the route's pin was meant to prevent. The route's pin now covers only half the boundary; `lib/orders.ts` must carry its own.

**Follow-up recommendation (not part of F4):** The five existing contracts that pin `route.ts` should also gain a `lib/orders.ts` pin in a future session, so a legitimate edit to either security-relevant file goes through one paired ceremony instead of two drifting apart. For now, this contract's own pin is sufficient.

### Anti-drift recommendation

The two credential-free structural checks (`check-paid-write-inside-transaction-scope.mjs`, `check-server-confirm-fetch-outside-transaction-scope.mjs`) could have caught this staleness the day F10 merged if they had been wired into CI with a path-trigger for `app/api/tickets/itn/route.ts` or `lib/orders.ts` changes. Instead, the staleness went unnoticed for months.

**Recommendation:** Wire the credential-free structural checks into a CI job that triggers only on diffs touching either of these two files, independent of whether the full behavioural test suite can run (it usually cannot in CI due to missing credentials). These checks require no secrets and cost nothing to run; they would have caught this architectural divergence on the F10 PR itself rather than months later via audit. This is a CI configuration task, documented as a recommendation in the F4 golden README but not built as part of the feature.

---

## Related

- ITN signature defect: [docs/payfast-itn-signature.md](payfast-itn-signature.md) — root cause, fix status, and verification
- Ticket schema: [docs/firestore-ticket-schema.md](firestore-ticket-schema.md)
- Mission: `.agent/memory/project/missions/2026-07-01-payfast-ticketing.md`
- Contract: `contracts/contract-payfast-m1.yaml`
- Golden files / implementation spec: `contracts/golden/payfast-m1/README.md`
- Human-action items: `.agent/memory/project/needs-human.md`
- PayFast developer docs: https://developers.payfast.co.za/docs

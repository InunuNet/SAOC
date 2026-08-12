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
   `amount` within a fixed ZAR 0.01 tolerance (`AMOUNT_MATCH_TOLERANCE` in the route, not a
   config value — cents rounding only).
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

3. **Full sandbox round-trip (F6, once F4's buy-flow UI exists)** — because `notify_url` in
   `app/api/tickets/checkout/route.ts` is hardcoded to `https://saoc.co.za/api/tickets/itn`
   (production), PayFast's sandbox cannot reach a `localhost` ITN handler directly. A full
   round-trip test needs either a deployed preview environment or a tunnel (e.g. `ngrok`)
   pointed at the local ITN route with `NOTIFY_URL` temporarily overridden. This is part of the
   still-unbuilt F6 — not yet exercised.

4. **Manual ITN payload testing** — PayFast Sandbox's merchant dashboard can resend a test ITN
   for a sandbox transaction, which is the most reliable way to exercise the fail-closed
   validation chain end-to-end (all four checks) without a live browser checkout.

---

## Related

- Ticket schema: [docs/firestore-ticket-schema.md](firestore-ticket-schema.md)
- Mission: `.agent/memory/project/missions/2026-07-01-payfast-ticketing.md`
- Contract: `contracts/contract-payfast-m1.yaml`
- Golden files / implementation spec: `contracts/golden/payfast-m1/README.md`
- Human-action items: `.agent/memory/project/needs-human.md`
- PayFast developer docs: https://developers.payfast.co.za/docs

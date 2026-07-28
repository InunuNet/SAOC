# PayFast M1 — Golden Files & Implementation Spec (F1, F2, F3)

Payment plumbing for SAOC 2027 ticketing. **Target: PayFast Sandbox only** for M1.
Everything here is server-side, firebase-admin only. Never touch the client SDK.

> Anywhere marked **[VERIFY]** is inferred from standard PayFast integration
> knowledge, not confirmed live. @dev MUST cross-check against
> https://developers.payfast.co.za before shipping (fetch via Alembic:
> `curl -s http://localhost:7077/https://developers.payfast.co.za/docs`).

---

## F1 — Rework Firestore ticket schema off the Stripe-shaped field

Remove `stripePaymentIntentId` everywhere. Add PayFast-shaped fields.

**`types/index.ts` — new `Ticket` interface fields (replaces the stripe line):**
- `amount: number` — ZAR price of the ticket (needed by F3 for the ITN amount-match). Server-derived, never client-supplied.
- `m_payment_id: string | null` — OUR order reference; generated in F2, sent to PayFast, echoed back in the ITN. Use the same value as `bookingRef`.
- `pf_payment_id: string | null` — PayFast's own payment ID; `null` until the ITN confirms payment (F3).

Keep the existing `TicketStatus` lifecycle unchanged: `reserved | paid | cancelled | checked-in`.

**Update every consumer that reads `stripePaymentIntentId`:**
- `app/api/admin/tickets/route.ts`
- `app/api/admin/checkin/route.ts`
- `app/admin/page.tsx`
- `docs/firestore-ticket-schema.md` (field table, TS block, and the "confirmed via Stripe" prose in the lifecycle section)

After F1, `grep -r stripePaymentIntentId` across `types app docs lib` must return nothing.
See `ticket-reserved.golden.json` and `ticket-paid.golden.json` for the exact expected doc shapes.

---

## F2 — PayFast checkout initiation route

**New shared lib `lib/payfast.ts`** (pure, unit-testable, imported by F2 and F3):
- `generateSignature(fields: Record<string, string>, passphrase?: string): string`
  Build `key=urlencode(value)` for each NON-EMPTY field **in insertion order**, join with `&`,
  append `&passphrase=urlencode(passphrase)` only when a passphrase is set, then MD5 → lowercase hex.
  Use `crypto.createHash('md5')`. URL-encoding must match **PHP urlencode** (spaces→`+`, `~`→`%7E`),
  NOT `encodeURIComponent`. **[VERIFY]** the `~` / `()!*'` edge cases against PayFast's spec.
  Must reproduce all three vectors in `signature-vectors.json` exactly.
- Export the sandbox endpoints and host list (see `payfast-hosts.golden.json`).

**New route `app/api/tickets/checkout/route.ts` (POST):**
1. Parse + fail-fast validate body: `{ showId, ticketType, attendeeName, attendeeEmail }` (see `checkout-request.golden.json`). **Amount is NOT accepted from the client.**
2. Derive `amount` from a **server-side price map** keyed by `ticketType`. Use placeholder prices, flagged with a `// PLACEHOLDER PRICING` comment and logged to `.agent/memory/project/needs-human.md`. Never trust a client amount.
3. Read credentials from `process.env.PAYFAST_SANDBOX_MERCHANT_ID`, `PAYFAST_SANDBOX_MERCHANT_KEY`, `PAYFAST_SANDBOX_PASSPHRASE`. Fail-fast (500 + logged error) if any are missing. **Never hardcode them** — the sandbox test key `46f0cd694581a` must not appear in source.
4. Generate `bookingRef` = `m_payment_id` (e.g. `SAOC-2027-<6 digits>`).
5. `initAdmin()` → `getFirestore()` → create the `tickets` doc in `status: 'reserved'`, `pf_payment_id: null`, `purchasedAt: null`, `amount`, `m_payment_id` (shape = `ticket-reserved.golden.json`).
6. Build the PayFast fields (`merchant_id, merchant_key, return_url, cancel_url, notify_url, m_payment_id, amount, item_name`), `amount` formatted to exactly 2 decimals, compute `signature` LAST.
7. Return HTTP 201 `{ bookingRef, processUrl: 'https://sandbox.payfast.co.za/eng/process', fields }` (shape = `checkout-response.golden.json`).

**[VERIFY]** exact required field set and their signing order at developers.payfast.co.za (Custom Integration → building the form / signature).

---

## F3 — ITN (Instant Transaction Notification) handler — SECURITY BOUNDARY, FAIL CLOSED

**New route `app/api/tickets/itn/route.ts` (POST)**, body is `application/x-www-form-urlencoded`.
Parse into an ordered map preserving received order. Then run ALL of these — **any failure = log and STOP, leave the ticket in `reserved`. Never mark paid on an unverified notification:**

1. **Signature** — recompute `generateSignature(receivedFields_without_signature, passphrase)` in the exact received order and compare to the posted `signature`. Mismatch → reject. (Vector: `itn_with_passphrase` in `signature-vectors.json`.)
2. **Source IP** — resolve the PayFast hosts (`payfast-hosts.golden.json`) via `dns.promises.lookup` at request time and confirm the request source IP is one of them. Do NOT hardcode IPs. **[VERIFY]** the host list.
3. **Amount match** — look up the reserved ticket by `m_payment_id`; require `Math.abs(Number(amount_gross) - ticket.amount) < 0.01`. Mismatch → reject.
4. **Server confirmation** — POST the received data back to `https://sandbox.payfast.co.za/eng/query/validate` and require the response body to equal `VALID`. Anything else → reject. **[VERIFY]** endpoint path.

Only when **all four pass AND `payment_status === 'COMPLETE'`**: update the doc → `status: 'paid'`, `pf_payment_id` from the ITN, `purchasedAt: Timestamp.now()` (shape = `ticket-paid.golden.json`).
- **Idempotency:** if the ticket is already `paid`, do nothing and return 200.
- **Response to PayFast:** return HTTP 200 on receipt so PayFast stops retrying; validation failures still return 200 but DO NOT update the ticket. **[VERIFY]** PayFast's expected response-code behaviour.
- **Logging:** every rejection path logs which check failed (no secrets/PII in logs). firebase-admin only.

---

## Signature unit gate

@dev writes `scripts/verify-payfast-signature.ts` (run with `tsx`, already a dev dep) that imports
`generateSignature` from `lib/payfast.ts` and asserts it reproduces all three `expected_signature`
values in `signature-vectors.json`, exiting non-zero on any mismatch. The contract runs it as a gate.
This is the single most important correctness check — a wrong signature breaks checkout AND every ITN.

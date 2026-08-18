# Ticketing Position Expiry Write — P1 Live Bug Fix

**Contract:** `.agent/memory/project/specs/ticketing-position-expiry-write/contract-f1.yaml`
(4 assertions). Gated green, and passed an independent Codex GPT-5.5 cross-model review in
addition to `@qa`.

**Status:** fixed and covered by the contract. **The fix is forward-looking only** — see
[Known open item: four stranded positions](#known-open-item-four-stranded-positions-still-need-a-backfill)
below. This document does not repeat the general ticketing flow covered in
[docs/ticketing.md](ticketing.md) or the capacity/idempotency hardening in
[docs/ticketing-hardening.md](ticketing-hardening.md) — read those first for context.

---

## The defect

`RESERVATION_TTL_MINUTES` (`lib/tickets-constants.ts`) is supposed to make an abandoned
reservation release its seat automatically. That relies on `stillHoldsSeat()`
(`lib/data/tickets.ts`) reading an `expiresAt` field off the `tickets/{bookingRef}` position
document — the same document `getSoldCountsByTicketType` iterates to count sold seats.

`expiresAt` was being written onto the `orders/{orderId}` document, but **never onto the
position document** in the `tickets` collection:

- `lib/checkout-reservation.ts`'s `buildReservationDocs` — the live checkout path's primitive —
  set `expiresAt: input.expiresAt` on the `order` object it builds, but never on the sibling
  `position` object.
- `lib/orders.ts`'s `createOrderWithPosition` — the shared primitive comp tickets and future
  features build on — had the identical omission.

`stillHoldsSeat()`'s own documented fail-closed rule is: no `expiresAt` field on the document →
return `true` → the seat is held, unconditionally. That rule is doing exactly what it was built
to do ("a writer that forgets the field cannot silently release seats") — the writer that forgot
the field is the bug. The practical effect: **every reserved position held its seat forever**,
regardless of `RESERVATION_TTL_MINUTES`, whether or not the buyer ever paid. A ticket type could
read as sold out on the public `/tickets` page purely from abandoned carts nobody paid for, with
no mechanism to recover the seats short of a human manually deleting Firestore documents.

This was discovered on 2026-08-18/19 while implementing `order-reconciliation`'s own negative
control (an expired-but-unalerted reservation must still release its seat) — that control failed,
and tracing it back to Firestore showed the position document had no `expiresAt` field at all.

## The fix

Three additive, mechanical changes — nothing in `lib/data/tickets.ts` changed, since
`stillHoldsSeat` already read `expiresAt` off whatever document it was given:

1. **`types/index.ts`** — `Ticket.expiresAt?: Timestamp | null` added (mirroring
   `Order.expiresAt`'s existing type). Optional/nullable because every pre-fix position, and
   every `paid`/`cancelled`/`checked-in`/`refunded` position this codebase has ever written,
   legitimately has none.
2. **`lib/checkout-reservation.ts`** `buildReservationDocs` — `expiresAt: input.expiresAt` added
   to the `position` object, reusing the exact same input field the `order` object already
   consumed. No signature change.
3. **`lib/orders.ts`** `createOrderWithPosition` — the identical one-line addition to its
   `position` object, fixing the same defect class in the sibling primitive before a future
   feature (e.g. comp tickets) reserves through it and reproduces the bug a third time.

## Verification

- **A1** (`pnpm exec next build`) — compiles with the new field and both one-line additions.
- **A2** — against the real, imported `buildReservationDocs`: the returned
  `position.expiresAt` is the **exact same `Timestamp` instance** as `input.expiresAt`, not
  `undefined` and not a freshly minted one. This rules out a version that mints a new
  `Timestamp.now()` for the position instead of reusing the order's value — position and order
  must expire at literally the same instant.
- **A3** — the identical exact-equality proof against `createOrderWithPosition`, run
  independently against `lib/orders.ts`. This exists specifically because the two files are
  near-duplicates of each other — that similarity is exactly how the bug happened twice, so
  fixing only `checkout-reservation.ts` and forgetting `orders.ts` would slip past A2 alone.
- **A4** — the live regression proof: writes one real reservation through the real
  `buildReservationDocs` + `writeReservationPair` with `expiresAt` a few seconds in the past,
  reads the position back from Firestore to confirm `expiresAt` survived the round trip as a real
  `Timestamp` (not a plain `Date`, which `stillHoldsSeat`'s `instanceof Timestamp` check would
  silently reject), then asserts `getSoldCountsByTicketType` does **not** count it.

## Load-bearing: `stillHoldsSeat`'s branch order must not be refactored casually

```ts
export function stillHoldsSeat(data: FirebaseFirestore.DocumentData): boolean {
  if (data['status'] !== RESERVED_STATUS) return true;
  if (data['reconciliationAlertedAt']) return true;
  const expiresAt = data['expiresAt'];
  if (!(expiresAt instanceof Timestamp)) return true;
  return expiresAt.toMillis() > Date.now();
}
```

The first check — `status !== 'reserved'` returns `true` **before** expiry is ever read — is
what makes a `paid` (or `checked-in`) position impossible to release, no matter how far in the
past its `expiresAt` is. Refusing entry to, or silently un-selling the seat of, someone who
actually paid is worse than an oversell of one. Reordering these checks (e.g. checking expiry
first "for efficiency") would reintroduce exactly the class of bug this fix closes for reserved
positions, on paid ones instead. Do not reorder this without re-reading
[docs/ticketing-hardening.md](ticketing-hardening.md#f5-abandoned-checkouts-consumed-a-seat-permanently-s1-high),
which documents the same guarantee from the other direction (F5/F23).

## Known open item: four stranded positions still need a backfill

**This fix is forward-looking only.** It makes every *new* reservation write `expiresAt` onto
its position correctly. It does **not** touch any position already sitting in Firestore. Four
real, live positions written before this fix still have no `expiresAt` on their position
document and, under `stillHoldsSeat`'s existing fail-closed rule, still hold their seats
indefinitely:

- `SAOC-2027-5KYDSBMT38KX`
- `SAOC-2027-7HHE9QN51RH4`
- `SAOC-2027-G08QJQK278NY`
- `SAOC-2027-R06HZ12P06EY`

These are the same four orders `order-reconciliation` (see
[docs/order-reconciliation.md](order-reconciliation.md)) detects and alerts on — that feature
flags them for a human, it does not release or backfill their seats either (see that document's
"never auto-settle" scope decision). Backfilling `expiresAt` onto these four pre-fix positions —
or otherwise deciding their fate — is an explicitly separate data-cleanup task, not covered by
either contract. Do not write around this by relaxing `stillHoldsSeat`'s fail-closed rule; fix it
by giving these specific documents a real `expiresAt` (or another deliberate resolution) once a
human has looked at them.

## Files changed

- `types/index.ts` — `Ticket.expiresAt?: Timestamp | null` added
- `lib/checkout-reservation.ts` — `buildReservationDocs`'s `position` object now sets
  `expiresAt`
- `lib/orders.ts` — `createOrderWithPosition`'s `position` object now sets `expiresAt`

## Sources

- `.agent/memory/project/specs/ticketing-position-expiry-write/contract-f1.yaml` — the scored
  contract, all 4 assertions
- `.agent/memory/project/specs/ticketing-position-expiry-write/goldens/README.md` — full defect
  analysis, false-pass-risk table per assertion, and the scope decision to ship this as its own
  contract rather than folding it into `order-reconciliation`

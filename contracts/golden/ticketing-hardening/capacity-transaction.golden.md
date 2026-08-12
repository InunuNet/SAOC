# Golden — capacity enforcement must be transactional

## The defect being fixed

`app/api/tickets/checkout/route.ts` counts sold tickets and then writes the reservation
with nothing between the two — a textbook read-then-write TOCTOU. @qa reproduced it
live: a type at 49/50 hit with 5 concurrent POSTs returned 201 five times, ending at
54/50. It fails exactly when a popular type is selling out, which is when concurrent
buyers are likeliest.

## Required behaviour

For any ticket type with capacity `C` and `H` seats already held (`reserved` + `paid`,
the rule `lib/data/tickets.ts` already uses), with `N` concurrent checkout POSTs:

- the number of successful reservations is exactly `min(N, C - H)`;
- the held count after the dust settles is never greater than `C`;
- every refused request returns HTTP 409 with the Sanity-sourced `soldOutMessage` (the
  existing behaviour — no new copy).

Anything less than "never greater than `C`" is a fail. "Usually correct" is a fail.

## Required shape

Wrap the count and the reservation write in a single `db.runTransaction()`:

1. **Outside** the transaction (unchanged): validate the body, fetch `salesOpen`, fetch
   the ticket type from Sanity, derive `amount` from Sanity. Never call Sanity, PayFast
   or any other network service from inside the transaction — Firestore retries the
   transaction body, and an external call inside it would be re-issued.
2. **Inside** the transaction, in this order (Firestore requires all reads before any
   write):
   - read the held count for `(showId, ticketType)`;
   - read the idempotency probe (see `idempotency-and-booking-ref.golden.md`);
   - decide; if over capacity, return a sentinel from the transaction body and let the
     caller respond 409 — do not throw for ordinary business outcomes;
   - `transaction.create()` the reservation document.

Keep `getSoldCountsByTicketType` in `lib/data/tickets.ts` as the single counting path —
`/tickets` uses it for its sold-out badges and a second, divergent counter is how badge
and gate drift apart. Extend it to accept an optional `Transaction` and use
`transaction.get(query)` when one is supplied, rather than forking a new helper.

## If the query-in-transaction approach does not hold

Firestore server-SDK transactions are documented as serializable, so a query read plus a
create inside one transaction is expected to be sufficient. The assertion is a real
concurrency test, so this is settled empirically, not by argument. If it still oversells,
the fallback is a per-`(showId, ticketType)` counter document incremented inside the same
transaction, with `getSoldCountsByTicketType` remaining the source of truth for display
and the counter reconciled from it at write time. Take the fallback only if the
concurrency assertion actually goes red — a counter introduces a second source of truth
and drift risk, and should not be added speculatively.

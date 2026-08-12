# Reservation expiry — golden (round 2, S1)

Closes **S1 (HIGH)**: an abandoned checkout consumes a seat permanently. Reservations are
authoritative against capacity (correct — that is the round-1 fix) but nothing ever
releases one. 50 abandoned exhibitor carts sell the show out forever at zero revenue.

## The mechanism: lazy expiry, no sweeper

A reservation carries an **`expiresAt` Firestore `Timestamp`**, written at creation.
Capacity counts `paid` unconditionally, plus `reserved` documents whose `expiresAt` is
still in the future. An expired reservation stops consuming capacity the instant it
expires — **no cron job, no Cloud Scheduler, no background sweep, and no status write.**

This is deliberate. A sweeper that flips `reserved → cancelled` would be a second writer
racing the ITN, and it is the obvious way to produce the catastrophe this golden guards
against: a paid or checked-in ticket cancelled by a background job. Lazy expiry is
evaluated *inside the existing capacity transaction*, so it is race-free by construction
and has exactly one writer (the ITN) as today.

`'cancelled'` in `types/index.ts` stays unwritten by any route. Do not start writing it
as part of this fix.

## Constants

`lib/tickets-constants.ts` (already client-safe — no firebase-admin/Sanity imports):

```ts
/** How long an unpaid reservation holds its seat. Must comfortably exceed the time a
 *  buyer needs at PayFast; 30 minutes is ~10x the observed sandbox round-trip. */
export const RESERVATION_TTL_MINUTES = 30;
```

## Write side — `app/api/tickets/checkout/route.ts`

The `transaction.create(...)` payload gains one field:

```ts
expiresAt: Timestamp.fromMillis(Date.now() + RESERVATION_TTL_MINUTES * 60_000),
```

Every reservation this route creates MUST carry it. `A24` proves that over real HTTP.

## Count side — `lib/data/tickets.ts`

`getSoldCountsByTicketType` keeps its two queries and its single-counting-path property.
The change is a filter applied to the **`reserved` snapshot only**:

- `status === 'paid'` → **always counts.** Never filtered by `expiresAt`, under any
  circumstance. A paid ticket carrying a long-past `expiresAt` (its reservation window
  elapsed before the ITN landed) still holds its seat.
- `status === 'reserved'` **and** `expiresAt` is a Timestamp in the past → **does not
  count.**
- `status === 'reserved'` **and** `expiresAt` is absent or null → **counts.** Fails
  closed on capacity. Pre-expiry documents and any future writer that forgets the field
  must not silently release seats; `A24` is what catches the forgetful writer, not a
  permissive default here.

**Filter in memory, not in the query.** `.where('expiresAt', '>', now)` alongside the
existing two equality filters requires a composite index that does not exist in this
project and would have to be deployed before the code works. The reserved set is bounded
by ticket-type capacity plus accumulated expired holds; an in-memory filter over that is
correct, index-free, and identical in outcome.

Do NOT introduce a second counting path. `/tickets` badges and the checkout gate must
keep reading the same function, or they drift.

## Accepted trade-off: a payment that lands after expiry still wins

If a buyer completes payment at PayFast after the TTL elapses, the ITN finds a
`reserved` ticket and flips it to `paid` — even if the seat has meanwhile been re-counted
to someone else. That can oversell by one.

This is the correct outcome and is chosen deliberately: taking someone's money and then
refusing them at the door is worse than an oversell of one seat that an operator can
reconcile. A 30-minute TTL makes it rare. Do not add an expiry check to the ITN write
path.

## Rejected: releasing the seat from the PayFast `cancel_url`

`/tickets/cancelled?ref=…` is unauthenticated and reached with nothing but a booking
reference. Giving it a Firestore write would create an unauthenticated mutation endpoint
keyed on a value that is printed on the ticket — anyone holding a photo of a reference
could release that reservation. The only benefit is shortening a 30-minute hold that
already releases itself. **Leave `/tickets/cancelled` render-only.**

## Assertions

| id | proves | kind |
|----|--------|------|
| A21 | an expired reservation does not consume capacity | behavioural |
| A22 | a live reservation still does consume capacity | behavioural |
| A23 | a `paid` ticket with a past `expiresAt` still counts AND is never mutated | behavioural |
| A24 | the real route writes a future `expiresAt` inside the TTL window | behavioural |

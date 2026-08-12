# Capacity and price validation — golden (round 2, S3 + S5)

## S3 — the capacity guard fails OPEN (with a correction to @qa's mechanism)

@qa reported `alreadyHeld + 1 > input.capacity` failing open because
`50 > undefined === false`. **That is true as JavaScript but is not the value the route
receives, and the reported reproduction does not hold.** Measured against the real Sanity
API on 2026-08-11: GROQ projects a *missing* attribute as `null`, not as an absent key, so
`ticketTypeDoc.capacity` is `null`, `1 > null` is `1 > 0`, and an absent capacity **409s
today**. A29's absent-capacity sub-case is green.

**The fail-open is real, and reachable by a different value.** Sanity does not enforce
field types at the API level, and `scripts/seed-*.ts` and the HTTP API both bypass Studio
validation. Measured: with `capacity: "50"` (a string), `1 > "50"` is `false` and the
checkout returns **201 against an unlimited ledger** — the full silent oversell, just
through a door @qa did not try. `NaN` behaves the same way. That is what A29 asserts.

The fix below closes both, and does not depend on which coercion happens to be in play.

`sanity/schemas/documents/ticketType.ts:26` currently carries the description

> "Must be set — a blank capacity reads as sold out at checkout (fails closed)."

**That sentence must still be deleted** — for a subtler reason than @qa gave. It happens
to describe the `null` case correctly, by accident, and that accident is the problem: it
generalises a coincidence of JavaScript coercion into a stated guarantee, and the
guarantee is false the moment the value is a string or `NaN`. A reader who trusts it will
not add the explicit check below. Sanity `validation:` is a Studio-authoring guard, not a
read-time guarantee — `scripts/seed-ticketing.ts` and the Sanity HTTP API both write
documents that never see it. Keep `Rule.required().integer().min(0)`; it is useful, it is
just not a guarantee. Replace the description with something true:

```
description: 'Required. Enforced again at checkout — a ticket type with no capacity cannot be sold.'
```

## S5 — a blank price commits a seat then 500s forever

`price` has no validation at all. With `price: null`, `reserveTicket` **commits the
reservation**, then `amount.toFixed(2)` throws outside the try/catch → uncaught 500. The
seat is held, the idempotency key is burned, and the buyer's retry replays into the
identical crash. Add to the `price` field:

```ts
validation: (Rule) => Rule.required().min(0),
```

(no `.integer()` — ZAR prices may carry cents.)

## The read-time guard — this is the load-bearing half

Both fields come from Sanity at request time, and Sanity validation does not run on that
path. `app/api/tickets/checkout/route.ts` must reject an unusable ticket type **before
any Firestore write**, immediately after `ticketTypeDoc` is fetched and found non-null
and before `reserveTicket` is called:

```ts
// Sanity `validation:` is a Studio-authoring guard, not a read-time guarantee — the seed
// script and the HTTP API both write documents that never see it. A missing capacity
// previously compared as `held > undefined === false` and oversold silently; a missing
// price committed the reservation and then threw on `amount.toFixed(2)`, holding the seat
// and burning the idempotency key on every retry. Reject before anything is written.
function isUsableAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

if (!isUsableAmount(ticketTypeDoc.capacity)) { /* 500, log the slug + 'capacity' */ }
if (!isUsableAmount(ticketTypeDoc.price)) { /* 500, log the slug + 'price' */ }
```

The `typeof === 'number'` half is load-bearing twice over. At runtime it is what rejects
the string `"50"` that actually reproduces the oversell. At compile time it is what
narrows `unknown` to `number`; **`Number.isFinite` alone does not narrow** (verified with
`tsc --strict`, 2026-08-11: `Type 'unknown' is not assignable to type 'number'`), so
without it A18 fails or someone reaches for a cast.

The predicate rejects `undefined`, `null`, `NaN`, `Infinity`, negatives **and the string
`"50"`** — the value that actually reproduces the oversell. A bare truthiness check would
instead wrongly reject the legitimate values `0` (the exhibitor price) and a capacity of
`0`. Do not `Number(...)`-coerce first: `Number("50")` is `50`, which re-opens exactly the
case A29 measures.

Response: **HTTP 500** with a generic operator-facing message
(`'This ticket type is not available for purchase. Please contact us.'`) and a
`console.error` naming the slug and which field is bad. 500, not 400 — the request was
well-formed; the CMS document is misconfigured, and a 4xx would tell the buyer to fix
something they cannot see.

Widen the interface so the compiler stops asserting these are numbers:

```ts
// Not `number` — Sanity does not enforce field types at the API level, so a document
// written by the seed script or the HTTP API can carry a string or null here. Typing
// these as `number` is the assertion that produced the defect.
interface SanityTicketType {
  _id: string;
  name: string;
  price: unknown;
  capacity: unknown;
}
```

`unknown`, not `number | null`: the measured fail-open value was a *string*, and
`number | null` would let the compiler go on insisting a string cannot appear. The
`isUsableAmount` type predicate above is what narrows it back to `number`.

`ReservationInput.capacity` and `.amount` stay `number` — the validation above is what
makes that true, and `reserveTicket` must never be reachable with anything else.

## Assertions

| id | proves | kind |
|----|--------|------|
| A29 | a ticket type with no `capacity` → checkout refuses, **zero** tickets written | behavioural |
| A30 | the false "fails closed" claim is gone from the schema description | structural — Studio-only surface, no runtime |
| A31 | a ticket type with `price: null` → checkout refuses, **zero** tickets written | behavioural |
| A32 | `price` carries `Rule.required().min(0)` | structural — Studio-only surface, no runtime |

A29 and A31 create a temporary sentinel `ticketType` document in Sanity, poll the CDN
until it is visible, exercise the real HTTP route, then delete it and poll until it is
gone. The document is named `ZZ DO NOT SELL — automated check` and is visible on
`/tickets` for the duration, exactly as A6's fill window already is.

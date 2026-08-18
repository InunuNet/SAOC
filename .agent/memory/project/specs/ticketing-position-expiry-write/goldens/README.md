# Golden — reserved positions never carry expiresAt; lazy release never fires

## The defect, and how it was found

Found 2026-08-18/19 by @dev while implementing
`ticketing-capacity-reconciliation-hold` F1: its A4 negative control ("an
expired-but-unalerted reservation MUST still release its seat") failed, and tracing it
by reading the fixture back from Firestore showed the `tickets/{id}` position document
has **no `expiresAt` field at all**.

`lib/data/tickets.ts`'s `stillHoldsSeat()` reads ONLY the `tickets` collection (never
`orders`), and its own documented fail-closed rule is: no `expiresAt` field on the
document -> return `true` -> the seat is held, unconditionally. That rule exists on
purpose ("a writer that forgets the field cannot silently release seats") — it is doing
exactly what it was built to do. The writer that forgot the field is the bug.

Both of this codebase's position-writing primitives have it:

- `lib/checkout-reservation.ts` `buildReservationDocs` — the LIVE path; every real
  checkout's position ever written goes through this. Its `order` object sets
  `expiresAt: input.expiresAt` (line ~56); its `position` object never mentions
  `expiresAt` at all.
- `lib/orders.ts` `createOrderWithPosition` — the shared primitive F8 (comp tickets)
  and future features build on. Same shape, same omission (`order.expiresAt =
  input.expiresAt` at line ~130, `position` never sets it). Not exercised by today's
  checkout path (comp positions are written `paid`, which short-circuits
  `stillHoldsSeat` before the `expiresAt` check ever runs), but it is the same defect
  class and will bite the next feature that reserves through this primitive if left
  unfixed here.

## Production consequence

`RESERVATION_TTL_MINUTES = 30` (`lib/tickets-constants.ts`) is inert for capacity
counting. Every `reserved` position holds its seat forever, whether or not the buyer
ever pays. A ticket type can read as sold out on the public `/tickets` page purely from
abandoned carts nobody paid for, with no mechanism to recover the seats short of a human
manually deleting Firestore documents. This is live in production today — worse than
the gap `ticketing-capacity-reconciliation-hold` set out to close, and it is the reason
that contract's A4 could not actually observe a release/hold distinction: in the current
system, EVERY reserved position is already held regardless of alert status, so nothing
in that contract can be verified until this is fixed.

## Scope decision (asked of @architect, decided here)

Two ways to sequence this were considered: fold the fix into
`ticketing-capacity-reconciliation-hold`, or ship it as its own contract that the hold
contract depends on. **Decided: separate contract**, because the defect and its fix
(`checkout-reservation.ts` / `orders.ts`, the position-write primitives) are unrelated
in *mechanism* to the reconciliation-hold feature (`stillHoldsSeat`'s
`reconciliationAlertedAt` branch, `lib/reconciliation.ts`) even though they are related
in *effect* — mixing them would blur two independently-reviewable assertion surfaces
into one contract's changelog, contrary to this project's minimal-scope rule. They ARE
sequenced: `ticketing-capacity-reconciliation-hold`'s A4 cannot pass, and its feature has
no observable effect in production, until this contract ships first. Track that
ordering in the backlog entry, not by merging the contracts.

## Required changes

1. **`types/index.ts`** — add `expiresAt?: Timestamp | null` to the `Ticket` interface
   (near `checkedInAt`), mirroring `Order.expiresAt`'s existing type. Optional/nullable:
   pre-fix positions in Firestore, and every `paid`/`cancelled`/`checked-in`/`refunded`
   position this codebase ever writes, legitimately have none.

2. **`lib/checkout-reservation.ts` `buildReservationDocs`** — add `expiresAt:
   input.expiresAt` to the `position` object (same input the `order` object already
   consumes at line ~56 — no new parameter, no signature change, just also assigning it
   to the second object).

3. **`lib/orders.ts` `createOrderWithPosition`** — same one-line addition to its
   `position` object (line ~130's sibling): `expiresAt: input.expiresAt`. Same input
   field, already threaded through `CreateOrderPositionInput`, just not applied to the
   position today.

Nothing else changes. `stillHoldsSeat`'s existing expiry-comparison logic (and, once
`ticketing-capacity-reconciliation-hold` ships, its `reconciliationAlertedAt` branch)
already read `expiresAt` off whatever document they're given — they start working
correctly on positions the instant those positions actually carry the field. No change
to `lib/data/tickets.ts` is needed here.

## Assertions — what each proves and what false state would still pass it

- **A1** (`pnpm exec next build`): compiles. False-pass risk: none realistic; A2-A4
  exist to prove correctness.

- **A2** (pure, `npx tsx`, imports the REAL `buildReservationDocs`): given a
  `BuildReservationDocsInput` with a concrete `expiresAt` Timestamp, the returned
  `docs.position.expiresAt` equals that same Timestamp (not `undefined`, not a
  different value, not silently dropped). False-pass risk: a version that sets
  `position.expiresAt` to a NEW `Timestamp.now()` instead of `input.expiresAt` would
  pass a "the field exists" check but is caught by the exact-equality check here — the
  position and order must expire at literally the same instant, not merely both have
  *some* expiry.

- **A3** (fake-store, `npx tsx`, imports the REAL `createOrderWithPosition` with an
  injected `deps.db`, no live Firestore): same equality proof as A2, for the
  `lib/orders.ts` primitive — proves the fix was applied to both position-writing
  primitives, not just the one the live checkout path currently uses. False-pass risk:
  fixing only `checkout-reservation.ts` and forgetting `orders.ts` (the two files look
  almost identical, that's exactly how the original bug happened twice) is caught by
  this running against `orders.ts` specifically, independent of A2.

- **A4** (live, sentinel-tagged, `npx tsx`, reusing
  `contracts/checks/ticketing-hardening/_shared.mjs`'s fixture/lock/sweep
  infrastructure — same technique as `ticketing-capacity-reconciliation-hold`'s A4):
  performs one real reservation write through `buildReservationDocs` +
  `writeReservationPair` with `expiresAt` set a few seconds in the past (not 30 minutes
  — this check must not need to sleep for the real TTL), then asserts the REAL
  `getSoldCountsByTicketType` does NOT count it. This is the actual regression proof:
  it is `ticketing-capacity-reconciliation-hold`'s A4 negative control, lifted out and
  run standalone so it can pass on its own before that contract's feature is even
  built. False-pass risk: a version that writes `expiresAt` onto the position but as
  the wrong type (e.g. a plain JS `Date` instead of a Firestore `Timestamp`) would fail
  `stillHoldsSeat`'s `expiresAt instanceof Timestamp` check silently (falls through to
  "no usable expiresAt -> held") — caught here because the live read-back goes through
  the real Firestore round-trip (Dates and Timestamps do not survive that trip
  interchangeably), not a fake store that might coerce types leniently.

## Explicitly out of scope

- The `reconciliationAlertedAt` hold behaviour — that is
  `ticketing-capacity-reconciliation-hold`'s F1, unaffected by this contract except that
  its A4 now has a working precondition to test against.
- Backfilling `expiresAt` onto pre-fix `reserved` positions already sitting in
  Firestore. Any such document still fails closed (holds its seat) under the *existing*
  "no expiresAt -> true" rule — same posture as today, not a new problem this contract
  creates or need resolve. If stale reserved positions with no real buyer intent turn
  out to be sitting in production, that is a data cleanup task for whoever owns
  `order-reconciliation`'s eventual settle/cancel phase, not this contract.

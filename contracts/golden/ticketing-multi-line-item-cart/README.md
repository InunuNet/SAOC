# Multi-line-item cart — decision record

Mission `multi-line-item-cart`, F1/F2. Stage 2 of `Plans/valiant-squishing-thimble.md`. Extends
`app/api/tickets/checkout/route.ts` from exactly one `ticketType` + one attendee per request to N
line items, reserved atomically across several ticket types in one Firestore transaction, with
idempotency-key replay behaviour intact for N items. This document is the full decision record:
every judgement call, every assertion's named defeating mutation, what this contract does and does
NOT prove, and the gaps it deliberately leaves open with reasons.

---

## The gap, as specified

`CheckoutRequestBody` (`app/api/tickets/checkout/route.ts:139-163`) is `{ showId, ticketType,
attendeeName, attendeeEmail }` — exactly one ticket type, one attendee, per POST. The `Order` ->
positions model (`types/index.ts`, `lib/checkout-reservation.ts`) already supports N positions per
order; nothing in checkout ever writes more than one. A buyer wanting an Early-Bird ticket AND a
Weekend Pass today must complete two entirely separate checkouts, two separate PayFast payments,
two separate idempotency keys — this contract closes that gap.

---

## F1 — `lib/checkout-reservation.ts`, additive new exports

The existing single-item exports (`buildReservationDocs`, `writeReservationPair`,
`BuildReservationDocsInput`, `ReservationDocs`, `CreateCapableTransactionLike`,
`PAYFAST_GATEWAY`) are **UNCHANGED** — every assertion in `ticketing-checkout-orders`'s contract
stays green untouched, and nothing calls these single-item functions from checkout after this
contract lands (see "Why the single-item builder is not deleted" below).

New, additive exports:

```ts
export interface CheckoutLineItemInputLike {
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
}

export interface LineItemPlan {
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
  /** Server-derived from Sanity per ticketType — never the request body. */
  amount: number;
  /** This position's OWN door code — distinct per line item, always. */
  bookingRef: string;
}

/** Pure. Sums requested quantity per ticket type across the whole cart — the step a naive
 *  per-line-item loop skips, which is exactly how two line items of the same type both pass
 *  an unaccumulated "1 more fits" check against a capacity of 1. */
export function aggregateRequestedQuantities(
  lineItems: { ticketType: string }[]
): Record<string, number>;

/** Pure. All-or-nothing capacity decision across every DISTINCT ticket type in the cart.
 *  Returns EVERY offending type, not just the first, so the caller can report the whole
 *  picture rather than a single opaque "something didn't fit". */
export function planCapacity(input: {
  requestedQtyByType: Record<string, number>;
  soldCountsByType: Record<string, number>;
  capacityByType: Record<string, number>;
}): { kind: 'ok' } | { kind: 'over-capacity'; ticketTypes: string[] };

/** Pure. Order-independent multiset equality between a replayed request's line items and the
 *  positions an idempotency key already produced. Both COUNT and CONTENT must match — a
 *  first-item-only comparison (the literal, laziest port of today's `.limit(1)` duplicate
 *  probe) is exactly the defect this exists to rule out. */
export function lineItemsMatchExistingPositions(
  requested: { ticketType: string; attendeeEmail: string }[],
  existing: { ticketType: string; attendeeEmail: string }[]
): boolean;

export interface BuildMultiReservationDocsInput {
  orderId: string;
  /** Order-level payment reference. Decision: this is the FIRST line item's own
   *  `bookingRef` — see "Why the order reference is the first line item's bookingRef, not a
   *  new identifier" below. */
  reference: string;
  showId: string;
  lineItems: LineItemPlan[];
  idempotencyKey: string;
  expiresAt: Timestamp;
  recoveryToken: string;
  recoveryTokenExpiresAt: Timestamp;
  now: Timestamp;
}

export interface MultiReservationDocs {
  order: Omit<Order, 'id'>;
  positions: (Omit<Ticket, 'id'> & { idempotencyKey: string })[];
}

export function buildMultiReservationDocs(input: BuildMultiReservationDocsInput): MultiReservationDocs;

/** Same create()-and-fail-on-collision semantics as writeReservationPair(), reusing the SAME
 *  CreateCapableTransactionLike interface — order first, then every position in
 *  `lineItems` order. */
export function writeMultiReservationPair(
  transaction: CreateCapableTransactionLike,
  refs: { orderRef: { id: string }; positionRefs: { id: string }[] },
  docs: MultiReservationDocs
): void;
```

`buildMultiReservationDocs` field mapping, the parts that are NOT a mechanical scale-up of the
single-item builder:

- `order.amount` = sum of every `lineItems[i].amount` — never a client-supplied total.
- `order.m_payment_id` = `input.reference`.
- `order.buyerName` / `order.buyerEmail` = `lineItems[0].attendeeName` / `lineItems[0].attendeeEmail`
  — see "Buyer identity for a multi-item order" below.
- Each `positions[i].m_payment_id` = `input.reference` (the SHARED order reference, not that
  position's own bookingRef) — a deliberate change from the single-item shape, where
  `position.m_payment_id === position's own bookingRef` because there was only one position. See
  "Why every position shares m_payment_id" below.
- Each `positions[i]` otherwise mirrors the single-item shape exactly: own `bookingRef` as its doc
  id, own `ticketType`, own `attendeeName`/`attendeeEmail`, own `amount` (that line item's price,
  not the order total), `idempotencyKey` carried additively (same posture as F1 of
  `ticketing-checkout-orders`).

### Why the single-item builder is not deleted

`buildReservationDocs`/`writeReservationPair`/`ReservationDocs` are the subject of
`ticketing-checkout-orders`'s own A2/A3 — a compiler-driven typecheck fixture and a live-executed
atomicity check, both already green and both asserting this EXACT call shape. Deleting or
repurposing them to accept an array would break that contract's gate for a benefit (avoiding one
extra, nearly-identical function) that doesn't materialise: the two functions differ in exactly the
fields named above, and forcing checkout's new N-item call sites through a single-item-shaped
function with `lineItems: [x]` would still need a second, N-item-shaped function for N>1 — so
nothing is saved by merging them, and something (a green, already-shipped gate) is put at risk.
Same reasoning `ticketing-checkout-orders`'s own README already applied one level down (new sibling
module rather than widening `lib/orders.ts`) is applied again here, one level further in.

### Why the order reference is the first line item's own bookingRef, not a new identifier

The tempting "clean" design mints a genuinely new, third kind of reference — distinct from every
position's bookingRef — purely for the order. Rejected. That would change client-facing behaviour
for the ALREADY-LIVE, ALREADY-PROVEN single-item purchase path too: today, for a one-ticket
checkout, the value returned to the client as `bookingRef`, used in the PayFast `m_payment_id`, the
`return`/`cancel`/`notify` URLs, and the value `getConfirmedTicketForDisplay()`
(`lib/orders.ts`) looks up directly as `tickets/{bookingRef}`, are all the SAME string. Inventing a
separate order-level identifier would make that no longer true even for N=1 — breaking the
confirmation page for every purchase, not just multi-item ones, the day this ships. Pinning
`reference = lineItems[0].bookingRef` instead means:

- **N=1 is byte-for-byte unchanged.** The one line item's bookingRef, the order's `m_payment_id`,
  and the confirmation-page lookup key are still one and the same value, exactly as
  `ticketing-checkout-orders` and the live-proven purchase already established.
  `getConfirmedTicketForDisplay(reference)` still resolves — because `reference` IS a real
  position's own document id — and still shows that one ticket's QR/attendee/type exactly as
  today.
- **N>1 degrades gracefully, not silently.** For a 3-item order, `reference` is position 1's
  bookingRef; positions 2 and 3 exist, are correctly linked (`orderId`), are correctly reservable
  and correctly payable (see F2 below), and are each independently scannable at the door with
  their OWN bookingRef — but they are not the document the confirmation page's existing single-
  ticket lookup resolves. **This is a named, deliberate gap, not an oversight** — see "What this
  contract does NOT fix" below.

### Buyer identity for a multi-item order

`order.buyerName`/`buyerEmail` = the FIRST line item's attendee fields, same judgement call
`ticketing-checkout-orders`'s own README already made for the single-item case ("checkout's request
body has no separate buyer fields"). Stage 4 (the plan's booking-contact block, `spec §A1`)
introduces a real, separate buyer identity distinct from any attendee — this contract does not
pre-empt that; it is the same provisional mapping, just applied to `lineItems[0]` instead of the
sole item.

### Why every position shares `m_payment_id`

Two reasons, not one:

1. **Correctness for `findReservedOrderByPaymentId`** (`lib/orders.ts`), which is untouched by this
   contract and locates the ORDER by `orders.where('m_payment_id', '==', mPaymentId)`. That query
   only ever needs the order's own `m_payment_id`, so this alone doesn't require touching
   positions. But:
2. **Diagnostic/reconciliation value.** Every position carrying the SAME shared reference (rather
   than each position's `m_payment_id` being null, or being its own bookingRef, which would make it
   indistinguishable from a single-item order's position by that field alone) means a support
   query — "find every ticket that belongs to payment X" — works directly against the `tickets`
   collection without a join through `orders`. This mirrors the field's existing dual role
   (position-level convenience copy of an order-level fact) that `createOrderWithPosition`
   (`lib/orders.ts`) already established for `amount`/`purchasedAt`.

---

## F1 — `app/api/tickets/checkout/route.ts`

`CheckoutRequestBody` becomes `{ showId: unknown; lineItems: unknown }` — `ticketType`,
`attendeeName`, `attendeeEmail` are REMOVED from the top level (not left dual-shaped; a route that
accepts both the old flat shape and the new array shape is two request formats to keep correct
forever for a purchase flow with no other consumer to migrate).

```ts
export interface CheckoutLineItemInput {
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
}

/** Resource-exhaustion ceiling, NOT the council's 5-tickets-per-booking business rule (spec
 *  §414, explicitly Stage 4's job per the architect brief — see "The 5-ticket limit: Stage 4,
 *  confirmed" below). Chosen with wide headroom over any real cart, purely so one POST cannot
 *  hold capacity against, or open positions for, an unbounded number of ticket types. */
export const MAX_LINE_ITEMS = 20;

/** Pure — no Firestore, no Sanity, no network. Returns null for: not an array; length 0;
 *  length > MAX_LINE_ITEMS; or ANY single item failing the existing per-field rules
 *  (non-empty ticketType, non-empty attendeeName, EMAIL_PATTERN-valid attendeeEmail) — one bad
 *  item rejects the WHOLE cart, never silently drops it and proceeds with the rest. Exported
 *  specifically so its zero-dependency, cap-before-any-external-call property is directly
 *  provable (see A5). */
export function parseLineItems(raw: unknown): CheckoutLineItemInput[] | null;
```

Route body, in order:

1. Idempotency-key header validation — **UNCHANGED**, still runs before the body is even parsed.
2. `parseLineItems(body.lineItems)` — replaces `isValidCheckoutBody`'s per-field checks. `showId
   === NATIONAL_SHOW_ID` validation is **UNCHANGED**, still top-level, still before any Sanity
   call — same posture, same reasoning (`getSoldCountsByTicketType(showId)` scopes the capacity
   ledger by this exact value; the request body is never the authority).
3. `salesOpen` gate — **UNCHANGED**, same query, same position, same failure shape.
4. Ticket-type lookup — was one `ticketTypeBySlugQuery` fetch; becomes one fetch **per distinct**
   `ticketType` referenced by `lineItems` (dedupe by slug — a cart with two Early-Bird line items
   fetches Early-Bird's Sanity doc once, not twice). For EACH distinct type: `isUsableAmount`
   (capacity, price) and `ticketTypeMatchesActiveShow` — **UNCHANGED logic, applied per type**. Any
   one bad type calls the existing `unusableTicketType(slug, field)` and refuses the WHOLE request
   with the existing 500 shape, before any Firestore write — same fail-closed posture as today,
   extended from "the one type" to "every type this cart touches".
5. `paymentProvider.readiness('initiate')` gateway guard — **UNCHANGED position, UNCHANGED
   shape**, still before any Firestore write.
6. `RECOVERY_TOKEN_SECRET` fail-closed guard — **UNCHANGED position, UNCHANGED shape**, still
   before the reservation write.
7. `reserveTicket(s)` transaction — see below.

### The reservation transaction

Inside the SAME `db.runTransaction(...)` shape as today (still `TRANSACTION_MAX_ATTEMPTS = 10`,
unchanged):

1. `soldCounts = await getSoldCountsByTicketType(showId, transaction)` — **UNCHANGED call**, O(1)
   in the number of distinct types (two status-scoped queries, same as today; NOT one query per
   ticket type in the cart).
2. Idempotency duplicate probe: `tickets.where('idempotencyKey', '==', key).get()` — the
   **`.limit(1)` is REMOVED**. This is the one structural change to the probe itself; see "Why
   `.limit(1)` must go" below.
   - If non-empty: build `existing = docs.map(d => ({ ticketType, attendeeEmail }))`, compare via
     `lineItemsMatchExistingPositions(requestedLineItems, existing)`. Mismatch ->
     `key-payload-mismatch` (unchanged response shape/status). Match -> fetch the order via
     `orders.doc(duplicate.docs[0].data().orderId)` (one additional transactional read, replay
     path only) and check `status`/`expiresAt` **on the order**, not a position — see "Order
     becomes the state authority for replay" below. Not payable -> `key-not-payable` (unchanged).
     Payable -> `{ kind: 'replayed', reference: order.m_payment_id, amount: order.amount,
     positions: duplicate.docs.map(d => ({ bookingRef: d.id, ticketType: d.data().ticketType })) }`.
3. If NOT a duplicate (fresh reservation):
   - `requestedQtyByType = aggregateRequestedQuantities(lineItems)`.
   - `planCapacity({ requestedQtyByType, soldCountsByType: soldCounts, capacityByType })` —
     `capacityByType` built from the per-type Sanity lookups done in step 4 above. Over-capacity ->
     `{ kind: 'over-capacity', ticketTypes: result.ticketTypes }`, **NO writes at all** — this is
     the all-or-nothing property, and it is observable: the route logs
     `console.error('[tickets/checkout] over-capacity for types:', result.ticketTypes)` (server
     log, diagnosable) and the CLIENT still receives the existing `fetchSoldOutMessage()` copy at
     409 — visitor-facing copy is unchanged (still sourced from Sanity, never invented here), but
     the underlying decision is no longer a black box server-side.
   - Otherwise: mint `reference = generateBookingRef()` for the FIRST line item's own bookingRef
     (i.e. `lineItems[0].bookingRef = reference`; every OTHER line item mints its own, independent
     `generateBookingRef()`), `orderRef = orders.doc()`, one `positionRef = tickets.doc(bookingRef)`
     per line item, mint ONE recovery token keyed to `orderRef.id` (**unchanged mint call shape**),
     build via `buildMultiReservationDocs(...)`, write via `writeMultiReservationPair(...)`. Return
     `{ kind: 'created', reference, amount: totalAmount, positions: [...] }`.

`ReservationOutcome`'s `created`/`replayed` variants gain `positions: { bookingRef: string;
ticketType: string }[]` and rename `bookingRef` -> `reference` internally; `over-capacity` gains
`ticketTypes: string[]`. `key-payload-mismatch`/`key-not-payable` are **UNCHANGED**.

### Route response

```ts
{ bookingRef: outcome.reference, positions: outcome.positions, processUrl, fields }
```

`bookingRef` at the TOP LEVEL is deliberately kept as the field name — it is what the confirmation
page's `?ref=` param and the PayFast hand-off already key on, and (per the reference decision above)
it resolves to a REAL position document for N=1 exactly as today. `positions` is purely additive.
No existing consumer of the response shape breaks; a new consumer that wants to show every
purchased ticket has the data to do so.

### Why `.limit(1)` must go

Today's single-item duplicate probe takes the first (and only ever) matching document. Once one
idempotency key can produce N positions, `.limit(1)` on the SAME query silently sees only one of
them — and the naive, laziest replay comparison (compare the request's first line item against
that one document) is exactly the defect A4 (`check-idempotency-replay-full-set.mjs`) exists to
rule out: a replaying client whose LATER line items have been tampered with (wrong attendee, wrong
— possibly cheaper — ticket type) would sail through as a "valid" replay.

### Order becomes the state authority for replay

**Judgement call, and a deliberate departure from `ticketing-checkout-orders`'s "duplicate
detection stays on tickets, unchanged" ruling** — narrowly, for the status/expiry check only, not
for the lookup itself (the lookup is still `tickets.where('idempotencyKey', ...)`, unchanged).
That earlier ruling reasoned that position-level state was a safe proxy for order-level state
because exactly one position always existed per order and they were written in lock-step — so they
could never disagree. That precondition is now false: N positions exist per order, and while
`buildMultiReservationDocs` writes them all with the SAME `status`/`expiresAt` at creation time (so
they cannot disagree at the moment of writing), F2 below makes the ORDER the thing that actually
transitions status on payment — see next section. Reading state off an arbitrary position
(`duplicate.docs[0]`, whichever one Firestore's query happens to return first) after F2 ships would
mean the replay decision depends on which position the query returns, which is exactly the kind of
"the check depends on incidental ordering" defect class `check-idempotency-replay-full-set.mjs`
case (2)/(6)/(7) print names catch for the comparison logic. Reading the order instead removes that
dependency entirely. Cost: one additional transactional read, on the replay path only (not the
fresh-reservation path, which never contends with the same volume of concurrent replays a genuinely
malicious/broken retry loop would produce).

### The 5-ticket limit: Stage 4, confirmed

Per `Plans/valiant-squishing-thimble.md` §4 ("Stage 4 — Booking contact block and the 5-ticket
limit") and the mission file's own F6, the council's per-booking limit (spec §414) is explicitly
scoped to Stage 4/F6, where it belongs alongside the real booking-contact identity block Section
A1 introduces — enforcing "5" here, ahead of that identity work landing, would be a business rule
with no user-facing surface to explain it (today's route has no buyer-identity concept the limit
is even a limit ON, only a bag of line items). **`MAX_LINE_ITEMS = 20` in this contract is NOT that
rule** — it is a technical, DoS-shaped ceiling chosen independently and is explicitly allowed to
diverge from whatever number the council's rule eventually is (if Stage 4 needs a technical ceiling
above the business limit for some legitimate reason — e.g. group bookings — 20 already has room;
if the business limit ever needs to exceed 20, THIS constant must be revisited too, not silently
assumed to already cover it).

### Firestore transaction-limit review

Firestore transactions cap at 500 document mutations. This transaction's write count is `N + 1`
(N positions + 1 order) — at `MAX_LINE_ITEMS = 20`, at most 21 writes, roughly 4% of the ceiling.
Read count: 2 (soldCounts, unchanged, O(1) in N — one query per status, not per type) + 1
(idempotency probe) + at most 1 more (order state check, replay path only) = at most 4 reads,
regardless of N. **No realistic cart approaches Firestore's limits; `MAX_LINE_ITEMS` exists for
abuse-prevention, not because the transaction would otherwise fail.** This is stated explicitly so
a future reviewer does not need to re-derive it, and so raising the constant later is a documented,
deliberate decision rather than a rediscovery.

---

## F2 — `lib/orders.ts`: `markOrderAndPositionPaidByPaymentId` must mark EVERY position paid

**This is IN SCOPE for this contract, not deferred**, and this is the single most important
decision in this document. Shipping F1 alone — reservation only — creates a strictly WORSE state
than today: a multi-item order can be genuinely reserved (all N positions, capacity correctly
held, all-or-nothing), the buyer can genuinely pay PayFast the full order amount, the ITN can
genuinely arrive and flip the ORDER to `'paid'` — and yet `markOrderAndPositionPaidByPaymentId`'s
existing position lookup, `tickets.where('orderId', '==', orderRef.id).limit(1)`, only ever
resolves and updates ONE of the N positions. The other N-1 stay `'reserved'` forever (until TTL
expiry silently drops them from capacity accounting — at which point they are not merely "not yet
confirmed", they have vanished: paid for, never issued, never scannable at the door). This is the
`docs/order-reconciliation.md`/production-blockers defect class this project has already had to
fix once — "order marked paid for money never received" — run in the opposite direction: money
genuinely received, ticket never marked usable. An architect handing @dev a contract that
predictably ships that state is not a tight scope, it is a landmine with a delay fuse.

**The fix**, scoped as narrowly as the defect allows:

- `positionSnapshot = await tickets.where('orderId', '==', orderRef.id).get()` — `.limit(1)`
  removed. (This read already happens BEFORE the transaction, unchanged in position/timing —
  only the query's `limit` changes.)
- Inside the transaction: `transaction.get()` + revalidate-exists for EVERY position in
  `positionSnapshot.docs` (not just the first), then `transaction.update()` EVERY one of them to
  `{ status: 'paid', purchasedAt: input.now }` — same per-document update shape as today, just
  applied N times instead of once.
- `MarkOrderPaidOutcome`'s `committed: true` variant changes `position: {...}` (singular) to
  `positions: {...}[]` (plural, one entry per position now paid) — **the one call-site change this
  forces**, in `app/api/tickets/itn/route.ts`. That route currently destructures `position` to
  build the confirmation-email content; F2 requires it destructure `positions[0]` for the SAME
  single-ticket email content/behaviour the N=1 case already produces today (byte-for-byte
  unchanged for a single-item order — the only kind of order that has ever existed until F1
  ships). It is NOT required to enumerate every ticket in the email body — see next section.
- Every OTHER branch (`order-not-found`, `order-vanished`, `order-payment-id-mismatch`,
  `order-not-reserved`, `position-not-found`) is **UNCHANGED** — `position-not-found` still means
  "the query found zero positions", not "found some but not all"; a partial result (found 2 of 3,
  say) is not a code path this fix introduces, because `.get()` with no limit returns everything
  matching `orderId` that exists, and `orderId` on every position is set atomically with the order
  in F1's `writeMultiReservationPair` — there is no window where some positions exist and others
  do not for the same order.

---

## What this contract does NOT fix — named, not silent

1. **The confirmation page shows only ONE ticket for a multi-item order.**
   `getConfirmedTicketForDisplay(bookingRef)` (`lib/orders.ts`) is untouched by this contract; it
   still does a single `tickets.doc(bookingRef).get()`. For N=1 this is byte-for-byte today's
   behaviour. For N>1, `bookingRef` (== `reference` == `lineItems[0].bookingRef`) resolves to the
   FIRST ticket only — the buyer sees one confirmed ticket with a real QR; the other N-1 are paid,
   valid, and independently scannable at the door (their own `bookingRef`s exist and are `'paid'`
   after F2), but are not surfaced on the confirmation page. This is a completeness/UX gap, not a
   data-integrity or payment-safety gap — every dollar paid corresponds to a real, usable ticket
   after F2; the buyer just cannot yet SEE all of them in one place. **Recommend the mission
   schedules this as an explicit fast-follow before multi-item checkout is exposed in the UI
   (mission F3, the cart UI itself)** — F3 is the natural place, since it is also the first feature
   that lets a buyer actually construct a multi-item cart in the first place.
2. **Confirmation email content is unchanged (single-ticket) for N>1 orders.** Same reasoning as
   above — F2's ITN call-site fix preserves today's email content exactly, using `positions[0]`;
   it does not enumerate every ticket. Same recommendation: fold into the F3 UI work or a
   dedicated fast-follow.
3. **Multi-day / per-day check-in semantics are untouched.** Out of this mission entirely (Stage 5
   in the plan) and unaffected by this contract — `lib/checkin.ts` is not imported by anything this
   contract changes.
4. **The 5-ticket-per-booking business limit is not enforced here.** Confirmed Stage 4/F6, see
   above.
5. **Named attendees / day selection per position are not new concepts here.** Every line item
   already required its own `attendeeName`/`attendeeEmail` before this contract (todays's SINGLE
   line item did); this contract pluralises that, it does not introduce per-type-conditional
   requirements (e.g. "VIP requires a name, general admission does not") — that is Stage 3/F5's
   `requires-attendee-names` flag, per the mission file.

---

## Assertion inventory and defeating mutations

See `contracts/contract-ticketing-multi-line-item-cart.yaml` for the exact `command:` of each. All
new check scripts (A2-A8) live in `contracts/checks/ticketing-multi-line-item-cart/` and are
imports of the REAL exported functions this contract specifies — never grep-based, per the
project's own "assertion satisfiable by something that isn't the real property" defect class
(`.agent/memory/project/learned.md`).

| ID | Proves | Kind | Negative control |
|----|--------|------|-------------------|
| A1 | Whole project type-checks after all changes | `pnpm type-check` | N/A — build-level gate |
| A2 | New exported shapes are real Order/Ticket-assignable types; a client-supplied `amount` on `CheckoutLineItemInput` cannot compile | compiler (`tsc --noEmit`, `@ts-expect-error`) | `@ts-expect-error` lines themselves — an unused directive is a compile ERROR under `tsc`, so a fixed-but-wrong implementation (e.g. one that DOES accept `amount`) fails this check by making the expected error vanish |
| A3 | `planCapacity` aggregates repeated ticket types across the WHOLE cart before deciding, all-or-nothing, names every offending type | behavioural, fake data, pure fn | case (5): an unrelated sold-out type must not leak into the decision |
| A4 | `lineItemsMatchExistingPositions` is full-multiset, order-independent replay comparison | behavioural, pure fn | disjoint-set case — proves the harness can detect a real mismatch at all |
| A5 | `parseLineItems` enforces `MAX_LINE_ITEMS` and per-item validity with ZERO external dependency, before any Firestore/Sanity call | behavioural, pure fn, zero-dependency call | case: a single valid item is accepted — proves the harness isn't just rejecting everything |
| A6 | `buildMultiReservationDocs`/`writeMultiReservationPair` write N positions + 1 order atomically, all-or-nothing, for a MIDDLE write failure specifically | behavioural, fake Firestore-shaped store | case (2)'s all-three-collections-empty assertion — a partial-commit fake would be caught here even if it happened to clear only the failing doc |
| A7/A8 | `markOrderAndPositionPaidByPaymentId` marks EVERY position of a multi-position order paid, at two different N (3 and 2) | behavioural, fake Firestore-shaped store, run against TODAY'S REAL unmodified code | the single-position case (today's only real shape) must still pass — proves the fix does not regress the live, already-proven purchase path |
| A9 | `pnpm lint` passes with zero errors | lint | N/A — build-level gate |

A2's fixture additionally proves — by construction, not by a runtime assertion — that a client
cannot construct a `CheckoutLineItemInput` carrying `amount`/`price`: the `@ts-expect-error` on
that literal is itself the proof, and TypeScript treats an unused `@ts-expect-error` as a hard
compile error, so a regression that accidentally widens the type to accept a client amount breaks
the BUILD, not merely a test that could be quietly skipped.

## Red evidence — observed 2026-08-20, against the unmodified tree

- **A7/A8** (`check-itn-marks-all-positions-paid.mjs`): run directly against today's real,
  unmodified `lib/orders.ts` (no new code required to exercise it — the defect already exists in
  shipped code, latent until F1 makes it reachable). `npx tsx
  contracts/checks/ticketing-multi-line-item-cart/check-itn-marks-all-positions-paid.mjs` **exit
  1**. Failures printed: only 1 of 3 positions marked paid (A7 fixture), only 1 of 2 (A8 fixture).
  Negative control (single-position order) passed, confirming the harness itself works and the
  live path is not accidentally broken by the check.
- **A3** (`check-plan-capacity-aggregates.mjs`), **A4** (`check-idempotency-replay-full-set.mjs`),
  **A5** (`check-parse-line-items-cap.mjs`), **A6** (`check-multi-write-atomicity.mjs`): each run
  individually via `npx tsx <path>`, each **exit 1**, each failing with a `SyntaxError: ... does
  not provide an export named '<newExportName>'` — the new exports these checks require
  (`aggregateRequestedQuantities`, `planCapacity`, `lineItemsMatchExistingPositions`,
  `parseLineItems`, `MAX_LINE_ITEMS`, `buildMultiReservationDocs`, `writeMultiReservationPair`) do
  not exist on the current tree. This is the expected, correct form of red for code that does not
  exist yet — distinct in kind from A7/A8's red (a real behavioural gap in ALREADY-SHIPPED code),
  and both are recorded so the difference is not lost.
- **A2** (`fixtures/multi-line-item-typecheck.ts` via its `tsconfig.typecheck.json`): `npx tsc
  --noEmit -p contracts/checks/ticketing-multi-line-item-cart/tsconfig.typecheck.json` **exit 2**,
  8 compile errors — 6 "has no exported member" (the same missing exports as above) plus 2 "Unused
  '@ts-expect-error' directive" (expected: the directives target lines that don't even compile yet
  for unrelated reasons, so TypeScript never reaches the point of confirming THEIR specific error;
  both become meaningful once the missing exports exist).
- **A1** (`pnpm type-check`) and **A9** (`pnpm lint`, not separately re-run — this project's
  existing lint gate, unchanged in shape): baseline captured on the unmodified tree, **exit 0**
  for `pnpm type-check`. This is the expected baseline for a build-level gate before any change is
  made — it is not meant to be red pre-fix, only to stay green after.

## A2 fixture defect and fix — 2026-08-20, found during @dev's implementation

**Found by the team lead, confirmed independently, fixed here (not by @dev, who correctly
refused to edit an architect-owned fixture and stopped).** The original
`lineItemWithClientPrice` block placed its `@ts-expect-error` directly above the `const
lineItemWithClientPrice: CheckoutLineItemInput = {` statement, not above the offending
`amount: 1,` property line. TypeScript reports an excess-property diagnostic on a multi-line
fresh object literal AT THE OFFENDING PROPERTY'S OWN LINE, not at the assignment statement —
a directive only suppresses the error on the immediately following line, so it suppressed
nothing, and TypeScript then additionally reported the directive itself as unused. **Both
errors fired regardless of the implementation — A2 was unsatisfiable as written, not merely
failing.** This does NOT mean the property under test was ever in doubt: the excess-property
error (`TS2353: 'amount' does not exist in type 'CheckoutLineItemInput'`) firing is itself
positive proof the type genuinely rejects a client-supplied `amount` — only the directive's
placement was wrong. Fixed by moving the directive to sit directly above `amount: 1,` inside
the (deliberately still multi-line — not collapsed to make the directive easier to place,
which would only invite the next reader to re-expand it and reintroduce this exact bug)
object literal. The second `@ts-expect-error` block in the same fixture (`missingIdempotencyKey`,
line ~90) is a "missing required property" diagnostic, which TypeScript reports at the object
literal itself rather than at a specific property line — already correctly placed, confirmed
by the same full-file green run below, no change needed.

**Verified both directions, against @dev's real implementation (not a fake/stub):**

1. `npx tsc --noEmit -p contracts/checks/ticketing-multi-line-item-cart/tsconfig.typecheck.json`
   — **exit 0** with @dev's implementation in place and the fix applied.
2. Discrimination proof: temporarily added `amount?: number;` to the real
   `CheckoutLineItemInput` in `app/api/tickets/checkout/route.ts` — re-ran the same command,
   **exit 2**, `error TS2578: Unused '@ts-expect-error' directive` (the directive now has
   nothing to suppress, because `amount` legitimately exists on the type). Reverted the
   mutation completely, re-ran — **exit 0** again. `grep -n "amount?: number"
   app/api/tickets/checkout/route.ts` after revert: no match. `git status --short` after
   revert shows no stray changes to `app/api/tickets/checkout/route.ts` beyond @dev's own
   already-in-progress diff — the only file this fix touched is this fixture.
3. Full behavioural suite re-run against @dev's real implementation for corroboration (not
   required by the fixture fix alone, but recorded since it was free to check while in here):
   `check-plan-capacity-aggregates.mjs`, `check-idempotency-replay-full-set.mjs`,
   `check-parse-line-items-cap.mjs`, `check-multi-write-atomicity.mjs`,
   `check-itn-marks-all-positions-paid.mjs` — **all exit 0**.

All red evidence above was produced with `npx tsx`/`npx tsc` only, against fake/in-memory stores or
pure functions — **no live Firestore, no Sanity, no network call was made in the production of any
assertion in this contract.**

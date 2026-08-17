# Checkout/orders wiring — decision record

Mission `ticketing-foundation`. Closes the gap the team lead verified directly: checkout writes
only a flat `tickets` document today, never an `orders` document, so F10's
`markOrderAndPositionPaidByPaymentId()` always resolves `order-not-found` for a real purchase,
F11's confirmation email never fires for a real ITN, and F6's `recoveryToken` stays `null` on
every real order. This document is the full decision record for the fix: every judgement call,
every assertion's named defeating mutation, and what this contract does NOT prove.

---

## The gap, re-verified

`app/api/tickets/checkout/route.ts`'s only Firestore write is
`transaction.create(tickets.doc(bookingRef), {...})` at (pre-change) line 247, against
`TICKETS_COLLECTION` alone. Grepped 2026-08-17: zero matches for `createOrderWithPosition`,
`ORDERS_COLLECTION`, `'orders'`, or `orderId` anywhere in the file. Confirmed against the spec:
`docs/ticketing-system-foundation-spec.md` §4.2 says checkout "becomes order-aware"; the code does
not match that claim. The spec is right about the intent; the code is what was wrong.

---

## Why a new `lib/checkout-reservation.ts`, and why `lib/orders.ts` is NOT touched

**The core constraint: Firestore transactions cannot be nested.** `createOrderWithPosition()`
(`lib/orders.ts`) opens its own `db.runTransaction(...)`. Checkout's `reserveTicket()` already
opens ITS OWN `db.runTransaction(...)` to do the capacity read and the idempotency duplicate probe
— both of which MUST see the same transactional snapshot as the write that follows, or the
oversell-prevention fix that transaction exists for
(`contracts/golden/ticketing-hardening/capacity-transaction.golden.md`) regresses. Calling
`createOrderWithPosition()` from inside `reserveTicket()`'s already-open transaction callback would
attempt to open a SECOND transaction from within the first — not supported by the Firestore Admin
SDK, and even if it were, it would decouple the order/position write from the capacity decision
that is supposed to gate it.

Two ways to resolve this were considered:

- **Widen `lib/orders.ts` in place** — add an already-open-transaction variant of
  `createOrderWithPosition`, or change its signature to accept an optional external transaction.
  Rejected: `createOrderWithPosition()` is already the subject of F2's A4/A5, F8's A2/A3/A4/A7/A8,
  and F10's own typecheck fixture — all of them assert its EXACT current call shape and behaviour,
  several against LIVE Firestore fixtures. This contract's hard constraint ("no check may create,
  write, or delete any Firestore document") means I cannot re-run those live checks here to prove
  a refactor left them green; touching the function at all puts three other features' already-green
  gates at risk for a benefit (code reuse) that doesn't materialise anyway, since checkout's needs
  differ from `createOrderWithPosition`'s in two more ways (below).
- **New, narrow, sibling module** — `lib/checkout-reservation.ts`, with its own pure builder
  (`buildReservationDocs`) and its own narrow transactional writer (`writeReservationPair`) that
  takes an ALREADY-OPEN transaction as a parameter instead of opening one. **This is the approach
  taken.** `lib/orders.ts` is not imported for its transactional logic anywhere in this contract —
  only `ORDERS_COLLECTION` (a plain string constant) is imported by the route, for the collection
  name.

This mirrors the exact reasoning F10's own README gives for adding sibling interfaces instead of
widening F8's ("Why two interface families, not one widened one") — same project, same precedent,
applied one level up this time (a sibling MODULE, not just sibling interfaces).

**The two further reasons checkout's needs differ from `createOrderWithPosition()`'s, beyond
transaction nesting:**

1. **`create()` vs `set()`.** `createOrderWithPosition()` deliberately uses `transaction.set()`
   (idempotent upsert) because it doubles as the fixture-creation path F2/F8's own contract checks
   reuse across repeated runs. Checkout has no such need — a fresh reservation should use
   `transaction.create()` (fail loud on collision), exactly matching what the position write
   already does today. Reusing `createOrderWithPosition()` would have silently downgraded
   checkout's collision behaviour from fail-loud to silent-overwrite.
2. **The position field list differs by one field.** Checkout additively keeps `idempotencyKey` on
   the position (see "Position idempotencyKey stays" below); `createOrderWithPosition()`'s position
   shape does not include it and must not gain it (adding it there would be an undocumented,
   untested change to F2/F8's asserted shape).

---

## Why `writeReservationPair` takes an already-open transaction, not its own

Direct consequence of the transaction-nesting constraint above. `CreateCapableTransactionLike` is a
new, deliberately narrow structural interface (`{ create(ref, data): unknown }`) — matching ONLY
the one transaction method this function calls, the same "narrow enough that the real class
satisfies it for free" trick `OrdersFirestoreLike`/`OrdersTransactionLike` (F8) and
`OrdersFirestoreRwLike`/`OrdersTransactionRwLike` (F10) already established in `lib/orders.ts`. It
is a NEW sibling, not an extension of either existing family — neither has a `create` method, and
widening either would put F8's/F10's own already-green, already-shipped fake-store tests at risk
for the same reason discussed above. A2 proves the real `firebase-admin` `Transaction` class
structurally satisfies `CreateCapableTransactionLike` with zero adapter code, so
`app/api/tickets/checkout/route.ts` passes its real, already-open `transaction` straight into
`writeReservationPair()`.

---

## Duplicate detection stays on `tickets`, unchanged

**Judgement call:** the idempotency duplicate-probe (`tickets.where('idempotencyKey', '==',
input.idempotencyKey)`) is left EXACTLY as it is today. It was tempting to "correctly" move this
onto the `orders` collection, since F2 defines `idempotencyKey` as an order-level concept
(§4.2: "the existing `idempotencyKey`... now lives correctly on the order it always conceptually
belonged to"). Rejected for this contract, for two reasons:

1. **It would require a second transactional read to resolve the replay response.** The
   replay branch needs `bookingRef` and `ticketType`/`attendeeEmail` (for the payload-mismatch
   check) — none of which live on the order. Querying `orders` first would still require a SECOND
   query, by `orderId`, against `tickets` to get them — strictly more transactional reads for zero
   behavioural benefit, since the position is written in lock-step with its order in every case
   this contract creates.
2. **It is the lower-risk change.** The existing `tickets`-keyed duplicate probe, and its
   payload-mismatch / not-payable branches, are already covered by
   `contracts/golden/ticketing-hardening/idempotency-and-booking-ref.golden.md` and are working,
   audited code. Moving the query changes a load-bearing security check (idempotency-key replay
   protection guards the door code, not just a convenience) for a benefit (schema purity) that has
   no observable effect today, since checkout writes exactly one order and one position per
   idempotency key — they can never disagree.

**What this means concretely:** the position keeps carrying `idempotencyKey`, additively, exactly
as it already does today (see next section) — that is what keeps the duplicate probe working
unchanged.

## Position `idempotencyKey` stays

`Ticket` (`types/index.ts`) does not declare an `idempotencyKey` field, and today's checkout write
is a raw, untyped `transaction.create(tickets.doc(bookingRef), {...})` object literal — so this
field is already, today, an undocumented-in-the-type-system but very much real field on every
position document. `ReservationDocs['position']` is typed as `Omit<Ticket, 'id'> &
{ idempotencyKey: string }` — additive on top of the real `Ticket` type, not a change to
`types/index.ts`, and not a change to `lib/orders.ts`'s `CreateOrderPositionInput`/position shape
(which correctly has no such field, since F8's comp route and any future multi-position caller of
`createOrderWithPosition()` have no need for it). A2's `@ts-expect-error` case proves this field is
required, not optional, on `ReservationDocs['position']` — a builder that forgets to set it must
fail to compile.

---

## `recoveryToken` minting: this is where it belongs

F6's own contract states, explicitly: *"Storing `recoveryToken`/its expiry on the order document
at order-creation time (wiring `mintRecoveryToken` into `lib/orders.ts` / F10's ITN rewrite) is
also not F6's job — F6 proves the primitive works; F10/F11 call it."* F10's own README states,
explicitly, under Judgement calls: *"F10 does not generate `recoveryToken` at checkout —
`checkout/route.ts` is not the pinned file and is outside this ceremony's authorised scope... Handed
to a human/future-feature step: whoever builds F11 or a checkout follow-up must wire
`mintRecoveryToken` into order creation."* This contract is that follow-up, and checkout — the
order-creation site — is the only place the token CAN be minted once, at creation, rather than
requiring a second write later. `writeReservationPair()`'s A3 proves the minted token lands on the
order document and never leaks onto the position (F10's `markOrderAndPositionPaidByPaymentId`
already reads `order?.recoveryToken` defensively and threads it through to the email hookup — this
contract is what makes that value ever be non-null for a real purchase).

**`RECOVERY_TOKEN_SECRET` is a NEW required env var**, read once per request in `POST()`, alongside
the existing `PAYFAST_SANDBOX_MERCHANT_ID`/`_KEY`/`_PASSPHRASE` reads. `.env.local.example` needs a
new line for it (@dev's job, not architect's — outside this document's own scope to edit source,
but named here so it isn't missed): a genuinely random, server-only secret, distinct from every
PayFast credential and from `SANITY_WEBHOOK_SECRET`/`SANITY_REVALIDATE_SECRET` — reusing any of
those would let whoever holds that OTHER secret forge recovery tokens, a privilege-scope violation
`lib/recovery-token.ts`'s own header comment already warns against ("ZERO authorization meaning...
do not import `lib/admin-auth.ts`" — the inverse risk, a token secret shared with an authorization
secret, is the same class of mistake in the other direction).

**recoveryToken minting: fail closed, same posture as the PayFast credential guards.** If
`RECOVERY_TOKEN_SECRET` is unset, checkout must refuse the purchase with 500 BEFORE any Firestore
write — not silently mint a token with an empty/`undefined` secret (which would coerce to the
literal string `"undefined"` as the HMAC key and produce a token that stops verifying the moment
the secret is later set correctly, or that varies unpredictably across cold starts with no secret
configured at all). A5 proves this guard exists and is correctly ordered.

---

## `buyerName`/`buyerEmail` == `attendeeName`/`attendeeEmail`, for now

Checkout's request body has no separate buyer fields — only `attendeeName`/`attendeeEmail`. F10's
own README already made and justified this exact call for the ITN's email hookup ("using the
order's buyer fields is the forward-compatible choice for the eventual multi-position order... even
though F10 itself only ever populates one position"). This contract adopts the identical posture at
the point the fields are actually set (order creation, not just order-read) for consistency with
that precedent, not as an independent decision.

---

## One position per order, for now

**Judgement call: checkout creates exactly one order with exactly one position.** `REQUESTED_QUANTITY
= 1` (`app/api/tickets/checkout/route.ts`, pre-existing, unchanged by this contract) already
hardcodes this at the reservation-decision level — there is no code path in the current request
body shape that could produce more than one position per checkout call. `Order.amount` is therefore
always exactly the one position's `amount`, not a sum — trivially satisfying the type's own
documented contract ("total ZAR across every position in the order") for the single-position case.
Extending to real multi-position orders (group booking, §9, explicitly deferred in the spec) is
future work with its own request-shape change, its own capacity-reservation-per-position loop, and
its own contract; nothing in this design blocks it, since `ReservationDocs`/`writeReservationPair`
already operate one order-to-one-position at a time and a future caller could invoke
`writeReservationPair` more than once inside the same transaction for additional positions sharing
one order.

---

## Backward compatibility

**Legacy positions (pre-F2, no `orderId`) are never read by this contract's changes.** Checkout
only WRITES new documents; it never reads an existing position by anything other than the
idempotency-key duplicate probe, which is scoped to the current 30-minute reservation window and
therefore can only ever match positions created by checkout itself, all of which (after this
contract ships) always carry `orderId`. `lib/checkin.ts`, the admin dashboard routes, and the CSV
export — the three real legacy-position readers — are all outside this contract's changed files and
already handle `orderId: string | null` correctly (F2, already shipped, already gated).

**What this does NOT cover, named as a deploy-transition edge case, not gated here:** a checkout
request in flight at the moment this change deploys could produce a position without the new
order-model fields if the deploy lands mid-request (an ordinary rolling-deploy race, not specific to
this change). Any `'reserved'` position created by the OLD checkout code and paid after this
deploy would have no `orders` document for F10's ITN route to find, and
`markOrderAndPositionPaidByPaymentId` would correctly (if unhelpfully) return `order-not-found` for
it. This is a live production data question — whether any such reservations exist at deploy time —
outside architect's authority to check (no live Firestore access in this contract) and outside
`@dev`'s authority to fix by editing data. Flagged for a human step before/at deploy: confirm no
`'reserved'` positions are in flight, or accept that any that are will need a manual reconciliation
after this ships.

---

## Preserving the existing reservation-transaction guarantees, named explicitly

The existing `reserveTicket()` transaction (before this contract) guarantees, in order:

1. **No oversell** — capacity is counted transactionally (`getSoldCountsByTicketType(showId,
   transaction)`) in the SAME transaction as the write, closing the read-then-write race
   `contracts/golden/ticketing-hardening/capacity-transaction.golden.md` fixed.
2. **Idempotent replay** — a retried request with the same `idempotencyKey` and matching payload
   returns the ORIGINAL reservation's `bookingRef`/`amount`, never creates a second one.
3. **Payload-bound idempotency** — a retried request with the same key but a DIFFERENT
   `attendeeEmail`/`ticketType` is refused (`key-payload-mismatch`), not silently honoured.
4. **Fail-loud on booking-ref collision** — `transaction.create()`, not `.set()`, on the position.

**This contract preserves all four, unchanged, by construction:** guarantee 1 is untouched — the
capacity read is not modified, and the new writes happen inside the same transaction AFTER the
capacity decision, never before or outside it (A4 proves this structurally). Guarantees 2-3 are
untouched — the duplicate-probe query, its payload-mismatch check, and its not-payable check are
byte-for-byte the same code, unmoved (A4 proves the new write is unreachable from that branch).
Guarantee 4 is extended, not weakened — `writeReservationPair()` uses `transaction.create()` for
BOTH the order and the position (A3's fake-store test asserts this: a forced write failure on
either half aborts the whole pair, which only `create()`-inside-one-transaction semantics can
produce).

---

## What this contract does NOT prove — handed to a human/future step

- **A real, end-to-end sandbox purchase reaching a linked `orders`/`tickets` pair in live
  Firestore.** This requires a live Sanity project (checkout's ticketType/sales-state lookups), a
  live Firestore project, and a real PayFast sandbox round trip — all forbidden by this contract's
  hard offline/credential-free constraint. A3 proves the pair-write logic in isolation against a
  fake store; A4/A5 prove the route wires it in at the right place, structurally. Nothing here is a
  substitute for a live purchase-and-scan proof (the same class of gap F10's README named for its
  own scope, and the same F12 human step it deferred to).
- **A real concurrent idempotency race** (two genuinely simultaneous retried checkouts with the
  same key). A4 proves the new write is structurally inside the SAME transaction the existing,
  already-hardening-contract-tested idempotency logic uses — it does not re-run a live 20-way
  concurrency proof; that guarantee is inherited from Firestore's own transaction-retry contract,
  the same reasoning `contracts/golden/ticketing-hardening/capacity-transaction.golden.md` and
  F10's own README already rely on for their own untouched logic.
- **That `RECOVERY_TOKEN_SECRET` is actually configured correctly in the deployed environment**, or
  that its value is genuinely high-entropy and distinct from every other secret in this project. A5
  proves the code fails closed when the variable is EMPTY; it cannot prove a real, deployed value
  is a good one.
- **That any `'reserved'` position from before this deploy gets a working ITN flow.** See "Backward
  compatibility" above — this is a live-data question, handed to a human pre-deploy step.
- **That the confirmation email genuinely arrives with a working recovery link for a real
  purchase.** This contract proves the token is minted and stored on the order at creation time; it
  does not re-prove F10's email hookup (already gated by F10's own A7) or F11's actual email content
  (outside this contract's scope entirely).

---

## Files written

- `contracts/contract-ticketing-checkout-orders.yaml`
- `contracts/golden/ticketing-checkout-orders/README.md` (this file)
- `contracts/checks/ticketing-checkout-orders/tsconfig.typecheck.json`
- `contracts/checks/ticketing-checkout-orders/fixtures/checkout-orders-typecheck.ts`
- `contracts/checks/ticketing-checkout-orders/check-pair-write-atomicity.mjs`
- `contracts/checks/ticketing-checkout-orders/check-transaction-scope-structural.sh`
- `contracts/checks/ticketing-checkout-orders/check-fail-closed-secret-guard.sh`
- `contracts/checks/ticketing-checkout-orders/check-no-token-logging.sh`

None of these checks have been run end to end against real `@dev`-implemented
`lib/checkout-reservation.ts` / `app/api/tickets/checkout/route.ts` code — they cannot pass until
those files exist/are edited. `check-pair-write-atomicity.mjs`'s syntax and the tsconfig/contract
YAML were reviewed but not executed by architect; none is claimed to be green.

# F2 (ticketing-foundation) — orders/positions data model: decision record

Full source: `docs/ticketing-system-foundation-spec.md` §4.2–§4.4, mission brief F2
(`.agent/memory/project/missions/2026-08-17-ticketing-foundation.md`).

## Scope boundary — what F2 is, and what it deliberately is NOT

F2 is the **schema and creation-primitive** foundation only. It does **not** rewire
`app/api/tickets/checkout/route.ts` or `app/api/tickets/itn/route.ts` to become
order-aware — that is explicitly **F10**'s job ("Folded ITN re-pin ceremony... add
order/position two-write transaction"), milestone M2, the single authorised reopening of
the sha256-pinned ITN route. F2's own Done criteria confirm this scope: "a test order with
one position **can be created**" (a capability), not "checkout creates an order for every
purchase." Until F10 lands, real purchases still write flat `tickets` documents through the
unmodified checkout route, exactly as they do today — F2 adds a new, additive, unused-by-
checkout-yet primitive (`lib/orders.ts`) alongside it.

This mirrors F1's own posture: F1 added `ticketTypeMatchesActiveShow()` as an additive gate
inside checkout without touching the ITN route; F2 goes one step further and doesn't touch
checkout *at all*, because the checkout rewrite is bound up with the ITN two-write
transaction and belongs in one ceremony (F10), not split across two milestones' worth of
partial checkout edits.

## Live baseline, verified 2026-08-17 (read-only)

```
tickets collection: 15 documents total
  showId == 'nationalShow'               : 14 (real/fixture bookings — F1's baseline)
  showId == 'door-qr-check-wrong-show'   : 1  (door-checkin QA negative-control fixture)
orders collection: 0 documents (does not yet exist)
```

Identical to F1's own verified baseline (`contracts/golden/ticketing-f1-show-collision/
README.md`) — nothing changed it between F1 and F2. `orders` is confirmed to not exist yet,
so F2 is the first feature to create it.

## Correction to the mission brief's Done criteria (do not re-derive)

The brief's F2 Done criteria say: *"status field on position correctly reads as one of
four values including refunded."* This is arithmetically wrong, not a scoping decision.
`TicketStatus` already had **four** values before F2 (`'reserved' | 'paid' | 'cancelled' |
'checked-in'` — `types/index.ts:128`, pre-F2). Adding `'refunded'` makes **five**, not four.
`contracts/checks/ticketing-f2-orders-model/fixtures/ticket-status-typecheck.ts` asserts
five positive members and rejects a sixth. Do not "fix" the design back down to four members
— that would mean either dropping an existing real value (`'checked-in'` is load-bearing in
`lib/checkin.ts`) or never actually adding `'refunded'`, both wrong.

## Field-move decision, revised 2026-08-17: F2 is additive-only — `Ticket` keeps all four payment fields, gains `orderId`

**This section replaces the original design, which was wrong.** The first draft of this
contract had `Ticket` (position) drop `amount`/`purchasedAt`/`m_payment_id`/
`pf_payment_id`, reading spec §4.2/§4.4 literally ("every payment-facing field... moves to"
the order). Corrected on review, for two reasons — one factual, one design.

**Factual: more consumers than checked the first time.** The first draft's search only
covered `lib/checkin.ts`. Three more files construct object literals/props contextually
typed as `Ticket`/`Ticket[]`, and every one of them includes all four fields today:

- `app/admin/page.tsx:58-80` — `fetchTickets(): Promise<Ticket[]>`.
- `app/api/admin/tickets/route.ts:18-33` — the admin dashboard's JSON API route, same
  literal shape as `fetchTickets()`.
- `components/admin/TicketsTable.tsx:9,12` — `TicketsTable`'s `tickets: Ticket[]` prop and
  `formatPurchasedAt(ticket: Ticket)`, which reads `ticket.purchasedAt` only. The rendered
  table has no Amount column and the file does not reference `amount` anywhere — verified
  by a case-insensitive grep across all 70 lines, zero matches. Corrected 2026-08-17 (per
  @qa): an earlier draft of this bullet wrongly claimed this file also consumed
  `ticket.amount`; it does not, and that overstatement is fixed here rather than the bullet
  being dropped — the file is still a genuine `Ticket`-typed consumer, still relevant to
  F10's eventual removal of `purchasedAt` from the position.

Dropping the four fields from `Ticket` would make the two object-literal sites' excess
properties fail TypeScript's excess-property checking the moment `pnpm type-check` (A1)
ran — a real compile break on the first `@dev` pass, not a hypothetical one — and
`TicketsTable.tsx` would separately fail on `ticket.purchasedAt` no longer existing on the
prop type (not on `amount`, which this file never touches). **Always re-sweep for every
`Ticket`-typed consumer before narrowing the type** — grepping for the four field names
alone (the first draft's mistake) finds writers, not readers, and citing a consumer's
fields from memory rather than the actual file is the same mistake one level down.

**Re-swept 2026-08-17 (per review) for anything missed.** Full grep across `app/`, `lib/`,
`components/`, `types/`, `scripts/` for `Ticket` (excluding `TicketType`/`TicketStatus`)
turns up no further `Ticket`/`Ticket[]`-typed consumer beyond the three above. One more
data point corroborates the same conclusion from a different angle:
`app/api/admin/export-csv/route.ts` reads `data['purchasedAt']` directly off untyped
Firestore `tickets` documents (not through the `Ticket` type, so not a compile-time risk,
but still a real reader of the field at the position level) — independent confirmation that
`purchasedAt` is still expected to live on the position document today, not only on a
future `orders` document.

**Design: a type that drops fields the real documents still carry is worse than the drift
it's trying to prevent.** F2 ships no migration or backfill (see "What F2 does NOT do"
below), and checkout + the sha256-pinned ITN route both keep writing all four fields onto
every new position exactly as they do today, until F10. So every one of the 14 live
`nationalShow` tickets — and every ticket sold between now and F10 — would carry payment
fields a narrowed `Ticket` type claims don't exist. That's not a compiler-enforced
migration boundary; it's a type that silently contradicts the data on disk, invisible to
`pnpm type-check` precisely because TS types are compile-time-only and never validate
Firestore documents at read time. The fields move when their writers move — in F10,
together with the backfill that actually needs one.

**`Ticket` (position), after F2** — unchanged: `id`, `bookingRef`, `showId`,
`attendeeName`, `attendeeEmail`, `ticketType`, `status`, `amount`, `purchasedAt`,
`checkedInAt`, `m_payment_id`, `pf_payment_id`. Gains exactly one new field: `orderId:
string | null`.

**Why nullable `orderId`:** the 14 real legacy positions predate this field entirely and F2
ships no backfill/migration (see "What F2 does NOT do" below) — `null` is the honest value
for "no parent order," matching the existing null-coalescing convention already used in
`lib/checkin.ts`'s `toTicket()` for `m_payment_id`/`pf_payment_id` (`(data[...] as string) ??
null`).

**Change required at every `Ticket`-object-literal construction site (small, mechanical,
one line each):** `orderId` is a required key (nullable value, not an optional key), so
every site listed above that builds a `Ticket` object literal off a raw Firestore doc needs
the same one-line addition: `lib/checkin.ts`'s `toTicket()`
(`orderId: (data['orderId'] as string) ?? null`), `app/admin/page.tsx`'s `fetchTickets()`,
and `app/api/admin/tickets/route.ts`'s `GET` handler (both `orderId: data['orderId'] ??
null`). No other line in any of the three files changes — `checkin.ts`'s query shape
(`db.collection('tickets').where('bookingRef', '==', ...)`), transaction structure, and
every branch of `admit()`'s decision table are untouched; the two admin routes' shape and
every other field are untouched too. `check-refunded-status-and-checkin-refusal.mjs` (A5)
proves the `checkin.ts` half behaviourally: it calls the real, unmodified
`checkInByBookingRef()` against a live fixture and checks the actual refusal code/status
returned, not the source.

**Consequence for `lib/orders.ts`:** `createOrderWithPosition()` must write
`amount`/`purchasedAt`/`m_payment_id`/`pf_payment_id` onto BOTH the order and the position
(duplicated, not moved) — see "lib/orders.ts" below. This keeps every existing
`Ticket`-typed consumer working unmodified for orders created via this new primitive,
without touching those three files in F2. `gateway`/`gatewayPaymentId` are genuinely NEW,
order-only concepts introduced by §4.4 with no legacy Ticket-typed reader anywhere, so they
are NOT duplicated onto the position — only the order carries them.

## `Order` (new type)

```ts
export type OrderStatus = 'reserved' | 'paid' | 'cancelled';

export interface Order {
  id: string;
  showId: string;
  buyerName: string;
  buyerEmail: string;
  amount: number;
  status: OrderStatus;
  expiresAt: Timestamp | null;
  idempotencyKey: string;
  purchasedAt: Timestamp | null;
  gateway: string | null;
  gatewayPaymentId: string | null;
  m_payment_id: string | null;
  pf_payment_id: string | null;
}
```

**Why `m_payment_id` is included** even though the team-lead's dispatch message's field
list omitted it: spec §4.2's own field list for the order explicitly names it
("`m_payment_id`, `gateway`, `gatewayPaymentId`, `pf_payment_id`"), and §4.4 confirms
`pf_payment_id` stays "exactly as it is... additive, not a rename" alongside the two new
gateway-neutral fields — the same logic applies to `m_payment_id`, which is PayFast's own
payment-reference field, structurally identical to `pf_payment_id`. Today `m_payment_id`
always equals the position's own `bookingRef` (see checkout route.ts:261:
`m_payment_id: bookingRef`); once group orders exist (deferred, §9) an order can have
several positions but only one PayFast payment, so `m_payment_id` is an order-level concept,
not a position-level one, and belongs here. Treated as a paraphrase gap in the dispatch
message, not a contradiction to resolve by omission — the spec is the more detailed,
more authoritative source per this project's `.claude/rules/workflow.md` chain (architect
reads the spec directly, not only the mission-derived brief).

**Why `OrderStatus` is its own 3-member type, not `TicketStatus`:** an order is never itself
"checked-in" (only a position is scanned at the door) or "refunded" (§4.3: a refund targets
one position, never the whole order — pretix's design point the spec adopts explicitly).
Reusing `TicketStatus` for `Order.status` would let a caller write `order.status =
'checked-in'`, a state that has no meaning at the order level and no code anywhere would
ever legitimately produce. `order-position-shape-typecheck.ts` asserts both non-members are
rejected by the compiler.

## `lib/orders.ts` (new file, @dev's implementation target)

```ts
export const ORDERS_COLLECTION = 'orders';

export interface CreateOrderPositionInput {
  /** Omit to auto-generate a Firestore id (real purchases). Callers supply a fixed id only
   *  for deliberately idempotent fixture writes (contract checks) — see "Fixture
   *  lifecycle" below. */
  orderId?: string;
  /** The position's document id, same convention as checkout's existing
   *  `tickets.doc(bookingRef)` — always caller-supplied, never auto-generated, so the
   *  booking reference and the Firestore doc id are always the same value. */
  bookingRef: string;
  showId: string;
  buyerName: string;
  buyerEmail: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketType: string;
  amount: number;
  orderStatus: OrderStatus;
  positionStatus: TicketStatus;
  idempotencyKey: string;
  expiresAt: Timestamp | null;
  /** Caller-supplied, not defaulted to null: F8's comp route and F10's ITN two-write both
   *  need to set a real purchase timestamp at creation time in some call shapes (a comp is
   *  'paid' the instant it's created), so this primitive doesn't assume "always null at
   *  creation" the way checkout's current flat write does. */
  purchasedAt: Timestamp | null;
  gateway: string | null;
  gatewayPaymentId: string | null;
  m_payment_id: string | null;
  pf_payment_id: string | null;
}

/** Writes one `orders/{orderId}` document and one `tickets/{bookingRef}` document — the
 *  position — inside a single transaction, with the position's `orderId` set to the
 *  order's resolved id. Uses `transaction.set()` (idempotent upsert), NOT
 *  `transaction.create()` — deliberately different from checkout's existing
 *  `tickets.doc(bookingRef)` create-and-fail-on-collision semantics, because this function
 *  is also the deliberately-idempotent fixture-creation path contract checks reuse across
 *  repeated runs (see "Fixture lifecycle"). Real callers (F8's comp route, F10's checkout
 *  rewrite) always pass a fresh, cryptographically random bookingRef from
 *  `generateBookingRef()`, so idempotent-by-id semantics never mask a real collision in
 *  production use — a collision there would require `generateBookingRef()` itself to
 *  repeat, which is the same ~60-bit-entropy assumption checkout already relies on today. */
export async function createOrderWithPosition(
  input: CreateOrderPositionInput
): Promise<{ orderId: string; ticketId: string }>;
```

**Additive, revised (2026-08-17):** the position document this function writes contains
`bookingRef`, `showId`, `attendeeName`, `attendeeEmail`, `ticketType`, `status` (from
`positionStatus`), `checkedInAt: null`, `orderId` — **plus**, duplicated from the input,
`amount`, `purchasedAt`, `m_payment_id`, `pf_payment_id`. It must NOT write `gateway` or
`gatewayPaymentId` onto the position — those two are genuinely new, order-only concepts
(§4.4) with no legacy `Ticket`-typed reader anywhere. A4's check asserts the full positive
shape (amount/m_payment_id/pf_payment_id present and matching the input) and the negative
(gateway/gatewayPaymentId absent).

The order document contains: `showId`, `buyerName`, `buyerEmail`, `amount`, `status` (from
`orderStatus`), `expiresAt`, `idempotencyKey`, `purchasedAt` (from input — see
`CreateOrderPositionInput.purchasedAt` above), `gateway`, `gatewayPaymentId`,
`m_payment_id`, `pf_payment_id`.

**Why duplicate `amount`/`purchasedAt`/`m_payment_id`/`pf_payment_id` onto both documents
instead of only the order:** see "Field-move decision, revised" above — `Ticket` keeps
these fields, and three live consumers (`lib/checkin.ts`'s `toTicket()`,
`app/admin/page.tsx`'s `fetchTickets()`, `app/api/admin/tickets/route.ts`'s `GET` handler)
all read them directly off the `tickets` document, not off any `orders` document. Writing
them only to the order would make every order created via this primitive display as blank/
`undefined` amounts in the admin dashboard until F10. The duplication is deliberately
temporary — F10 removes it from the position once checkout/ITN become order-aware and a
backfill runs, at which point the order becomes the sole source of truth these fields.

## Fixture lifecycle — fixed ids, never deleted

Hard constraint #2 from the dispatch: **"Never delete any Firestore or Sanity document...
Deletion is the user's call alone."** Read literally (no carve-out for a check's own
fixtures), this rules out the usual create-then-cleanup pattern. The resolution adopted
here: every F2 check that writes to Firestore uses a **fixed, hardcoded, human-obviously-
fake id** (`contract-f2-fixture-order`, `SAOC-2027-CONTRACT-F2-FIXTURE`, and the `-refunded`
variants), reused on every contract run, written via `createOrderWithPosition()`'s
`transaction.set()` (idempotent upsert). Repeated runs overwrite the same two fixture pairs
rather than accumulating orphan documents — additive and idempotent, the same phrase (and
the same underlying principle) F1's `scripts/migrate-show-sales-fields.ts` already
established for content migrations. No check in this contract ever calls `.delete()`.

Real bookingRefs from `generateBookingRef()` never contain the literal substring
`"CONTRACT-F2-FIXTURE"` (Crockford base32 alphabet has no hyphenated words), so these ids
can never collide with, or be mistaken for, a real purchase.

## What F2 does NOT do (explicitly out of scope, deferred to later features)

- No migration or backfill of the 14 existing legacy `tickets` documents — they keep
  reading exactly as they do today, with no `orderId` (checked live by
  `check-national-show-tickets-unchanged.mjs`, A6).
- No change to `app/api/tickets/checkout/route.ts` or `app/api/tickets/itn/route.ts` (F10).
- No capacity-aware reservation logic in `lib/orders.ts` — `createOrderWithPosition()` is a
  pure creation primitive; capacity counting (`lib/data/tickets.ts`) is untouched and stays
  the single counting path per its existing header comment.
- No `compedBy` field, no `issue-comp` capability gate (F8).
- No `recoveryToken`, no buyer-account fields (F5/F6).

## Hard constraints verified respected

- `app/api/tickets/itn/route.ts` NOT touched (F2 never imports or reads it in any check).
- No Firestore or Sanity document deleted anywhere in this design.
- All Firestore-writing checks use fixed, clearly-marked fixture ids and idempotent
  `set()` upserts — no orphan accumulation, no live/real content mutated.
- `checkInByBookingRef()` is called live in A5 but only ever admits or refuses this
  contract's own fixture position — never a real buyer's booking reference. A5 also carries
  a self-verifying guard: it refuses to run at all if its fixture bookingRef doesn't contain
  the literal marker `CONTRACT-F2-FIXTURE`, so a future edit cannot silently repoint this
  live, mutating call at a real booking reference (added per review — A5 is the one check
  that shares `NATIONAL_SHOW_ID` with production data, so this is belt-and-braces on top of
  the fixed-id/no-generated-refs design already in place).

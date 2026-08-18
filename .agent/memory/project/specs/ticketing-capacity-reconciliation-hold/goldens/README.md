# Golden — capacity tracking already exists; this contract closes one interaction gap

## What Brad actually asked for, and what's already true

Brad: "we need to be tracking capacity. So tickets for a show need to be counted down
off the capacity the show can handle."

That system **already ships**, per-ticket-type, and is race-safe. Read the code before
assuming otherwise:

1. **Capacity is set in Sanity**, per `ticketType` document (`sanity/schemas/documents/ticketType.ts`
   `capacity` field, required, `min(0)`, enforced again server-side — "a ticket type with
   no capacity cannot be sold"). This answers "granularity" (per-type, not per-show or
   per-day — correct given real categories are Adult/Pensioner/Child/Member/Exhibitor)
   and "who sets it" (an editor, in Studio).
2. **Counting is transactional and race-safe.** `app/api/tickets/checkout/route.ts`'s
   `reserveTicket()` reads the held count (`lib/data/tickets.ts`
   `getSoldCountsByTicketType`) and writes the reservation inside ONE
   `db.runTransaction()`. This is not a claim — it is a *proven, shipped, already-green*
   property: `contracts/contract-ticketing-hardening.yaml` F2 +
   `contracts/checks/ticketing-hardening/check-capacity-no-oversell.mjs` (A6) reproduces
   the exact defect QA once found (49/50 + 5 concurrent POSTs -> 5x 201, ending at
   54/50), fixed it, and asserts "5 CONCURRENT checkout POSTs at the last seat produce
   exactly 1 success" against a REAL running server and REAL Firestore — not a
   sequential unit test, not a mock. See
   `contracts/golden/ticketing-hardening/capacity-transaction.golden.md`. **This
   contract does not re-litigate that property — it is already the single most
   rigorously proven property in the ticketing system.**
3. **Reserved consumes capacity, same as paid** (`RESERVED_OR_PAID` in
   `lib/data/tickets.ts`) — otherwise two buyers mid-checkout for the last seat could
   both be shown "available". Release is lazy: a reservation's `expiresAt`
   (`RESERVATION_TTL_MINUTES = 30`) simply stops counting once passed. No sweeper, no
   cron, no status-flipping race against the ITN.
4. **Sold-out surfaces as a boolean per type**, not a live count
   (`app/(marketing)/tickets/page.tsx`: `soldOut: (soldCounts[t.slug] ?? 0) >=
   t.capacity`), plus an "all sold out" banner. This is already the privacy-conscious
   choice the mission brief suggested ("Limited availability" over a raw number) — no
   change recommended, no decision needed from Brad.
5. **Enforcement is server-side and independent of the UI** — the checkout route's own
   transaction re-checks capacity regardless of what the page showed
   (`over-capacity` -> HTTP 409 with Sanity's `soldOutMessage`). A disabled button on
   the page is not what stops overselling; the transaction is.

**Conclusion: do not rebuild any of the above.** Items 1, 2 (concurrency), 3
(reserved-vs-paid + release), 4 (granularity + display), 5 (who sets it), and 6
(sold-out enforcement) from the dispatch brief are already correctly designed and
shipped. Nothing here needs Brad's decision — the existing choices match what the brief
itself recommends.

## The one real gap: reconciliation interaction (dispatch brief point 3)

`lib/data/tickets.ts`'s `stillHoldsSeat()` releases a `reserved` document's seat the
instant its `expiresAt` passes — regardless of *why* it's still `reserved`. Almost
always that's correct (an abandoned checkout). But `order-reconciliation` (F1, already
implemented in this repo — `lib/reconciliation.ts`, `app/api/admin/reconcile-orders/route.ts`)
exists specifically because a `reserved` order past its `expiresAt` can ALSO mean: the
buyer paid at PayFast, the ITN failed to flip the order to `paid`, and it's stuck. Three
real examples: `5KYDSBMT38KX`, `R06HZ12P06EY`, `G08QJQK278NY` (backlog.md "P1 — Stranded
'reserved' orders").

Today, the moment such an order's `expiresAt` passes, its seat silently re-enters
inventory (`stillHoldsSeat` returns `false`) and can be sold to a second buyer — even
though the first buyer may already hold a real, paid ticket for it. That is a genuine
oversell, just not the concurrency-race kind: two people end up believing they hold the
same seat, and nothing catches it until someone tries to check in.

`order-reconciliation` F1 is deliberately Phase-1-only (detect + alert a human, never
auto-settle — see its goldens README "Recovery — deliberately NOT built in this
contract"). It writes `Order.reconciliationAlertedAt` the moment a human has been
notified. This contract's only job: **once a human has been alerted that a `reserved`
order might actually be paid, stop releasing its seat** — hold it until a person
resolves the order one way or the other (a future settle/cancel feature, out of scope
here). This is a conservative default: it can under-sell by at most the number of
currently-unresolved alerts (bounded, visible, and alerted on by design), never
over-sell.

## Required changes (small, additive — read the existing code before writing)

1. **`types/index.ts`** — add `reconciliationAlertedAt?: Timestamp | null` to the
   `Ticket` interface, same field name and type as `Order.reconciliationAlertedAt`
   already carries (line ~200). Comment: duplicated from the order onto the position
   because `lib/data/tickets.ts`'s capacity count reads the `tickets` collection, not
   `orders` — same "duplicate onto both" precedent `lib/orders.ts` already documents for
   `amount`/`purchasedAt`.

2. **`lib/reconciliation.ts` `markOrdersAlerted`** — currently writes ONLY
   `orders/{orderId}.reconciliationAlertedAt` (module header says "Writes ONLY
   `reconciliationAlertedAt`... never `status`, `amount`, `gatewayPaymentId`, or
   `purchasedAt`" — that boundary is preserved, just widened to a second document with
   the *same* field). For each `orderId`, additionally resolve its position(s) via
   `db.collection('tickets').where('orderId', '==', orderId).get()` and update
   `reconciliationAlertedAt` on each with the same `now` value, in the same
   `Promise.all`. Still writes nothing else, on either collection. Keep the function's
   existing `deps.db` injection so the fake-store proof (A3 below) needs no live
   Firestore.

3. **`lib/data/tickets.ts` `stillHoldsSeat`** — export it (currently module-private;
   the pure-function proof below needs to call the real one, not a re-implementation),
   and add one branch, checked before the expiry check:
   ```
   if (data['reconciliationAlertedAt']) return true;
   ```
   Comment it: a reconciliation alert means a human has been told this order may be
   paid at the gateway despite showing `reserved`; never auto-release the seat while
   that's unresolved — see order-reconciliation's own "never auto-settle" boundary, which
   this mirrors (holding a seat is not settling a payment).

Nothing else changes. `getSoldCountsByTicketType`'s signature, the checkout route, the
ITN route, and the `/tickets` page are untouched — they already call `stillHoldsSeat`
(indirectly) and inherit the new behaviour for free.

## Assertions — what each proves and what false state would still pass it

- **A1** (`pnpm exec next build`): the change compiles in the real Next.js build, not
  just under `tsc` in isolation. False-pass risk: none realistic for a compiler error;
  this proves "compiles", not "correct" — A2-A4 exist for that.

- **A2** (pure `stillHoldsSeat` truth table, `npx tsx`, imports the REAL exported
  function from `lib/data/tickets.ts`): five cases —
  (1) `status: 'paid'`, any/no `expiresAt` -> `true` (existing, unconditional).
  (2) `status: 'reserved'`, `expiresAt` in the future -> `true` (existing).
  (3) `status: 'reserved'`, `expiresAt` in the past, no `reconciliationAlertedAt`
      -> `false` (existing bug-preventing behaviour — an ordinary abandoned checkout
      MUST still release; this is the negative control that stops a lazy "always hold"
      fix).
  (4) `status: 'reserved'`, `expiresAt` in the past, `reconciliationAlertedAt` SET
      -> `true` (**the new behaviour** — this is the case that was `false` before this
      contract and must be `true` after).
  (5) `status: 'reserved'`, no `expiresAt` field at all -> `true` (existing fail-closed
      regression guard — must not be broken by this change).
  False-pass risk: a version that returns `true` unconditionally for `reconciliationAlertedAt`
  truthy OR falsy (i.e., doesn't actually branch on it) would still pass cases 1, 2, 5
  but is caught by case 3 turning `true` when it must stay `false`. A version that checks
  `reconciliationAlertedAt` AFTER the expiry `return` (dead code) is caught by case 4
  staying `false`.

- **A3** (fake-store `markOrdersAlerted` proof, `npx tsx`, imports the real function
  with an injected fake `deps.db`, no live Firestore): one order + two positions
  sharing its `orderId` (proving multi-position orders, not just the single-position
  case, are handled) + one unrelated position with a DIFFERENT `orderId` (negative
  control). After calling `markOrdersAlerted([orderId], now)`: both matching positions
  have `reconciliationAlertedAt === now`; the unrelated position is untouched; the
  order's own other fields (`status`, `amount`) are unchanged (existing boundary,
  re-proven after the edit). False-pass risk: a version that queries `tickets` by
  `bookingRef == orderId` instead of `orderId == orderId` (field-name mixup) would
  write nothing and be caught by the "both matching positions updated" check failing.
  A version that also flips `status` would be caught by the unchanged-fields check.

- **A4** (live, sentinel-tagged, `npx tsx`): the real end-to-end proof against the real
  production capacity-counting path. Using `contracts/checks/ticketing-hardening/_shared.mjs`'s
  `db()`, `sentinelEmail()`, `sweepSentinels()`, `TARGET_TICKET_TYPE` ('exhibitor',
  price 0 — same fixture type the hardening suite already uses safely):
  1. Sweep sentinels (`sweepSentinels()`), read the baseline held count for
     `TARGET_TICKET_TYPE` via the REAL `getSoldCountsByTicketType(NATIONAL_SHOW_ID)`
     (imported from `lib/data/tickets.ts`, unmodified call signature).
  2. Write one sentinel-tagged `orders/{id}` + `tickets/{id}` pair directly via `db()`,
     `status: 'reserved'`, `expiresAt` already in the past, no
     `reconciliationAlertedAt`.
  3. Assert `getSoldCountsByTicketType` does NOT count it (`exhibitor` count still equals
     baseline) — negative control proving an ordinary stranded/abandoned reservation
     still releases correctly (this contract must not regress that).
  4. Call the REAL `markOrdersAlerted([orderId], Timestamp.now())` against live
     Firestore (no injected `deps.db` — this is the one live write, and it writes
     exactly the one field the function is documented to write, same posture as
     order-reconciliation's own A4).
  5. Assert `getSoldCountsByTicketType` NOW counts it (`exhibitor` count == baseline +
     1) — proving the hold works through the real production path, not a
     reimplementation of it.
  6. `sweepSentinels()` in a `finally`, then poll `getSoldCountsByTicketType` back down
     to baseline (same `assertSeatsReleased` pattern `check-capacity-no-oversell.mjs`
     already uses) so the next check never inherits a held seat from this one.
  False-pass risk: a version of `stillHoldsSeat` that holds every `reserved` document
  regardless of `reconciliationAlertedAt` would pass step 5 but is caught by step 3
  (the negative control) never releasing. A version that never actually persists
  `reconciliationAlertedAt` to Firestore (e.g. a no-op `markOrdersAlerted`) is caught by
  step 5 staying at baseline instead of baseline+1.

## Explicitly out of scope (say so, don't silently build it)

- **Auto-settling or auto-cancelling** a reconciliation-alerted order. This contract only
  stops premature *release*; resolving the order (confirm paid via a manual PayFast
  lookup, or cancel and refund) is a future feature and Brad's call when
  `order-reconciliation` gets a Phase 2. Flagged, not decided, here.
- **Clearing the hold.** Once `reconciliationAlertedAt` is set, this contract's seat-hold
  never clears itself — only a future settle/cancel feature that changes `status` away
  from `reserved` clears it (branch 1 of `stillHoldsSeat` already returns `true`
  unconditionally once `status !== 'reserved'`, so a status change is sufficient; no new
  clearing logic is needed here).
- **A public remaining-count display, or changing the sold-out UI.** Already correct
  (boolean-only) per point 4 above — no change recommended.

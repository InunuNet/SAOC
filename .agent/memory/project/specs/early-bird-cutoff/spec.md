# early-bird-cutoff

Brad and Lee-Ann, 16 Nov call: early bird ends on a date, not when N tickets sell. Read from origin/main aab7ed0a.
The two edit files are identical in the main checkout, so file:line refs hold in both.

## Findings
- The "N left" count is a pool, not a field. `buildPool` (lib/data/ticket-card-view-models.ts:118-131) sums sold units of the two
  early-bird SKUs and the two regular pass SKUs against the smallest capacity of the pool members. It feeds `pool` (:308-325),
  the early-bird card `scarcity` with label `POOL_LABEL` "early-bird left" (:16, :239-262) and the slot swap `poolOpen` (:227-230).
- Shown by `PoolBanner` (components/tickets/keepsake/PoolBanner.tsx:30-80, mounted app/(nos)/national-show/tickets/page.tsx:167)
  and `TicketCount` (components/tickets/keepsake/parts.tsx:125-155). Copy: TICKET_COPY.poolTitle and poolText in
  lib/data/ticket-presentation.ts:240-273 ("The early bird ends when the pool sells out").
- The cap is real. Both early-bird docs carry `capacity` 500 and `capacityPool: 'admission-early-bird'`
  (lib/provisional-figures.ts:81, :134-137, :202-205; Sanity overrides when set). Checkout enforces it:
  `capacityByType[poolKey]` (app/api/tickets/checkout/route.ts:652-658).
- Source: Brad's 7 Oct news ("Earlybird now ends after 500 tickets are sold not at a specific date", provisional-figures.ts:75-76).
  The 16 Nov call reverses it.
- Capacity vs early-bird stock: day SKU `early-bird` is separate. Its physical limit is the day-visitor 1000-per-day cap (route.ts:769-830),
  so the 500 is purely an early-bird count. `weekend-pass-early-bird` has no other ceiling: its 500 doubles as capacity (regular
  weekend-pass 300 is an unconfirmed open question, provisional-figures.ts:165-171). See Decisions.
- Cutoff today: Sanity `earlyBirdCutoff` (sanity/schemas/documents/ticketType.ts:78), both seeds null. `isWithinEarlyBirdWindow`
  (lib/checkout-reservation.ts:363) is true through the whole cutoff day UTC. Checkout charges `regularPrice` after it, or 409s
  "Early-bird pricing ... has closed" when null (route.ts:665-680). Null cutoff = on sale, no restriction (checkout-reservation.ts:385).
- Card bug: hub `toTypeInput` falls back to the regular price after the cutoff (ticket-hub-source.ts:76-90) but the early-bird SKU
  keeps the slot, because only `poolOpen` swaps it. Proven by the golden check against the current tree: after the cutoff the
  card says early-bird slug at R380.
- Sold counts are derived live from Firestore tickets, reserved or paid (lib/data/tickets.ts:55). There is no counter or stock doc.

## The change
1. `TicketTypeInput` gains optional `earlyBirdOpen?: boolean` (absent = true). The builder stays clock-free.
2. ticket-hub-source.ts `toTypeInput` sets `earlyBirdOpen: isWithinEarlyBirdWindow(now, t.earlyBirdCutoff ?? null)`
   (import it from `@/lib/checkout-reservation`, already imported there); pass nothing else new.
3. Builder `buildPassCard`: the early-bird SKU holds the slot while its `earlyBirdOpen` is not false, else the regular SKU.
   The early-bird card has `scarcity: null` and state from `resolveTicketCardState` with no remaining counts. Per-day cells (Day Pass)
   keep their real counts. Delete `buildPool`, `POOL_LABEL`, and the `pool` parameter; `TicketCardsOutput.pool` is always null.
4. No component or copy edits: a null `pool` renders no banner and null `scarcity` renders no count.

## Hydrogen may edit only
- lib/data/ticket-card-view-models.ts
- lib/data/ticket-hub-source.ts

## Gaps
- No approved "until <date>" or "ends" wording exists. v13 goldens (launch-weekend/goldens/f18b/v13-copy.json:113,141) and
  TICKET_COPY only have the pool sentence and past-tense "Early bird ended". Slot shows nothing. Lee-Ann supplies date and wording.
- Pool banner copy (poolTitle, poolText x4) and `PoolBanner` become dead code; left in place, removal needs sign-off.
- Superseded regression checks (Hydrogen must not edit them; an owner updates them after): f18 `check-q-viewmodels.mts` cases
  "pool open", "pool low (8%)", "pool exhausted", "sanity capacity is not provisional", "provisional capacity is flagged" (pool parts).
  `check-s` PoolBanner cases still pass (component untouched); `check-t-hub-live` expects a live banner.
- The buy page of an expired early-bird slug reached by direct link shows its early-bird price; checkout returns the 409 above.
- Gate runs with CHECK_ROOT set to a clean worktree from origin/main; the main checkout is dirty with other missions (A4 fails there).

## Decisions for Brad
1. Weekend early bird has no physical ceiling once the count cap goes. Pick a venue number for `weekend-pass-early-bird` capacity, or
   keep 500. Checkout still enforces whatever Sanity says, so the card can read "on sale" while checkout refuses at 500.
2. Data writes, mine to describe only: set `capacity` on the two early-bird Sanity docs; set `earlyBirdCutoff` and a `regularPrice`
   (needed or checkout 409s after the date) once Lee-Ann gives the date; reset test tickets: reserved/paid tickets for the NOS show
   with ticketType `early-bird` or `weekend-pass-early-bird` are the count. Voiding them is a Firestore write.
3. Retire the pool banner components and copy, or keep them for a possible later use.

# ticketing-flow-redesign F3 — decision record

Mission: `.agent/memory/project/missions/2026-08-24-ticketing-flow-redesign.md`, feature F3,
milestone M2. Depends on F2 (renders inside the dedicated `/tickets/day-visitor` buy screen F2
creates) — implement after F2, or in parallel against F2's goldens, but do not merge before F2's
screen shell exists.

## 0. Scope

Mission item (4): Day Visitor needs a per-day quantity picker — the buyer picks how many tickets
for EACH specific show day in one screen (e.g. "2 for Thu, 1 for Sat"), not the current
one-row-per-unit "pick a day for ticket #1, pick a day for ticket #2, …" flow.

## 1. What exists today (baseline, from F5)

`components/tickets/CartDayPicker.tsx` renders ONE ROW PER UNIT of quantity for any
`requiresDaySelection` type — buy 3 Day Visitor tickets, get 3 separate "which day?" dropdowns,
each independently choosing one of the show's days (`docs/f5-day-selection-attendees.md` §"UI: Day
Picker"). The buyer sets a total quantity first (via `TicketTypeCard`'s stepper), THEN assigns a
day to each resulting unit one at a time. This is the exact UX Brad's review flagged as wrong for
Day Visitor — he wants the reverse: pick quantities per day directly, no separate "how many total"
step.

The WIRE FORMAT this produces is unaffected by this feature: `POST /api/tickets/checkout`'s
`lineItems` array is, and remains, `{ ticketType, attendeeName, attendeeEmail, chosenDay }[]` —
one entry per ticket, `chosenDay` a `YYYY-MM-DD` string. F3 changes ONLY how the buyer arrives at
that array on the Day Visitor screen — `app/api/tickets/checkout/route.ts`'s per-line-item
`chosenDay` validation (`docs/f5-day-selection-attendees.md` §"What This Feature Built") is
untouched, since it already validates one line item at a time regardless of how the client built
the array.

## 2. New component: `DayQuantityPicker.tsx`, one row per DAY, not per unit

**Decision:** new `components/tickets/DayQuantityPicker.tsx` renders one row per entry in
`showDays: string[]` (the SAME single source of truth `CartDayPicker` already uses —
`buildShowWindow()`/`computeShowDays()`, never a second date computation, per
`docs/f5-day-selection-attendees.md`'s existing "single-source-of-truth enforcement" rule), each
with its OWN quantity stepper (reusing the same +/−/number-input pattern `TicketTypeCard`'s
stepper already uses, not a new stepper implementation). State shape:

```ts
quantitiesByDay: Record<string, number>   // keyed by 'YYYY-MM-DD', values >= 0
```

The type's total quantity is the SUM of `quantitiesByDay`'s values — never a separately
maintained number that could drift from the per-day breakdown.

## 3. `TicketPurchaseForm` renders `DayQuantityPicker` XOR `CartDayPicker`, never both

**Decision:** `TicketPurchaseForm.tsx` picks between the two day-selection UIs by cart shape,
not by a new prop the caller must remember to pass:

```ts
const useDayQuantityPicker =
  ticketTypes.length === 1 && ticketTypes[0].requiresDaySelection === true;
```

`useDayQuantityPicker === true` (F2's dedicated single-type screen, for `day-visitor` specifically
today): render `DayQuantityPicker`, HIDE `TicketTypeCard`'s own quantity stepper for that type
(single source of truth for "how many" is the per-day breakdown — showing both would let a buyer
edit two numbers that must always agree), and skip rendering `CartDayPicker` entirely.
`useDayQuantityPicker === false` (the Conferences/Workshops shared-cart flow, §4 below): behavior
is BYTE-IDENTICAL to today — `CartDayPicker` renders as before, `TicketTypeCard`'s stepper is
shown as before. `CartDayPicker.tsx` itself is NOT deleted or modified.

**Why a derived condition, not a new required prop:** the condition already fully describes when
the new UX applies ("exactly one day-selection type in this screen's cart") — a caller-supplied
boolean would just be this same computation done by hand at each call site, an extra place to get
wrong.

## 4. Why not modify `CartDayPicker.tsx` in place

No product other than Day Visitor sets `requiresDaySelection` today, but Conferences/Workshops'
shared multi-type cart (`CategoryTicketsPage`/`TicketPurchaseForm`, unchanged by F2 §1) is
generic infrastructure that could carry a future day-selecting Conference/Workshop product
alongside OTHER, non-day-selecting types in the SAME cart. A per-day QUANTITY picker only makes
sense when day-selection is the cart's only concern (F2's single-type screen); mixed into a
multi-type cart, "2 for Thursday" doesn't compose cleanly with "1 Symposium ticket" in the same
list. Keeping `CartDayPicker`'s existing per-unit model for that generic case, and adding
`DayQuantityPicker` as the single-type specialisation, avoids forcing one component to serve two
structurally different carts.

## 5. Line-item expansion: new pure function, wire format unchanged

**Decision:** new pure export in `lib/cart.ts`:

```ts
export function expandDayQuantitiesToLineItems(input: {
  ticketType: string;
  attendees: CartAttendee[];
  quantitiesByDay: Record<string, number>;
}): { ticketType: string; attendeeName: string; attendeeEmail: string; chosenDay: string }[]
```

Produces exactly `sum(quantitiesByDay values)` line items — `qty` copies per day, each carrying
that day's ISO string as `chosenDay`. Order is day-ascending (iterates `Object.entries` in
insertion order, and `quantitiesByDay` is always built by iterating `showDays` — already
chronological — so no separate sort is needed). Throws if `attendees.length` does not equal
`sum(quantitiesByDay values)`, the exact same invariant `buildLineItemsFromCart()` already
enforces for every other ticket type (§below).

**Correction (post-QA, 2026-08-24): there is no "one buyer-identity pair for the whole screen"
baseline.** The original draft of this decision claimed `attendeeName`/`attendeeEmail` were "the
ONE buyer-identity pair collected once for the whole screen ... existing `CartAttendeeFields`
behavior for a non-named-attendee type." That claim was factually wrong and was never true of
`CartAttendeeFields.tsx`/`cartValidation.ts` — grep confirms zero references to
`requiresAttendeeNames` in either file. `CartAttendeeFields` renders, and `validateAttendees`
requires, one full name+email panel **per unit** in `attendeesByType[slug]` for every ticket
type unconditionally — the component's own header comment says so: "the same per-position
requirement the backend already enforces uniformly across every ticket type today."
`buildLineItemsFromCart()` (§ existing, unchanged) enforces this structurally: it throws if
`attendees.length !== quantity`. Day Visitor was never exempt from this; `requiresAttendeeNames`
(VIP-only, per `docs/f4-admission-products.md`) only gates whether a *non-empty name* is
required server-side (F5's `isNamedAttendeeSatisfied()`), not whether distinct per-unit rows are
collected client-side.

The original (uncorrected) design passed a single `attendeeName`/`attendeeEmail` into
`expandDayQuantitiesToLineItems` and stamped it onto every expanded line item, while the
unchanged `CartAttendeeFields` UI kept rendering and requiring one distinct panel per unit. A
buyer purchasing 2 Thursday + 1 Saturday Day Visitor ticket filled in 3 real people's names and
emails; submit silently discarded rows 1 and 2 and used only row 0's identity for all 3 tickets
— a 100% client-side data-loss/misidentification bug with no server-side check to catch it
(confirmed: no cross-line-item uniqueness requirement at checkout). Two real attendees would
have been checked in at the door under a stranger's identity.

**Corrected decision:** `expandDayQuantitiesToLineItems` takes the full `attendees: CartAttendee[]`
array (the same `attendeesByType[slug]` rows `CartAttendeeFields` already collects, in the same
row order), not a single identity pair. It flattens `quantitiesByDay` into day-ascending order
(one entry per unit, same order as before) and zips each entry with the attendee row at the same
flattened index — attendee row 0 goes to the first unit in day-ascending order, row 1 to the
second, and so on. This matches what the UI already visually promises (N panels = N real
attendees) and requires no change to `CartAttendeeFields.tsx`/`cartValidation.ts` (still out of
scope, §6) — only to `expandDayQuantitiesToLineItems` itself and its one call site.

`useTicketCart.ts` calls this function (instead of its existing per-unit line-item builder) when
`useDayQuantityPicker` is true, to build the `lineItems` array posted to
`POST /api/tickets/checkout`, passing `attendeesByType[slug] ?? []` directly — **never**
`attendeesByType[slug]?.[0]`. The POST body shape is otherwise identical to today.

## 5.1 Second correction (post-QA re-verification, 2026-08-24): per-day attendee state

**The §5 correction above fixed WHAT was wrong (identity-collapsing) but not the deeper cause.**
QA's re-verification found a second, distinct real bug: attendee identities can still get zipped
to the WRONG day whenever a buyer edits an earlier-ordered day's quantity AFTER already having
entered a later day's quantity — an ordinary "actually, add one more Monday ticket" revisit.

Root cause, verified empirically against the real code: `quantitiesByDay` was built via
`{ ...quantitiesByDay, [day]: quantity }` on each interaction — object key insertion order is
INTERACTION order, not showDays chronological order — while `syncAttendeeRows` appended/truncated
`attendeesByType[slug]` strictly at the TAIL, driven only by the running total, agnostic of which
specific day triggered the change. The two orderings only agree if the buyer fills each day
exactly once, strictly in showDays order. Reproduced: Mon+1 → Wed+1 → Mon+1-again with 3 distinct
named attendees Alice/Bob/Carla submits `Alice→Mon, Bob→Mon, Carla→Wed` instead of the buyer's
actual intent `Alice→Mon, Bob→Wed, Carla→Mon` — Bob and Carla silently swapped onto the wrong day,
invisible to the buyer since `CartAttendeeFields.tsx` shows no day label per row (still correctly
out of scope, §6).

**Corrected decision:** restructure state to per-day attendee arrays —
`attendeesByDay: Record<string, CartAttendee[]>` — so each day's own rows always stay grouped
with that day regardless of what order the buyer edits quantities in, rather than sorting a flat
array before flattening (which would not fix the deeper coupling between "which row is at what
index" and "which day the buyer meant it for"). `quantitiesByDay` becomes a DERIVED read
(`attendeesByDay[day]?.length`), not independently-tracked state, so it can no longer drift from
the row arrays by construction. Full corrected design, code, and truth table:
`day-quantity-picker.golden.md` §0-3 (supersedes this section's and §5's `useTicketCart.ts`/
`lib/cart.ts` code samples — those are kept above for the historical record of what was tried and
why it was insufficient, not as the current target).

## 6. Explicitly out of scope

- `app/api/tickets/checkout/route.ts` — no change. Per-line-item `chosenDay` validation already
  works against ANY array shaped correctly, regardless of client-side construction method.
- VIP's named-attendee flow, `CartAttendeeFields.tsx` — unchanged.
- Conferences/Workshops pages and their use of `CartDayPicker` — unchanged (§3-4).
- Per-day CAPACITY enforcement (counting sold Day Visitor tickets per specific day rather than
  across the whole show) — explicitly out of scope per `docs/f4-admission-products.md`'s "Known
  scope gap" and `docs/f5-day-selection-attendees.md`'s "What F5 Does NOT Do"; still true here.
  This feature only changes how a quantity-per-day INTENT is collected and expanded into line
  items, not how capacity is checked against them.

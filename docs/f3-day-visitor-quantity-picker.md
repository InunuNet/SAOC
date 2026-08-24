# F3: Day Visitor Per-Day Quantity Picker

**Feature:** F3 of mission `ticketing-flow-redesign` (milestone M2). Day Visitor buyers select how many tickets for EACH specific show day in one dedicated screen, rather than picking a total quantity first and then assigning each individual unit to a day.

**Contract:** `contracts/golden/ticketing-flow-redesign-f3/README.md` and `day-quantity-picker.golden.md` — the full design record; do not duplicate it, read it first. **This doc is the guide; that is the specification.**

**Status:** Gated 15/15, QA-passed (×3), Codex GPT-5.5 cross-model-passed. Browser-verified (one minor stale-error-message bug found and fixed in testing).

---

## What This Feature Changed

### Before (F5 per-unit flow, still used for Conferences/Workshops)

`CartDayPicker` renders one row per **unit** of any `requiresDaySelection` type:
- Buy 3 Day Visitor tickets → 3 separate "which day?" dropdowns
- Buyer sets total quantity first (via `TicketTypeCard`'s stepper), then assigns a day to each unit one at a time
- Wire format: `POST /api/tickets/checkout` receives `lineItems: { ticketType, attendeeName, attendeeEmail, chosenDay }[]` — one entry per ticket

### Now (F3 per-day flow, dedicated single-type screens only)

`DayQuantityPicker` renders one row per **day**:
- Same show days as `CartDayPicker` already uses (from `buildShowWindow()` / `computeShowDays()`, never hardcoded)
- Buyer increments/decrements quantity directly per day: "2 for Thursday, 1 for Saturday"
- Wire format unchanged: same `lineItems` array to checkout, one entry per ticket, all validation identical
- **Single screen, single UX entry point:** renders ONLY when exactly one ticket type is on the buy screen AND that type has `requiresDaySelection: true` (F2's dedicated single-type `/tickets/day-visitor` screen, not the Conferences/Workshops multi-type cart)

---

## State Model: `attendeesByDay` (Per-Day Attendee Arrays)

The key design decision: track attendee rows **keyed per-day**, not as a flat array.

```ts
type AttendeesByDay = Record<string, CartAttendee[]>;
// Example state after buyer sets "2 for Thu 16, 1 for Sat 18":
// {
//   '2027-09-16': [
//     { attendeeName: 'Alice', attendeeEmail: 'alice@example.com' },
//     { attendeeName: 'Bob', attendeeEmail: 'bob@example.com' }
//   ],
//   '2027-09-18': [
//     { attendeeName: 'Carla', attendeeEmail: 'carla@example.com' }
//   ]
// }
```

### Why Per-Day, Not Flat?

Two real bugs existed in earlier designs:

**Bug 1: Shared Identity Collapse** — A flat `attendees` array paired with a separate `quantitiesByDay` map silently discarded rows. Example: buyer fills 3 attendee panels (Alice, Bob, Carla) with quantities "2 for Thu, 1 for Sat", but submit silently used only Alice's identity for all 3 tickets, collapsing Bob and Carla's data without a server-side check to catch it. Door check-in would admit strangers under Alice's name.

**Bug 2: Day Misassignment on Interleaved Edits** — A flat array resized strictly at the tail, while `quantitiesByDay` was keyed by edit interaction order (not calendar order), created an ordering mismatch. Example: buyer adds "1 for Mon, 1 for Wed, then 1 more for Mon" (a realistic "wait, add one more Monday ticket" revision). Object key insertion order ≠ showDays chronological order, so final submit mapped Alice→Mon, Bob→Mon, Carla→Wed instead of the buyer's actual intent Alice→Mon, Bob→Wed, Carla→Mon.

**Solution:** Each day's array is sized independently. Editing Monday's stepper ONLY touches Monday's array; Wednesday's rows are never touched, regardless of edit order. `quantitiesByDay` (the UI-facing number) is derived as `attendeesByDay[day]?.length`, not separately tracked — so the two can never drift from each other by construction.

---

## Components and Helpers

### New: `DayQuantityPicker.tsx`

Renders one stepper row per day in `showDays` order:
- Increment/decrement buttons and number input, same UX pattern as `TicketTypeCard`'s existing stepper
- **No calendar date computation in this component** — all days come from the `showDays` prop, same rule `CartDayPicker` already follows
- Disabled during checkout submission
- No day-of-week labels yet (ISO `YYYY-MM-DD` only; friendly formatting is a non-blocking follow-up, see below)

### New: `lib/cart.ts` helpers for per-day state

Four pure functions manage the `attendeesByDay` state:

1. **`updateAttendeesByDay(attendeesByDay, day, quantity, makeAttendee)`** — Resizes only that day's array; every other day untouched.

2. **`flattenAttendeesByDay(attendeesByDay, showDays)`** — Flattens to a single `CartAttendee[]` in `showDays` chronological order (never object key insertion order), used for both rendering and submit-time line-item expansion.

3. **`locateFlatAttendeeIndex(attendeesByDay, showDays, flatIndex)`** — Maps a flat row index (the index `CartAttendeeFields` renders) back to `{ day, localIndex }`. Resolves which day an attendee panel belongs to.

4. **`expandAttendeesByDayToLineItems(input: { ticketType, attendeesByDay, showDays })`** — Expands to the wire format: one line item per attendee, each carrying its day's ISO string as `chosenDay`, in `showDays` order. **No separate quantity map needed** — each day's quantity IS that day's array length.

### Updated: `useTicketCart.ts`

- Takes `showDays: string[]` as a second parameter (needed to resolve flat row indices back to days)
- Tracks `attendeesByDay` state instead of a flat `attendees` + `quantitiesByDay` pair
- Derives `quantitiesByDay` as a read: `{ '2027-09-16': 2, '2027-09-18': 1, ... }`
- Routes attendee-field updates (from `CartAttendeeFields`) to `attendeesByDay` via `updateAttendeeFieldByFlatIndex` when the day-quantity-picker is active
- At submit time: calls `expandAttendeesByDayToLineItems()` to build the line items array

### Updated: `TicketPurchaseForm.tsx`

- Derives `useDayQuantityPicker = ticketTypes.length === 1 && ticketTypes[0].requiresDaySelection === true`
- Renders `DayQuantityPicker` XOR `CartDayPicker`, never both (same form, two different day-selection UIs)
- Hides `TicketTypeCard`'s quantity stepper when `useDayQuantityPicker` is true (single source of truth: the per-day breakdown)
- Conferences/Workshops (unchanged): still render `CartDayPicker` + visible `TicketTypeCard` stepper; their `CartAttendeeFields` still render one panel per unit

---

## UI Flow: Day Visitor Buyer Journey

1. Visit `/tickets/day-visitor` (F2's dedicated single-type screen)
2. See vertical card for Day Visitor with **no quantity stepper** (hid by F3)
3. Below attendee panels, see `DayQuantityPicker`: one row per show day (e.g. "Thu 16", "Fri 17", "Sat 18", "Sun 19")
4. For each day: increment/decrement the quantity with +/− buttons or type directly
5. As quantities change: `CartAttendeeFields` above re-renders to show N total panels (sum of all per-day quantities)
6. Fill in each attendee's name and email across the total panels (no day labels on the panels themselves — out of scope)
7. Submit → line items built with each attendee zipped to the day of that unit in chronological order
8. Checkout validation (F5, unchanged) confirms each `chosenDay` is within the show window

---

## Files Changed

- `lib/cart.ts` — `AttendeesByDay` type, `updateAttendeesByDay()`, `flattenAttendeesByDay()`, `locateFlatAttendeeIndex()`, `updateAttendeeFieldByFlatIndex()`, `expandAttendeesByDayToLineItems()` (new exports)
- `components/tickets/DayQuantityPicker.tsx` (new component)
- `components/tickets/useTicketCart.ts` — added `showDays` parameter, replaced `quantitiesByDay`/`chosenDayByType` state with `attendeesByDay` for day-quantity-picker flow
- `components/tickets/TicketPurchaseForm.tsx` — added `useDayQuantityPicker` derived condition, conditional render logic, hide stepper when needed, pass `showDays` to `useTicketCart`
- `app/(marketing)/tickets/day-visitor/page.tsx` — passes `showDays` to `TicketPurchaseForm`

---

## What F3 Does NOT Do

- **Modify `CartDayPicker.tsx`** — unchanged; still used for Conferences/Workshops multi-type cart flow
- **Modify `CartAttendeeFields.tsx`** — unchanged; still renders one panel per unit (total count, no day awareness on the panel itself)
- **Change checkout validation** (F5) — `POST /api/tickets/checkout` still validates `chosenDay` per line item the same way
- **Add day-of-week formatting** — shows ISO `YYYY-MM-DD` strings (e.g. "2027-09-16"), not "Thursday, 16 September" yet

---

## Non-Blocking Follow-Up: Day Label Formatting

Day labels currently render as raw ISO date strings (`2027-09-16`) instead of a friendly format. A future pass should compute day-of-week from the Date object and render as "Thu, 16 Sept" or similar. This is UX polish, not a correctness issue, and does not affect the data model or validation. Consider for a future quick-fix backlog item.

---

## Sources

- `contracts/golden/ticketing-flow-redesign-f3/README.md` — design record, correction history (two real bugs and their fixes), truth tables for state expansion
- `contracts/golden/ticketing-flow-redesign-f3/day-quantity-picker.golden.md` — implementation spec for all new functions and components
- `docs/f5-day-selection-attendees.md` — the checkout validation that F3 feeds into, and the per-unit `CartDayPicker` flow used by other ticket types
- `docs/f4-admission-products.md` — the `requiresDaySelection` flag that gates which types use per-day picking

All three are load-bearing.

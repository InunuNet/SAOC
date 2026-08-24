# F5: Day Selection and Named Attendees on Positions

**Feature:** F5 of mission `multi-line-item-cart` (milestone M2). Day Visitor line items must carry a `chosenDay` validated against the active show's real date window; VIP line items get a secondary flag-driven check that their attendee name is non-empty. Both enforced server-side, per-line-item, in the checkout validation pass.

**Contract:** `contracts/golden/ticketing-f5-day-attendees/README.md` — the full design record; do not duplicate it, read it first. **This doc is the guide; that is the specification.**

**Status:** Gated 15/15, QA-passed (×2), Codex cross-model-passed.

---

## What This Feature Built

**Server-side enforcement, two gates per line item:**

1. **Day selection validation:** For any line item with `requiresDaySelection: true`, the checkout route rejects (400) if `chosenDay` is missing or falls outside the active show's `startDate`..`endDate` window. Invalid format (not `YYYY-MM-DD`) is rejected (400) at parse time, before the window check.

2. **Named attendee validation:** For any line item with `requiresAttendeeNames: true`, a new pure function `isNamedAttendeeSatisfied()` confirms the attendee name is non-empty via a flag-driven check — not a hardcoded slug, so a future second "named" product is covered by CMS data alone.

Both validations run in the same per-line-item pass that `parseLineItems` already enforces for `ticketType`/`attendeeEmail`; they block the checkout request atomically (400) before any Firestore write.

---

## Show Date Handling: SAST Timezone Offset Is Load-Bearing

The active show's `startDate` and `endDate` (from Sanity) are parsed via `buildShowWindow()` (reused from `lib/show-window-lookup.ts`, existing since F1). This function:

1. Parses the raw Sanity datetime values (strings with UTC offset, e.g. `'2027-09-16T00:00:00Z'`) into JavaScript `Date` objects via `parseUtcDatetime()` — a strict validator that rejects bare-parsed datetimes (a real published bug from prior work, see project memory `reference_firestore_timestamps_are_utc`).
2. Computes the inclusive list of calendar days via `computeShowDays(window)` using a **fixed UTC+2 offset** (South Africa Standard Time, no DST).

**Why UTC+2 is not arbitrary:** The show runs in South Africa (SAST, UTC+2). A date boundary like "2027-09-16" on a ticket must mean "September 16 in South Africa" at visitor arrival time, not "September 16 in UTC." Without the +2h offset, a naive `.getUTCDate()` on a date string like `'2027-09-16T00:00:00Z'` would derive "2027-09-15" locally (16:00 UTC previous day = 18:00 SAST that same day). This was a real defect found in prior work; **any future change to the offset or date-parsing logic must verify against both SAST-local dates and UTC round-trips.**

Example: `computeShowDays()` for a show `2027-09-16T00:00:00Z` to `2027-09-19T23:59:59Z` returns `['2027-09-16', '2027-09-17', '2027-09-18', '2027-09-19']` (four days, SAST-local). A Day Visitor picking `chosenDay: '2027-09-17'` is valid.

---

## Design Decisions: Why chosenDay Strips, Why It Joins Idempotency

### Decision 1: Strip chosenDay for Non-Day-Selection Types (Gap 1, Fixed Post-QA)

A VIP or Weekend Pass line item that accidentally includes a `chosenDay` in the request body is silently stripped to `null` server-side, not rejected as "extra field."

**Rationale:** This project's existing convention (F4, F1) is permissive-on-extra data — if the request includes an unused field, ignore it, never fail. Treating `chosenDay` as "reject for extra data" contradicts this and would make an unrelated request field a new failure mode for an otherwise-valid purchase.

**Implementation:** New pure function `resolveChosenDayForPosition(chosenDay: string | null | undefined, requiresDaySelection: boolean): string | null` in `lib/checkout-reservation.ts`. Returns the chosenDay only if `requiresDaySelection` is true; unconditionally `null` otherwise. Deliberately a named pure function (not an inline ternary) so a grep-proof and behavioral proof can verify it is actually called and in the right order, ruling out "the flag is read for the wrong purpose."

### Decision 2: chosenDay Joins Idempotency Match Key (Gap 2, Fixed Post-QA)

A checkout replayed with the same `idempotencyKey` but a *different* `chosenDay` for a Day Visitor line item is treated as a key-payload mismatch (409, "This Idempotency-Key was already used for a different purchase."), same as a divergent `ticketType` or `attendeeEmail` already are.

**Rationale:** `chosenDay` is a door-level access-control fact — "admit this visitor on September 17" — not a display string. A replay with a corrected attendee name is legitimate (F1's design: name is display data, not a security boundary); a replay with a different chosenDay is NOT — it changes what day access the purchaser receives.

**Why attendeeName is NOT also fixed:** `attendeeName` has had the identical structural gap since F1 (not in the idempotency match key). That is an intentional F1 design: correcting a typo on a retry is a legitimate replay. `chosenDay` fails the same structural test but lands opposite because it answers a different question. Widening the match key for chosenDay is F5's scope (it's F5's own new field); retroactively narrowing attendeeName's matching is a behavioral change to F1 with no F5 justification — keep it out.

**Implementation:** `lineItemsMatchExistingPositions()` now includes `chosenDay` in its match key alongside `ticketType` + `attendeeEmail`. Pre-existing Firestore documents from before F5 (which have no chosenDay field) are treated as having `chosenDay: null` for match purposes.

---

## Positions Storage and Validation at Checkout

- `Ticket` (types/index.ts) gains `chosenDay?: string | null`.
- `buildMultiReservationDocs()` writes `chosenDay: null` for every position (never `undefined`; Firestore rejects undefined field values).
- For Day Visitor: `chosenDay` is set to the validated input value.
- For other types: `chosenDay` is `null` (stripped by `resolveChosenDayForPosition`).

No per-day capacity counting, no per-day confirmation email, no per-day check-in logic — all deferred (F5's scope is the day-selection field and its validity check only; check-in validation is Stage 5, explicitly deferred per the mission brief).

---

## UI: Day Picker, Single-Source-of-Truth Days

### Per-Unit Model: `CartDayPicker.tsx` (Conferences/Workshops)

New component `components/tickets/CartDayPicker.tsx`:

- Renders one row per unit of any `requiresDaySelection` type with quantity > 0.
- Grouped by ticket type, same precedent as `CartAttendeeFields.tsx`.
- The list of selectable days comes ONLY from the `showDays: string[]` prop — no literal date anywhere in this component.
- Renders ISO `YYYY-MM-DD` format only (day-of-week display, if added later, must be computed from the Date object at render time, not typed as a separate string).
- Used by the shared-cart flow (Conferences/Workshops multi-type screens), unchanged by later features.

### Per-Day Model: `DayQuantityPicker.tsx` (Day Visitor Dedicated Screen, F3)

**F3 (`ticketing-flow-redesign`)** introduced an alternative UI for single-type screens: `components/tickets/DayQuantityPicker.tsx`, which renders one quantity stepper per DAY instead of per unit. This is used exclusively on Day Visitor's dedicated `/tickets/day-visitor` buy screen (F2's single-type layout). See `docs/f3-day-visitor-quantity-picker.md` for the full design, state model (`attendeesByDay`), and rationale. **Do not use `DayQuantityPicker` for multi-type carts** — the per-day-quantity model only composes cleanly when day-selection is the cart's only concern.

**Single-source-of-truth enforcement:** Both UI paths (per-unit `CartDayPicker` and per-day `DayQuantityPicker`) and the checkout route call the same three functions in the same order: `fetchActiveShowWindow()` → `buildShowWindow()` → `computeShowDays()`. They cannot drift — one computation path, three call sites (two UI, one server), same result every time. If the active show's dates change via Sanity, all three see the new days on next load/request.

`TicketTypeCardData` gains `requiresDaySelection: boolean` (required, not optional), so day pickers never silently fail to render if the flag is missing or misconfigured.

---

## What F5 Does NOT Do

- **Derive, invent, or hardcode any real calendar date.** No "Thursday", no "18–21 September", no dates in code. All dates flow from Sanity's `show.startDate` and `show.endDate`.
- **Validate the chosen day at check-in.** Stage 5 work, explicitly deferred (mission brief: "Check-in must later validate the chosen day").
- **Implement per-day capacity partitioning for Day Visitor.** `capacity: 800` remains a whole-show ceiling (F4 scoped this out). Per-day counting is a future feature.
- **Redesign the booking-contact or attendeeName/attendeeEmail model.** That is F6's rework (mission M3). The `isNamedAttendeeSatisfied()` check is defense-in-depth infrastructure for F5; F6 will refactor the underlying model.
- **Add a second independent day-range computation.** `computeShowDays()` and `isValidChosenDay()` live in exactly one file; both server and client call them (or receive their output), never re-deriving a list.

---

## Codex GPT-5.5 Cross-Model Gaps (2026-08-20)

Two real defects survived the original F5 gate and two Claude @qa passes; a Codex GPT-5.5 pass found both. Both are additive fixes to F5's own new surface — neither reopens F1–F4, and both follow "server is the only real gate, never silently accept nonsense":

1. **chosenDay not nulled for non-day-selection types** (Gap 1): Fixed via `resolveChosenDayForPosition()` function, confirmed by three new assertions (A13/A14/A15).
2. **idempotency replay ignores divergent chosenDay** (Gap 2): Fixed via `lineItemsMatchExistingPositions()` now including chosenDay in match key.

See `contracts/golden/ticketing-f5-day-attendees/README.md` "Codex GPT-5.5 cross-model gaps" section for the complete rationale and assertion proofs (A13–A15).

---

## Files Changed

- `lib/show-window-lookup.ts` — `computeShowDays(window)`, `isValidChosenDay(chosenDay, window)` (new pure exports)
- `lib/checkout-reservation.ts` — `resolveChosenDayForPosition()`, `isNamedAttendeeSatisfied()` (new pure exports)
- `app/api/tickets/checkout/route.ts` — swaps `allShowActivationQuery` for `activeShowWindowQuery`, adds per-line-item validation for chosenDay/attendeeName, routes chosenDay through `resolveChosenDayForPosition()`, includes chosenDay in idempotency match key
- `components/tickets/CartDayPicker.tsx` (new) — day-select row component, driven entirely by `showDays` prop
- `app/(marketing)/tickets/page.tsx` — fetches `activeShowWindowQuery`, resolves active show, computes `showDays`, passes to `TicketPurchaseForm`
- `components/tickets/TicketPurchaseForm.tsx` — passes `showDays` to `CartDayPicker`, passes `chosenDayByType` to checkout builder
- `lib/cart.ts` — `buildLineItemsFromCart()` gains `chosenDayByType` parameter, includes each unit's chosenDay in output
- `components/tickets/useTicketCart.ts` — manages `chosenDayByType` state
- `components/tickets/cartValidation.ts` — validates day format and presence per line item
- `types/index.ts` — `Ticket` gains `chosenDay?: string | null`
- `sanity/queries.ts` — `activeShowWindowQuery` already existed (from `lib/show-window-lookup.ts`); checkout route now uses it instead of `allShowActivationQuery`

---

## Sources

- `contracts/golden/ticketing-f5-day-attendees/README.md` — design record, blocker/workaround, reused infrastructure, Codex gaps and fixes, assertion proofs
- `.agent/memory/project/provisional-figures.md` — show dates (currently placeholder), replacement procedure when real dates land
- `docs/f4-admission-products.md` — the five ticket types, requiresDaySelection/requiresAttendeeNames flags that F5 enforces

All three are load-bearing.

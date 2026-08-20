# ticketing-f5-day-attendees — decision record

Mission `multi-line-item-cart`, milestone M2, feature F5: "Day selection and named attendees on
positions." Full mission file:
`.agent/memory/project/missions/2026-08-20-multi-line-item-cart.md`. Depends on F4 (shipped,
`requiresDaySelection`/`requiresAttendeeNames` booleans already on `ticketType`, contract
`contracts/contract-ticketing-f4-admission-products.yaml`).

## What this feature is, in one sentence

Day Visitor line items must carry a `chosenDay` that the server validates against the ACTIVE
show's real `startDate`/`endDate` window (never a hardcoded date), and VIP line items get a
second, flag-driven, defense-in-depth check that their attendee name is non-empty — both
enforced server-side, in the same per-line-item validation pass `app/api/tickets/checkout/
route.ts` already runs before any Firestore write.

## The blocker this is built around, and how it's worked around

The real show dates are not known (see mission "Known blockers"). `sanity/schemas/documents/
show.ts` already has `startDate`/`endDate` datetime fields — whatever value currently sits in
them (today, still a placeholder) is the single source of truth this feature reads from. F5
adds **zero** new literal calendar dates or day-names anywhere in product code, contract
assertions, fixtures, or goldens. Every fixture in this contract that needs a concrete date uses
an obviously-synthetic range far from any real show date (`2099-*`/`2098-*`) — deliberately NOT
`2027-09-16`..`2027-09-19`, which is what `provisional-figures.md` currently holds, because
copying that specific range into a second file is exactly the spreading failure this project's
containment discipline exists to stop (see that file's own "Why this file exists at all").

## Reused infrastructure: `lib/show-window-lookup.ts`

This module already exists (`ticketing-show-window-lookup`, shipped for `lib/admin-auth.ts`'s
per-show role scoping) and already has exactly the primitive this feature needs: `ShowWindow =
{ startDate: Date; endDate: Date }`, `buildShowWindow()` (parses a show doc's raw
`startDate`/`endDate` into a `ShowWindow` or `null`), and `parseUtcDatetime()` (rejects any
datetime string without an explicit UTC offset — this project runs in SAST, UTC+2, and a
bare-parsed datetime string previously produced a real published-timestamp bug, see project
memory `reference_firestore_timestamps_are_utc`). F5 adds two new PURE exports to this SAME
file rather than opening a second module that re-derives a day range from raw Sanity fields
independently — a second computation path is exactly how a containment failure like the
CTICC-venue/18-21-September incidents starts.

```ts
/** Inclusive list of calendar days (UTC, 'YYYY-MM-DD') spanning window.startDate..window.endDate.
 *  Pure — the ENTIRE day list is derived from `window`, nothing else. Feeding it a different
 *  ShowWindow must produce a different list — see A3's negative control. */
export function computeShowDays(window: ShowWindow): string[];

/** True iff `chosenDay` (expected 'YYYY-MM-DD') is one of computeShowDays(window)'s entries.
 *  False for a malformed string, and false for a syntactically valid date outside the window
 *  (including the day immediately before startDate and immediately after endDate — off-by-one
 *  at either boundary is the failure mode this guards). */
export function isValidChosenDay(chosenDay: string, window: ShowWindow): boolean;
```

## Checkout route: `activeShowWindowQuery` replaces `allShowActivationQuery`

`app/api/tickets/checkout/route.ts` currently fetches `allShowActivationQuery` (`_id`, `active`
only — F1's own deliberate omission of date fields, since checkout never needed them before
this feature) to resolve the active show via `resolveActiveShow()`. `activeShowWindowQuery`
already exists as a superset (`_id`, `active`, `startDate`, `endDate` — built for
`lib/show-window-lookup.ts`'s own `fetchActiveShowWindow`) — F5 switches the route to fetch
THAT query instead, so there is exactly one Sanity round-trip for show-activation state, not
two. `resolveActiveShow()` itself (import, signature, behaviour) is UNCHANGED — this is a
call-site swap of which query feeds it, not a new resolver. The route then calls
`buildShowWindow()` (also unchanged, reused) on the resolved active show's raw fields to get a
`ShowWindow | null` for `isValidChosenDay()`.

A `null` `ShowWindow` (no active show, or the active show is missing/malformed date fields) is
treated as a CMS misconfiguration exactly like a missing `capacity`/`price` on a ticket type —
`unusableTicketType`'s existing 500-not-400 pattern, extended with a `'showWindow'` field name —
**but only for line items that actually require a day** (a Weekend Pass purchase must not be
blocked by a show record with no dates set; only Day Visitor purchases need the window to
exist).

## `chosenDay`: request shape, storage, and validation

- `CheckoutLineItemInput` (route.ts) and `CheckoutLineItemInputLike`/`LineItemPlan` (lib/
  checkout-reservation.ts) gain `chosenDay?: string` / `chosenDay: string | null` respectively —
  additive, every existing field on both interfaces UNCHANGED.
- `parseLineItems()` accepts an optional `chosenDay` per line item: absent is fine for any
  type (a non-Day-Visitor line item that sends one is simply ignored downstream, never
  rejected for "extra" data — this project's convention elsewhere, e.g. the request body's
  unused fields, is permissive-on-extra/strict-on-required); when present, it must match
  `/^\d{4}-\d{2}-\d{2}$/` or the WHOLE cart is rejected (400) — same "one bad item refuses the
  whole cart" posture `parseLineItems` already uses for `attendeeEmail`.
- Format validity is NOT the same question as calendar validity — a syntactically valid
  `chosenDay` still gets rejected server-side if it falls outside the active show's window,
  or if the ticket type requires a day and none was sent at all. That is a SECOND, later gate,
  inside the existing per-line-item enforcement pass (see below), because `parseLineItems` has
  no Sanity access and cannot know which types require a day or what the show's window is.
- `Ticket` (types/index.ts) gains `chosenDay?: string | null` — optional/nullable, same
  precedent as every other F2-era position field addition (`orderId`, `compedBy`,
  `expiresAt`) that predates a field must still compile.
- `buildMultiReservationDocs()` writes `chosenDay: lineItem.chosenDay` onto every position —
  `null` for a line item that has none, never `undefined` (Firestore rejects `undefined` field
  values; every other optional position field in this file already writes explicit `null`).

## VIP attendee name: a real, provably-wired, flag-driven check — not a hardcoded slug

`attendeeName` already exists per line item today and `parseLineItems` already requires it
non-empty for EVERY line item, universally — that pre-dates this feature and F5 does not
change it (loosening it to "only required when `requiresAttendeeNames`" is F6's booking-contact
rework, explicitly out of scope here; see mission F6 brief). So a check that merely re-proves
"VIP has a non-empty name" via the existing universal rule would be true even if
`requiresAttendeeNames` were never read from Sanity at all — exactly the "assertion satisfiable
by something that isn't the real property" class this project's own dead-assertion sweep
findings warn against (mission "Standard for assertions").

F5 instead adds a new PURE, flag-driven function, `isNamedAttendeeSatisfied(requiresAttendeeNames:
boolean, attendeeName: string): boolean`, in `lib/checkout-reservation.ts`, and wires it into
the SAME per-line-item pass as `isValidChosenDay()` (defense in depth, ahead of `reserveTicket(`
— same anchor-ordering technique `check-checkout-wiring.sh` already proves for
`RECOVERY_TOKEN_SECRET`/F4's early-bird guard). This is deliberately NOT keyed on the literal
string `'vip'` anywhere in route.ts — it reads `requiresAttendeeNames` off the Sanity document
the same way `requiresDaySelection` is read, so a future second "named attendee" product (e.g. a
sponsor ticket) is covered by CMS data alone, no code change. A5's fixture proves this with a
ticket type slug that is NOT `'vip'`, precisely to rule out a hardcoded-slug implementation.

## UI: the day-picker is driven by the show record, provably

New component `components/tickets/CartDayPicker.tsx`, same shape/precedent as
`CartAttendeeFields.tsx` (grouped by ticket type, one row per unit, only rendered for
`requiresDaySelection` types with `quantity > 0`). Its ENTIRE list of selectable days comes from
a `showDays: string[]` prop — `app/(marketing)/tickets/page.tsx` (server component) fetches
`activeShowWindowQuery`, resolves the active show via the existing `resolveActiveShow()`,
`buildShowWindow()`s it, and `computeShowDays()`s that window, passing the result down through
`TicketPurchaseForm` — the SAME three functions the checkout route now also calls, so the days
shown to the buyer and the days the server will accept can never independently drift (one
computation, two call sites, not two computations).

`TicketTypeCardData` (and the `CartTicketTypeInfo` it's built from) gains `requiresDaySelection:
boolean` — additive, same "required, not optional" posture F4's `provisional` field took, so
this can never silently degrade to "picker never renders." A9 proves the days rendered CHANGE
when `showDays` changes (two synthetic fixtures, disjoint date ranges) — the negative control
that rules out a hardcoded day list, same technique as F4's A9 provisional-badge gating.

`lib/cart.ts`'s `buildLineItemsFromCart()` gains a `chosenDayByType: Record<string, string[]>`
parameter (additive — every existing parameter/behaviour unchanged) and includes each unit's
`chosenDay` in its output `CheckoutLineItemInput`, `undefined` when the type doesn't require one
— mirroring the existing `attendeesByType` row-per-unit pairing convention this file already
established, THROWing on a row-count mismatch exactly like the existing attendee check (a UI bug
must fail loudly before a POST, never silently pad/truncate).

## What this feature deliberately does NOT do

- Does not derive, invent, or hardcode any real calendar date or day-name (Thursday/Friday/...)
  anywhere — see "The blocker this is built around" above. `computeShowDays()` never contains a
  day-name; it returns ISO `YYYY-MM-DD` strings only, and the UI's exact date FORMATTING (e.g.
  whether to also show a day-of-week label derived FROM the real date at render time) is
  @dev's call and out of this contract's scope — day-of-week display, if added, must be
  computed from the actual `Date`, never a separately-typed string.
- Does not validate the chosen day at check-in (Stage 5, explicitly deferred per the mission
  brief — "Check-in must later validate the chosen day").
- Does not implement per-day capacity partitioning for Day Visitor — F4's README already scoped
  that out (`capacity: 800` remains a whole-show ceiling, not counted per day); F5 only adds the
  chosen-day FIELD and its validity-against-the-window check, nothing about per-day counting.
- Does not touch the booking-contact/attendeeName-vs-attendeeEmail model — that's F6's rework
  (mission M3). `isNamedAttendeeSatisfied()` is additive, defense-in-depth infrastructure that
  F6 can build on, not a redesign of the existing per-position attendee fields.
- Does not add a second, independent day-range computation anywhere — `computeShowDays()`/
  `isValidChosenDay()` live in exactly one file and both the server route and the client page
  call them (or receive their output), never re-deriving a day list from raw dates a second way.

## Codex GPT-5.5 cross-model gaps (added 2026-08-20, after 12/12 gated + @qa x2)

Two real gaps survived the original F5 gate and two Claude @qa passes; a Codex GPT-5.5 pass
found both, orchestrator-verified against the actual code. Both are additive fixes to this same
feature's own new surface — neither reopens F1–F5 above, and both follow the "server is the only
real gate, never silently accept nonsense" posture already established by F4's early-bird 409
and F1's all-or-nothing write.

### Gap 1 — chosenDay not nulled for a non-day-selection ticket type

The per-line-item validation loop (route.ts, "F5: a NEW per-LINE-ITEM validation pass") only
acts when `requiresDaySelectionByType[lineItem.ticketType]` is true. When it is false, nothing
happens — the reserveTicket() call still maps every line item through the unconditional
`chosenDay: lineItem.chosenDay ?? null`, so an arbitrary chosenDay string attached to e.g. a VIP
or Weekend Pass line item is persisted verbatim onto that position's Firestore document, even
though `requiresDaySelection: false` for that type.

**Decision: strip to null server-side, do not reject.** This section already documents the
correct behaviour above ("a non-Day-Visitor line item that sends one is simply ignored
downstream, never rejected for 'extra' data") — the bug is that the implementation never
actually did the ignoring, not that the wrong behaviour was chosen. Rejecting (400) would
contradict this feature's own permissive-on-extra convention and would make an unrelated field
in the request body a new way to fail an otherwise-valid purchase.

**Fix shape:** a new pure export, `resolveChosenDayForPosition(chosenDay: string | null |
undefined, requiresDaySelection: boolean): string | null` (lib/checkout-reservation.ts) —
returns `chosenDay ?? null` when `requiresDaySelection` is true, unconditionally `null`
otherwise. Deliberately a NEW pure function rather than an inline ternary at the reserveTicket()
call site: a grep-only wiring proof of an inline expression is exactly the "assertion
satisfiable by something that isn't the real property" class this contract's own attendee-name
section already warns against (a grep for `requiresDaySelectionByType` near `chosenDay` would
pass even if the boolean were consulted for the WRONG purpose) — a named pure function gives a
real behavioural check (A13) plus a narrow, still-necessary wiring check (A14) that the
route calls it, in the right order, in place of the old unconditional passthrough.

### Gap 2 — idempotency replay comparison ignores chosenDay

`lineItemsMatchExistingPositions()` matches on `ticketType` + `attendeeEmail` only. A checkout
replayed with the same `idempotencyKey` but a DIFFERENT `chosenDay` for an otherwise-identical
Day Visitor line item is still reported as matching, so the route's existing replay branch
returns the EXISTING positions — with the ORIGINAL chosenDay — as a successful replay. The
caller's new chosenDay is silently discarded with no error at all.

**Decision: chosenDay joins the match key.** A divergent chosenDay now produces the SAME
`key-payload-mismatch` outcome (409, "This Idempotency-Key was already used for a different
purchase.") the function already returns for a divergent ticketType/attendeeEmail — this is
"Rule 1: the key is bound to the payload it first created" (route.ts, directly above this
function's call site) applied to a field that didn't exist when Rule 1 was first written, not a
new rule. Silently keeping the original day (today's behaviour) or silently accepting the new
one without re-validating it against the show window are both worse: the first discards data the
caller explicitly sent, the second would let a replay bypass the isValidChosenDay() gate that
only runs on the CREATE path, never the replay path.

**Why this does NOT also force fixing the pre-existing `attendeeName` gap:** `attendeeName` has
had the identical structural gap since before F5 (an F1 baseline decision) — a replay with a
corrected name typo is already treated as a match, and that is intentional: "correcting a typo
in your own name on a retry is a legitimate replay, and the name is not a security boundary"
(route.ts's Rule 1 comment, unchanged by F5). `chosenDay` has no equivalent "harmless correction"
case — a different chosenDay changes which day a Day Visitor is authorised to attend, a
door-level access-control fact, not a display string. The two fields fail the same test
(FIELD ∉ match key) but land on opposite sides of it because they answer different questions:
"is this the same purchaser" (attendeeName: no) vs. "is this the same product being purchased"
(chosenDay: yes, same as ticketType and attendeeEmail already are). Widening the match key here
is in-scope because chosenDay is F5's own new field; retroactively narrowing attendeeName's
matching would be a behavioural change to F1 code with no F5 justification, so it stays out.

### New assertions

- **A13** (`check-chosen-day-stripped-for-non-day-types.mjs`) — pure-function proof that
  `resolveChosenDayForPosition()` nulls chosenDay for any non-day-selection type and only that
  case.
- **A14** (`check-chosen-day-persistence-wiring.sh`) — structural proof that route.ts's
  reserveTicket() call actually routes chosenDay through `resolveChosenDayForPosition()`
  (replacing, not sitting alongside, the old unconditional passthrough), ahead of reserveTicket(
  by source position — same anchor-ordering technique as A6.
- **A15** (`check-idempotency-replay-honors-chosen-day.mjs`) — pure-function proof that
  `lineItemsMatchExistingPositions()` treats a divergent chosenDay as a mismatch (and an
  identical one, including both-null, as a match), without over-reaching into the pre-existing
  attendeeName exclusion.

All three confirmed to fail against the current, unmodified tree: A13 fails at module resolution
(`resolveChosenDayForPosition` does not exist yet); A14 fails on the missing reference; A15 fails
its two CORE DEFECT checks (a divergent or null-vs-concrete chosenDay is wrongly reported as a
match).

## What this contract deliberately does NOT prove

Same offline/credential-free posture as `ticketing-f4-admission-products`'s own README: no live
HTTP round-trip, no real Sanity dataset. A3/A4/A5/A8 are pure-function/pure-data proofs; A6/A7
are source/structural proofs; A9 is an offline `renderToStaticMarkup()` proof. None touches a
network or a real show document.

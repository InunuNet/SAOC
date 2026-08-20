# ticketing-f4-admission-products — decision record

Mission `multi-line-item-cart`, milestone M2, feature F4: "The four admission products as
ticket-type documents." Full mission file:
`.agent/memory/project/missions/2026-08-20-multi-line-item-cart.md`. Provisional figures source:
`.agent/memory/project/provisional-figures.md`.

## What this feature is, in one sentence

Replace the placeholder `ticketType` catalogue (adult/pensioner/child/saoc-member/exhibitor —
`scripts/seed-ticketing.ts`, pre-dates the council's real spec) with the five real Orchid
Exhibition Visitor products, schema-extended with an early-bird window, a released quantity, and
two boolean capture-requirement flags — with every provisional number contained in one file and
gated behind a machine-readable flag, never rendered to the public as settled fact.

## The five products (not four — see "Title says four, brief lists five" below)

| Slug | Name | Price | Capacity | Released Qty | Early-bird cutoff | requiresDaySelection | requiresAttendeeNames |
|---|---|---|---|---|---|---|---|
| `early-bird` | Early-Bird Exhibition Ticket | R130 | 400 | 400 | 2027-07-31 | false | false |
| `day-visitor` | Day Visitor Ticket | R150 | 800 | null | null | **true** | false |
| `early-bird-weekend-pass` | Early-Bird Weekend Pass | R380 | 150 | 150 | 2027-07-31 | false | false |
| `weekend-pass` | Weekend Pass | R400 | 300 | null | null | false | false |
| `vip` | VIP Ticket | R300 | 120 | null | null | false | **true** |

Every value above is transcribed verbatim from `provisional-figures.md`'s tables — no new
estimate invented here. `releasedQuantity` for the two early-bird types is set equal to
`capacity` (see "releasedQuantity: why it's a field at all" below); the three non-early-bird
types get `releasedQuantity: null`.

## Title says four, brief lists five — going with five

F4's mission-file title is "The four admission products," but its own inline brief names five
(Early Bird, Day Visitor, Early-Bird Weekend Pass, Weekend Pass, VIP), matching the five rows of
`provisional-figures.md`'s pricing table and `Plans/valiant-squishing-thimble.md` §1 Category A
exactly. Treating "four" as a miscounted title and building the five named/priced products — a
title typo that drops a real, priced, capacity-bearing product would be a worse failure mode than
building one the title undercounted.

## Child ticket: OUT of scope for F4, explicitly

`provisional-figures.md` documents a sixth line — Child ticket, ages 6–12, R60, "our estimate,
from Brad's own suggestion" — with no capacity, no early-bird treatment, and explicitly flagged
"raised, unanswered" in the questionnaire sent to Lee-Ann. The mission file's own "Known blockers"
section is unambiguous: *"No child / pensioner / member ticket exists in the council's new list...
Build the five products specified; do not invent a sixth."*

This is not a silent drop — it's a standing, already-recorded decision this contract simply
inherits. F4 builds exactly the five products above. When/if Lee-Ann's questionnaire answer
resolves the child-ticket gap, it becomes its own follow-up feature (new `ticketType` document,
same `ProvisionalAdmissionProduct` shape, same containment discipline) — not a retrofit onto this
one. No golden file, fixture, or assertion in this contract references a child ticket type.

## Single source of truth: `lib/provisional-figures.ts`

New, additive module — every price/capacity/releasedQuantity/earlyBirdCutoff number above is a
literal in this ONE file, exported as `ADMISSION_PRODUCTS: ProvisionalAdmissionProduct[]`, and
nowhere else. `scripts/seed-ticketing.ts` (rewritten for this feature) imports and iterates this
array to write Sanity documents — it must not carry a second copy of any number, because a second
copy is exactly how the CTICC-venue and 18–21-September-2027 incidents this file's own header
describes happened (one reasonable estimate, copy-pasted, then edited independently in one place
and not the other, until nobody could say which was current).

```ts
export interface ProvisionalAdmissionProduct {
  slug: string;
  name: string;
  price: number;
  capacity: number;
  releasedQuantity: number | null;
  /** ISO 8601 date, e.g. '2027-07-31'. null = no early-bird window (always on sale while
   *  general sales are open). */
  earlyBirdCutoff: string | null;
  requiresDaySelection: boolean;
  requiresAttendeeNames: boolean;
  /** Always `true` in this file today — literal, not computed — see "The provisional flag
   *  is per-value, not per-file" below. */
  provisional: true;
}

export const EARLY_BIRD_CUTOFF = '2027-07-31';
export const ADMISSION_PRODUCTS: ProvisionalAdmissionProduct[];
```

A1 (checks) proves the module exports these shapes. A3 proves the five literal price numbers
(130/150/380/400/300) appear ONLY inside this file, not duplicated into the seed script or any
component/page. A8 proves the five rows in `ADMISSION_PRODUCTS` match the table above exactly,
including which two rows get `requiresDaySelection`/`requiresAttendeeNames`.

### `releasedQuantity`: why it's a field at all, given it equals `capacity` today

`capacity` is `ticketType`'s existing, already-enforced ceiling (validated by `isUsableAmount()`,
read by `planCapacity()`). If `releasedQuantity` always equaled `capacity`, it would be a
redundant field. It exists because the two are conceptually different constraints that happen to
coincide today: `capacity` is the exhibition's physical seat count for that product (a ceiling
that can only be lowered, never raised, per `provisional-figures.md`'s own instruction);
`releasedQuantity` is how many of those seats are *currently on sale* — a staged-release lever a
future feature (not this one) could lower independently without touching the physical capacity
number or requiring a schema migration. Today, all 400/150 are released at once, so the two
numbers are equal by data, not by definition. `effectiveCapacity()` (below) takes the tighter of
the two, so introducing this field changes nothing observable today and costs nothing to add now
versus retrofitting it onto a schema that's already selling tickets later.

### The provisional flag is per-value (well, per-document), not per-file

`provisional-figures.md` says pricing is "her figures, not ours" (low-risk to be wrong) while
capacity is "the one figure with a physical constraint behind it... overselling a hangar is a
real-world failure." Both still get the SAME flag in this feature — a single `provisional: true`
boolean on the `ticketType` Sanity document — because at this stage NEITHER category (her
"to be confirmed" prices, nor our own capacity estimates) is council-settled, and splitting into
`priceProvisional`/`capacityProvisional` today would be a distinction with no different behaviour
(nothing in this feature treats the two differently). If a future feature needs them to diverge
(e.g. prices confirmed before capacities), split the flag then — YAGNI today, and the flag is
additive to split later without a migration story worse than adding a second boolean field.

## Schema: `sanity/schemas/documents/ticketType.ts` — five new fields

Additive only. Every pre-existing field (`name`, `slug`, `price`, `description`, `capacity`,
`active`, `order`, `show`, `demo`) is UNCHANGED — see F9's own precedent comment in this file for
why `demo` was added additively rather than repurposing an existing field, same reasoning applies
here.

- `provisional: boolean`, `initialValue: true` — machine-readable, replacing (not just
  supplementing) the F1 ticketing-pages precedent of a bare prose string in `description`
  ("Provisional price — pending council confirmation.") as the ONLY provisional signal. That
  prose-only precedent is exactly the gap `provisional-figures.md` was written to close — a
  description string cannot gate a UI conditional; a boolean can (see "UI gating" below). The
  existing `description` field is unaffected — the two are complementary (a human-legible caption
  and a machine-legible flag), not one replacing the other's text.
- `earlyBirdCutoff: datetime`, optional. ISO date, e.g. `2027-07-31`. Null/unset means no
  early-bird window applies to this product.
- `releasedQuantity: number`, optional, `validation: (Rule) => Rule.integer().min(0)`. Deliberately
  NOT `.required()` — most products never set it (see table). Deliberately allows `0` as a valid
  value (an early-bird pool that hasn't opened yet) — `effectiveCapacity()` below must not treat
  `0` as "unset" (see A4's negative control).
- `requiresDaySelection: boolean`, `initialValue: false`.
- `requiresAttendeeNames: boolean`, `initialValue: false`.

## Checkout enforcement: `lib/checkout-reservation.ts` (additive exports) + the route

Two new pure functions, same file, same "pure — no Firestore/Sanity/Date.now() inside" convention
this file already establishes for `planCapacity`/`aggregateRequestedQuantities`:

```ts
/** Never exceeds `capacity` regardless of what `releasedQuantity` says — a released quantity
 *  greater than physical capacity is a misconfiguration, not license to oversell. `0` is a
 *  real, usable released quantity (see schema note above) — NOT treated as "unset" via `||`. */
export function effectiveCapacity(
  capacity: number,
  releasedQuantity: number | null | undefined
): number;

/** `cutoffIso === null | undefined` => always true (no window restriction). Otherwise: true
 *  through the END of the cutoff date (23:59:59.999 local-to-UTC-boundary, i.e. `< cutoff date +
 *  1 day`), not exact-millisecond comparison against midnight — a purchase attempt made during
 *  the cutoff date itself must still succeed. */
export function isWithinEarlyBirdWindow(now: Date, cutoffIso: string | null | undefined): boolean;
```

`app/api/tickets/checkout/route.ts`'s existing per-distinct-ticketType loop (the one that already
calls `isUsableAmount`/`ticketTypeMatchesActiveShow`) gains two more checks, in the SAME loop, same
fail-closed posture, BEFORE any Firestore write:

1. `ticketTypeBySlugQuery` (`sanity/queries.ts`) is extended to also select `releasedQuantity` and
   `earlyBirdCutoff` (additive fields on the existing query — `_id`, `name`, `price`, `capacity`,
   `show` all unchanged).
2. `capacityByType[slug]` is computed as `effectiveCapacity(capacity, releasedQuantity)` instead
   of the bare `capacity` value — this is the ENTIRE integration point with the existing,
   unmodified `planCapacity()`/`aggregateRequestedQuantities()` from the multi-line-item-cart
   contract. Neither of those functions changes.
3. A new guard: if `earlyBirdCutoff` is set and `!isWithinEarlyBirdWindow(new Date(), cutoff)`,
   refuse the WHOLE request — same "any one bad type refuses the whole cart" posture the existing
   capacity/price/show checks already use — with a 409 (a legitimate, time-based business state,
   not a 500 misconfiguration and not a 400 client error) and a message distinct from the sold-out
   409 (e.g. "Early-bird pricing for this ticket type has closed."). This guard textually precedes
   `reserveTicket(` in the route, same anchor-ordering technique
   `check-fail-closed-secret-guard.sh` already uses for `RECOVERY_TOKEN_SECRET` — proven by A6.

This is "real enforcement, not stored-and-ignored" per the architect brief's non-negotiable #4:
the released-quantity ceiling flows into the SAME atomic, all-or-nothing capacity transaction that
already exists (no new code path to get wrong independently), and the early-bird window is checked
server-side, ahead of any write, exactly like every other precondition in this route.

**What F4 does NOT do**: per-day capacity partitioning for Day Visitor (`capacity: 800` is
transcribed as the per-day figure from `provisional-figures.md`, but today's capacity counting —
`lib/data/tickets.ts getSoldCountsByTicketType` — counts sold positions per ticketType document,
not per ticketType+day). Positions don't carry a day yet; that's F5's job (mission file: "Day
Visitor positions carry a chosen day... Check-in must later validate the chosen day"). F4 only
proves `requiresDaySelection: true` is set correctly on the `day-visitor` document; actually
gating checkout on a selected day, and enforcing capacity per day rather than in aggregate across
the whole show, is F5's explicit scope, not silently dropped here.

## UI: provisional badge is flag-gated, observably

`sanity/queries.ts`'s `activeTicketTypesQuery` gains `provisional` (additive field, same query
shape otherwise). `app/(marketing)/tickets/page.tsx`'s `SanityTicketType` interface and
`cardData` mapping both gain `provisional: t.provisional === true` (defaults false-safe if the
field is ever missing — never renders a badge for an undefined flag, per "no invented brand
assets"/no client-content-guessing posture already established for `description`/`soldOut`).
`components/tickets/TicketTypeCard.tsx`'s `TicketTypeCardData` gains `provisional: boolean`; the
card renders a visible marker (e.g. `<span data-testid="provisional-badge">Provisional pricing —
subject to change</span>` or equivalent visible text — exact copy is @dev's call, but it MUST be
real rendered text, not a CSS-only visual treatment, so it survives `renderToStaticMarkup()` with
no browser) ONLY when `provisional === true`. A9 proves both directions: the badge text is present
for a `provisional: true` fixture and ABSENT for a `provisional: false` fixture in the SAME check
run — the negative control rules out an implementation that renders the badge unconditionally
(hardcoded "always provisional" text is the cheapest way to look done and be wrong the day the
council confirms prices).

This satisfies the architect brief's non-negotiable #2: not "the number is right" but "the
UI is provably gated on the flag."

## What this contract deliberately does NOT prove

- A live HTTP round-trip against a deployed Next server or a real Sanity dataset — same
  offline/credential-free posture as `ticketing-checkout-orders`'s own README explains for its
  fail-closed-secret check. A2/A6 are source/structural proofs; A4/A5/A7/A8 are pure-function/pure-
  data proofs; A9 is an offline `renderToStaticMarkup()` proof. None touches a network.
- Per-day capacity for Day Visitor (F5, see above).
- Any change to `markOrderAndPositionPaidByPaymentId`, the ITN webhook, or the payment provider
  seam — none of those read ticket-type catalogue fields at all; this feature is entirely upstream
  of them.
- Retiring/migrating the five OLD placeholder `ticketType` documents (`adult`/`pensioner`/`child`/
  `saoc-member`/`exhibitor`, `scripts/seed-ticketing.ts`'s current `TICKET_TYPES`). @dev's job is
  to set the old five `active: false` (never delete — Sanity dataset is pre-production but a
  future demo/QA pass may still reference them by slug) and `createIfNotExists` the new five,
  matching the seed script's existing non-destructive convention verbatim. Not separately
  contract-asserted here because it's a straightforward rerun of an already-proven idempotent
  pattern (`ticketing-f9-demo-ticket` already relies on the same `createIfNotExists` idempotency);
  A3's single-source-of-truth check is what actually gates the seed script's correctness.

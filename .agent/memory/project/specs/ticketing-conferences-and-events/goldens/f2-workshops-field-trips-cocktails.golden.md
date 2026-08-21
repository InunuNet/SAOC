# F2 golden — Workshops/Field Trips/Cocktails category

Mission `ticketing-conferences-and-events`, milestone M1, feature F2. Full brief in the mission
file. This golden is normative for what @dev builds; `check-workshop-products.mjs` is the
machine-checkable form of the same rules.

## What ships as real, sellable `ticketType` documents (4 products, one new array)

A new `WORKSHOP_FIELD_TRIP_PRODUCTS: ProvisionalAdmissionProduct[]` sibling array in
`lib/provisional-figures.ts`, reusing the existing interface verbatim (same as F1's
`CONFERENCE_PRODUCTS` — no new interface, no schema change):

| slug | name | price | capacity | requiresDaySelection | requiresAttendeeNames |
|---|---|---|---|---|---|
| `sunset-cocktails-single` | Sunset Cocktails (Single) | R250 | 100 | false | true |
| `sunset-cocktails-couple` | Sunset Cocktails (Couple) | R450 | 50 | false | true |
| `field-trip-single` | Field Trip (Single Outing) | R300 | 30 | false | true |
| `field-trip-all-outings` | Field Trip (All-Outings Pass) | R750 | 30 | false | true |

All four: `provisional: true`, `earlyBirdCutoff: null`, `releasedQuantity: null` (no early-bird
window or staged release defined for this category — same "don't invent a figure with no basis"
rule as everything else in this file).

**Capacity numbers REVISED 2026-08-21 (Codex GPT-5.5 cross-model review, real oversell defect
— see "Capacity revision: fixing a real oversell defect" below).** They are no longer "the
venue's headcount" or "the bus pool's seat count" transcribed directly into each slug's
`capacity` field. Read that section before touching any of these four numbers again — the
new numbers encode a worst-case-safe split across two independently-capped slugs, not an
independent per-product estimate.

Bundle relationships (enforced structurally by A1, not just documented):
- Couple < 2 x Single, Couple > Single (a real discount, never free or non-discounted).
- All-Outings > Single, All-Outings < 3 x Single (bundle assumes an estimated ceiling of 3
  outings — our working assumption, not a confirmed outing count).
- **NEW oversell invariants (A1, same script):** `sunset-cocktails-single.capacity +
  2 * sunset-cocktails-couple.capacity <= 200` (the real venue head capacity — a couple ticket
  is 2 heads per unit sold), and `field-trip-single.capacity + field-trip-all-outings.capacity
  <= 60` (the real bus/trip pool — the two slugs share one physical pool with zero pooling
  in checkout code). See "Capacity revision" below for why these exist and what they prevent.

No product name, slug, or description may contain the word "workshop" (that word is reserved
for the pricing-structure export below, never a sellable product) or the bare word "Events."

## Capacity revision: fixing a real oversell defect (2026-08-21)

The ORIGINAL capacities in this golden (200/200 for the two cocktail slugs, 60/60 for the two
field-trip slugs) were wrong — not a style nitpick, a genuine oversell risk, confirmed by a
mandatory Codex GPT-5.5 cross-model review (exit code 1 FAIL) after @dev implemented them.

**The mechanism, confirmed by reading the actual checkout code
(`lib/checkout-reservation.ts`'s `effectiveCapacity()`, `lib/data/tickets.ts`'s
`getSoldCountsByTicketType()`, and `app/api/tickets/checkout/route.ts`'s per-slug
`capacityByType` loop):** checkout enforces capacity strictly PER TICKETTYPE SLUG. One
Firestore `tickets` position document = one unit counted against that slug's OWN `capacity`
field, sourced 1:1 from the Sanity ticketType document. There is no pooling, no shared
counters, and no occupancy-weighting across slugs anywhere in that path.

That collides with two things the original numbers assumed away:

1. **`sunset-cocktails-couple` is a 2-guest product but checkout counts it as 1 unit.** Selling
   200 couple tickets (the original capacity) would seat 400 real people while the counter
   reads "200 sold, 0 remaining" — the counter and reality diverge by exactly the occupancy
   factor. Combined with `sunset-cocktails-single` ALSO independently capped at 200, the
   original worst case was 200 (single) + 400 (couple, at 2 heads/unit) = 600 real heads against
   a ~200-head venue (The Hangar, one evening) — 3x oversold in the worst case.
2. **`field-trip-single` and `field-trip-all-outings` are two independent counters on one
   physical pool.** Both were independently capped at 60 (the real bus/trip pool size). Selling
   both to their own independent ceilings simultaneously — which checkout's per-slug check does
   nothing to prevent — could seat 60 + 60 = 120 people against a 60-seat pool: 2x oversold in
   the worst case.

**Why the fix is numbers/documentation, not checkout code, this pass:** a real fix — a shared
decrementing pool across `field-trip-*`, or an occupancy-weighted capacity check for
`sunset-cocktails-couple` — is checkout LOGIC (it would touch `effectiveCapacity()`,
`planCapacity()`, and/or `getSoldCountsByTicketType()`, all shared with every other ticket type
in the system). That's a materially bigger, riskier change than this feature's actual scope
(a data-model/pricing pass), and it overlaps directly with Mission Two F4's own checkout-support
brief, which already owns "do not assume additive without checking" for exactly this class of
decision. Making that change here would be scope creep with no checkout-code review in front of
it. **This pass instead sizes each slug's `capacity` field so the WORST CASE — both competing
slugs simultaneously selling out to their own independent, unweighted counter — can never
exceed the real physical ceiling:**

- **Sunset Cocktails:** `sunset-cocktails-single.capacity = 100`, `sunset-cocktails-couple.capacity
  = 50`. Worst case: 100 heads (single) + 50 x 2 = 100 heads (couple) = 200 heads, exactly the
  real venue ceiling, never above it regardless of the actual single/couple sales mix.
- **Field Trip:** `field-trip-single.capacity = 30`, `field-trip-all-outings.capacity = 30`. Worst
  case: 30 + 30 = 60 seats, exactly the real bus/trip pool, never above it regardless of the
  actual single/all-outings sales mix. An even 30/30 split was chosen (not an asymmetric one)
  because the two original numbers were symmetric (60/60) with no documented reason to favour
  one product over the other — an even split is the smallest deviation from the original intent
  that still closes the oversell.

**This is a conservative, interim, worst-case-safe cap — not a claim that the real-world
mix will ever hit either worst case.** If actual sales run mostly-singles, real seats sold will
be well under the ceiling in both categories; the numbers above only guarantee the SYSTEM cannot
be pushed past the physical limit no matter how buyers split between the two competing slugs.
**Flagged explicitly for whoever picks up the real fix (most likely folded into Mission Two
F4):** replacing this worst-case split with a genuine shared/weighted checkout-time capacity
check would let both slugs sell up to a real total nearer the original 200/60 figures instead of
being permanently capped below it — that's a real product-availability cost of the interim fix,
not a free lunch, and should be weighed when F4 scopes its own checkout-capacity work.

## What does NOT ship as a `ticketType` document: Workshops

Workshops is NOT added to `WORKSHOP_FIELD_TRIP_PRODUCTS` and no placeholder/invented workshop
session (name, date, capacity) is created anywhere. Instead, a second export,
`WORKSHOP_PRICING_STRUCTURE`, documents the per-session pricing MODEL as a plain object (not
ticketType-shaped — no `slug`, no `capacity`):

```ts
export const WORKSHOP_PRICING_STRUCTURE = {
  model: 'per-session',
  estimatedSessionPrice: 120,
  note: '<why no real session exists yet, and how this number should be used once one does>',
  provisional: true,
} as const;
```

This is a genuinely different shape from `ProvisionalAdmissionProduct` on purpose — it is not
sellable and must not be mistaken for a sellable product later just because it lives in the
same file.

## Naming: "Workshops & Field Trips," never bare "Events"

Consistent with `ticketing-nav-restructure` F2's golden — any user-facing category label for
this feature's products uses "Workshops & Field Trips" (folding Sunset Cocktails under that
umbrella per the mission brief's own category name), never bare "Events." Product names/
descriptions in `lib/provisional-figures.ts` never use the bare word "Events" (A2 in the
contract, mirroring F1's A5).

## The 18+ restriction on Sunset Cocktails — copy only, no schema field this pass

Both cocktail products' `description` states the age restriction as permanent factual copy
(e.g. "18+ event" — a fixed attribute of the product, not a pricing/confirmation-status claim,
so it's allowed directly in `description` under the same rule that keeps provisional-pricing
language out of that field). No schema field (e.g. a minimum-age number) is added in this pass.
Enforcement of the restriction at checkout is explicitly out of scope — Mission Two F4 owns
deciding whether that needs a new schema field or is a checkout-flow/policy-only concern.

## What this feature does NOT do

- No Sanity schema changes (no age-restriction field, no session-selection field, no new
  document type for workshops).
- No seeding into Sanity beyond wiring `WORKSHOP_FIELD_TRIP_PRODUCTS` into
  `scripts/seed-ticketing.ts` the same way `CONFERENCE_PRODUCTS` and `ADMISSION_PRODUCTS`
  already are. `WORKSHOP_PRICING_STRUCTURE` is NOT seeded (there's no document to create from
  a non-sellable structure).
- No nav wiring (Mission Two F3) and no checkout/enforcement changes (Mission Two F4), including
  the 18+ enforcement mechanism and any future per-outing/per-session selection UI.

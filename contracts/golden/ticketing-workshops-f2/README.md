# ticketing-workshops-f2 — decision record

Mission `ticketing-conferences-and-events`, milestone M1, feature F2: "Estimate and structure
the Workshops/Field Trips/Cocktails category." Extends the discipline established in
`contracts/golden/ticketing-f4-admission-products/README.md` and
`contracts/golden/ticketing-conferences-f1/README.md` — read both first; this file assumes them.

## What this feature is, in one sentence

Add four real, priceable `ticketType` products (Sunset Cocktails Single/Couple, Field Trip
Single/All-Outings) as a new `WORKSHOP_FIELD_TRIP_PRODUCTS` sibling array, and document the
Workshops per-session pricing STRUCTURE as a separate, deliberately non-sellable
`WORKSHOP_PRICING_STRUCTURE` export — no invented workshop session, no schema changes.

## Why F2 owns its own estimation (same reasoning as F1)

Confirmed 2026-08-21: `leeann-content-corrections` F4 ("Estimate remaining unpriced ticket/
vendor/conference categories," including this exact section D) is still `status: pending` in
`.agent/memory/project/missions/2026-08-21-leeann-content-corrections.md` — it has not run.
`lib/provisional-figures.ts` currently contains only `ADMISSION_PRODUCTS` and
`CONFERENCE_PRODUCTS`; no Workshops/Field Trips/Cocktails figures exist anywhere in the repo.
Lee-Ann's pricing questionnaire artifact remains unsaved (`reference_leeann_pricing_artifact`
memory) — there is no client anchor to transcribe for section D, same as section C was for F1.
Per Brad's standing instruction (estimate now, correct later, do not block on the council),
this feature does its own estimation using the identical discipline: one file, plain exports,
a machine-readable `provisional: true` flag, trivial wholesale replacement later.

## The crux decision: what CAN be priced now vs. what genuinely cannot

Lee-Ann's spec (section D) itself states this category cannot be fully priced yet because
individual workshops/field trips are not yet defined. That caveat does not apply uniformly to
all three product families in this category — they differ in a structural way that matters:

**Sunset Cocktails and Field Trips are generic entitlements, not session-specific products.**
A cocktail-reception ticket or a field-trip ticket doesn't need to name a specific
outing/session to be sellable — "admission to the evening reception" and "one guided outing" /
"all guided outings" are coherent, priceable products regardless of which specific outing dates
end up on the calendar, in the same way Day Visitor is sellable today without the show's exact
daily programme being finalised. Their per-unit cost drivers (catering headcount; transport +
guide costs) are also reasonably uniform across whichever specific instances get scheduled, so
a single price per product is a defensible estimate without inventing fake instances.

**Workshops are structurally different: each session IS the product.** A "workshop" isn't a
generic entitlement the way a cocktail seat or a bus seat is — different workshops (e.g. a
hands-on repotting class vs. a judging-technique talk) plausibly have different content,
materials cost, instructor cost, and capacity. Selling a workshop ticket without naming which
workshop is not analogous to Day Visitor's "pick your day" (a date is a neutral parameter on an
otherwise-identical product); it would be inventing a product whose actual content is unknown.
There is no council-confirmed session list to anchor even a single instance against — anything
built as a real `ticketType` document here would be a fabricated placeholder, which
`provisional-figures.md`'s own standing rule and this mission's brief both explicitly prohibit.

**Resolution:** Cocktails and Field Trips ship as four real products. Workshops ships as a
documented pricing STRUCTURE only (`WORKSHOP_PRICING_STRUCTURE`) — a per-session price anchor
and an explicit note explaining why no sellable session exists yet — never a placeholder
`ticketType` entry. When real workshop sessions are defined (names, dates, capacities,
instructor-specific cost differences), a later feature creates one real `ticketType` document
per confirmed session, using `estimatedSessionPrice` as a starting anchor to adjust from, not a
number transcribed verbatim into every session regardless of its actual content.

## Pricing and capacity rationale — ALL our estimate, no client source

| Slug | Name | Price | Capacity | Attendee Names |
|---|---|---|---|---|
| `sunset-cocktails-single` | Sunset Cocktails (Single) | R250 | 100 | ✓ |
| `sunset-cocktails-couple` | Sunset Cocktails (Couple) | R450 | 50 | ✓ |
| `field-trip-single` | Field Trip (Single Outing) | R300 | 30 | ✓ |
| `field-trip-all-outings` | Field Trip (All-Outings Pass) | R750 | 30 | ✓ |

**Sunset Cocktails pricing:** R250/single is in the same order of magnitude as a light
reception ticket (below the admission Weekend Pass, above a single-day admission, reflecting
catering/bar cost rather than show access). R450/couple is roughly 10% cheaper than 2x R250
(R500) — a real but modest discount, since catering cost scales close to linearly per head
(unlike the Conferences Joint bundle, there's no shared fixed cost like a second track to
discount against, so the couple discount is deliberately small).

**Field Trip pricing:** R300/single reflects transport (a chartered bus/shuttle) plus a guided
outing's entry costs — a genuinely different cost driver from admission or catering. R750/
all-outings assumes an estimated outing count ceiling of 3 for this pass (documented here, not
silently baked into the number) — R750 is 25% cheaper than 3x R300 (R900), a real bundle
discount for committing up front, while remaining well above a single outing's price. If the
real outing count turns out to be different, this number needs revisiting — flagged explicitly,
not left to be discovered.

**Capacity — REVISED 2026-08-21, see "Capacity revision" below for the full defect and fix.**
The ORIGINAL numbers (200/200 for cocktails, 60/60 for field trips — Sunset Cocktails reusing
the admission Day Visitor pool's order of magnitude for a single evening at The Hangar; Field
Trip transport-limited to bus/shuttle capacity) were each individually defensible as a
per-product estimate but were WRONG once checked against how checkout actually enforces
capacity: independently, per ticketType slug, with no pooling or occupancy-weighting across
slugs. The revised numbers below are sized to make the worst case of that per-slug enforcement
safe, not to independently estimate each product's own demand ceiling.

**`requiresAttendeeNames: true` on all four:** cocktails need a headcount/name for catering and
the 18+ check at the door; field trips need a name for the transport manifest and outing safety
list. Same reasoning F1 used for conference badges — every row here is a named
attendee-tracked product, not an anonymous admission ticket.

**`requiresDaySelection: false` on all four:** none of these four is a multi-day admission
product where "which day" is a neutral parameter — each is either a single scheduled evening
event or an outing-based entitlement, not a show-day pick.

## Capacity revision: fixing a real oversell defect found by Codex GPT-5.5 review (2026-08-21)

The original capacity numbers above (200/200 for the two Sunset Cocktails slugs, 60/60 for the
two Field Trip slugs) were accepted into the original golden and implemented by @dev. The
mandatory Codex GPT-5.5 cross-model review (per `.claude/rules/workflow.md`'s standing
instruction) caught a real oversell defect in them — not a style nitpick, confirmed exit code 1
FAIL, independently re-verified here by reading the actual enforcement code before deciding the
fix.

**How checkout actually enforces capacity, confirmed by reading
`lib/checkout-reservation.ts`'s `effectiveCapacity()`, `lib/data/tickets.ts`'s
`getSoldCountsByTicketType()`, and the per-slug `capacityByType` loop in
`app/api/tickets/checkout/route.ts`:** capacity is checked strictly PER TICKETTYPE SLUG. Each
Sanity ticketType document's `capacity` field becomes that slug's ceiling; each Firestore
`tickets` position document (reserved or paid) counts as exactly one unit against its own
slug's counter. Nothing in that path pools capacity across slugs or weights a unit by how many
physical seats/heads it actually represents.

**Defect 1 — `sunset-cocktails-couple` undercounts headcount.** A "couple" ticket is, by
definition, 2 attendees, but checkout counts one sold couple ticket as 1 unit against its own
200-capacity counter, identically to how it counts one single ticket. With both slugs
independently capped at 200, the worst case (both sell out) was 200 heads (single) + 400 heads
(200 couple units x 2) = 600 real heads against a venue built for roughly 200 — up to 3x
oversold, and the sold-out badge would still read correctly (200/200, 200/200) while the venue
was already impossibly over capacity.

**Defect 2 — `field-trip-single` and `field-trip-all-outings` share a physical pool but not a
capacity counter.** Both slugs draw on the same bus/trip seats but were independently capped at
60 each. The worst case (both sell out) was 60 + 60 = 120 seats claimed against a 60-seat pool —
2x oversold, with each slug's own sold-out badge again reading correctly in isolation.

**Design options considered:**
- *Touch checkout code* (a shared decrementing pool for the field-trip pair; an
  occupancy-weighted capacity check for the couple product) — this is the only approach that
  lets the real ceiling numbers (200 heads, 60 seats) actually be sold up to. Rejected FOR THIS
  PASS: it changes `effectiveCapacity()`/`planCapacity()`/`getSoldCountsByTicketType()`, all
  shared by every other ticket type in the system (Admission, Conference products, and any
  future category) — a materially larger and riskier change than this feature's actual scope
  (a data-model/pricing pass, not a checkout-logic pass), and it duplicates work already owned
  by Mission Two F4's checkout-support brief ("do not assume additive without checking").
  Making that call here, without a checkout-code-focused review in front of it, would be scope
  creep into F4's job.
- **Chosen: resize the capacity NUMBERS so the worst case of today's per-slug, unweighted
  enforcement is safe.** Sunset Cocktails: `single.capacity = 100`, `couple.capacity = 50` —
  worst case 100 + (50 x 2) = 200 heads, exactly the real venue ceiling, never above it
  regardless of the actual single/couple sales split. Field Trip: `single.capacity = 30`,
  `all-outings.capacity = 30` — worst case 30 + 30 = 60 seats, exactly the real pool, never
  above it regardless of the actual single/all-outings split. An even 30/30 split was used
  (rather than an invented asymmetric one) because the original 60/60 was itself symmetric with
  no documented reason to favour either product — the smallest deviation from the original
  intent that still closes the oversell.

**Honest cost of the chosen fix, flagged for whoever scopes the real one (most likely folded
into Mission Two F4):** this is a conservative, interim, worst-case-safe cap, not a claim that
demand will ever actually hit either worst case — but it DOES permanently cap total sellable
inventory below what the original 200/60 figures implied (e.g. Field Trip can now sell at most
60 total seats across both products combined, never 120, even if in practice almost everyone
buys `field-trip-single` and the all-outings pool goes unused). A genuine shared/weighted
checkout-time capacity check would recover that lost headroom. That tradeoff belongs to
whoever picks up the real checkout-capacity fix, not silently absorbed here.

**Mechanically enforced going forward:** `check-workshop-products.mjs` (contract A1) now
computes each worst case from the ACTUAL exported capacity numbers and asserts it against the
real physical ceiling (200 heads / 60 seats) — not a numbers-match against today's specific
values. A future capacity edit that reintroduces either oversell fails the gate, not just today's
specific 200/200/60/60 regression.

## The 18+ restriction — copy only, no schema field, deliberately deferred to F4

Confirmed via `.agent/memory/project/missions/2026-08-21-leeann-content-corrections.md` F3
(refunds-policy brief): the Sunset Cocktails evening carries an 18+ restriction, noted there as
a fact requiring eventual refund-policy handling.

**Decision: this pass states the restriction as permanent factual copy in each cocktail
product's `description` (e.g. "18+ event") and adds no schema field.** Reasoning: an age
restriction is a fixed attribute of the product (like "full-weekend admission" is a fixed
attribute of Weekend Pass) — it belongs in `description` under the existing rule that
`description` carries permanent factual copy, distinct from the `provisional` flag's
pricing/confirmation-status signal. What this pass explicitly does NOT decide is the
*enforcement* mechanism (a DOB capture field, a checkout-time acknowledgement checkbox, or
purely a door-check policy with no schema involvement at all) — that is a checkout-flow design
question, not a data-shape question, and Mission Two F4's own brief ("checkout support... do
not assume additive without checking") already owns exactly this class of decision. Deciding it
here would be scope creep into F4's job with no checkout code in front of us to design against.

## Naming: "Workshops & Field Trips," consistent with the nav-restructure resolution

`ticketing-nav-restructure` F2's golden (`f2-events-naming.golden.md`) named this exact category
as the one carrying the "Events" collision risk and pre-specified the required qualified form:
**"Workshops & Field Trips."** This feature's category-level copy (wherever @dev surfaces a
label — e.g. a future `/national-show/tickets` chooser entry) must use that exact phrase, folding
Sunset Cocktails under it per the mission's own category grouping, and no product name/
description anywhere in `lib/provisional-figures.ts` may contain the bare word "Events" (A2,
mirroring F1's A5).

## Schema: reused, not extended

No changes to `sanity/schemas/documents/ticketType.ts`. The four real products use exactly the
existing fields, same as F1's six Conference products. `WORKSHOP_PRICING_STRUCTURE` is not a
Sanity document at all — it's a plain TypeScript export with no seed-script wiring, which is the
whole point of it not being ticketType-shaped (A3 in the contract proves this negatively: it
must not carry `slug`/`capacity`, the tell that it had drifted into looking like a real product).

## What this feature deliberately does NOT do

- **Invent a workshop session.** No name, date, or capacity for any specific workshop is
  created anywhere in this pass — see "The crux decision" above.
- **Nav wiring** — Mission Two F3's scope, once this feature's products exist.
- **Checkout enforcement, including the 18+ restriction and any future outing/session-selection
  UI** — Mission Two F4's scope; F4's own brief already flags it must not assume additive
  without checking.
- **A real shared-pool or occupancy-weighted capacity check in `lib/checkout-reservation.ts`**
  (the genuine fix for the field-trip shared-pool and cocktails-couple-occupancy oversell risks
  — see "Capacity revision" above). This pass closes both risks conservatively via capacity
  NUMBERS instead; the checkout-logic fix that would recover the lost headroom is explicitly
  deferred, most likely to Mission Two F4.
- **Seeding `WORKSHOP_PRICING_STRUCTURE` into Sanity** — there is nothing to seed; it has no
  document counterpart until real sessions exist.
- **A live HTTP round-trip or real Sanity dataset check** — same offline, credential-free
  posture as F1/F4.

## What this contract deliberately does NOT prove

- Whether R250/R450/R300/R750, or the assumed 3-outing bundle ceiling, are anywhere close to
  what the council will actually charge or run — explicitly flagged provisional, expected to be
  replaced wholesale once real figures land.
- Whether R120/session is a defensible anchor for every future workshop — it's a starting point
  for a human to adjust per session, not a claim that every workshop should cost the same.

## Replacement procedure

Identical to `provisional-figures.md`'s existing procedure for the four real products — replace
the `WORKSHOP_FIELD_TRIP_PRODUCTS` values in this one file, flip `provisional: false` per Sanity
document as each is confirmed, re-run the gate, record the delta in `provisional-figures.md`.
For Workshops specifically: once real sessions are defined, a later feature adds a genuinely new
per-session `ticketType` array (or extends `WORKSHOP_FIELD_TRIP_PRODUCTS`) seeded from
`WORKSHOP_PRICING_STRUCTURE.estimatedSessionPrice` as a starting point, then
`WORKSHOP_PRICING_STRUCTURE` itself can be retired.

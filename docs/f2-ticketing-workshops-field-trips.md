# F2: Workshops & Field Trips — The Four Ticket Types + Pricing Structure

**Feature:** F2 of mission `ticketing-conferences-and-events` (milestone M1). The four priceable Workshops & Field Trips category products (Sunset Cocktails Single/Couple, Field Trip Single/All-Outings), plus the Workshops per-session pricing structure as a deliberately non-sellable export.

**Contract:** `contracts/golden/ticketing-workshops-f2/README.md` — the full design record; do not duplicate it, read it first. **This doc is the guide; that is the specification.**

**Status:** Gated ✓, QA-passed, Codex cross-model-passed.

---

## The Four Products

| Slug | Name | Price | Capacity | Attendee Names |
|---|---|---|---|---|
| `sunset-cocktails-single` | Sunset Cocktails (Single) | R250 | 100 | ✓ |
| `sunset-cocktails-couple` | Sunset Cocktails (Couple) | R450 | 50 | ✓ |
| `field-trip-single` | Field Trip (Single Outing) | R300 | 30 | ✓ |
| `field-trip-all-outings` | Field Trip (All-Outings Pass) | R750 | 30 | ✓ |

All figures are Athanor's own estimates, explicitly flagged `provisional: true`. Lee-Ann's spec questionnaire section D (Workshops/Field Trips/Cocktails) remains empty — no client-supplied source exists to transcribe. Per Brad's standing instruction (estimate now, correct later, do not block on the council), these values are estimated conservatively and marked trivial to replace wholesale per `lib/provisional-figures.ts`'s own discipline.

**Key insight:** Both Sunset Cocktails and Field Trip pass include real bundle discounts — not free upgrades or sums. The couple price is ~10% cheaper than 2× single (reflecting that catering cost scales almost linearly per head with no shared fixed cost to discount against, unlike the Conferences Joint bundle). The all-outings pass is ~25% cheaper than 3× single, reflecting a realistic outing-count ceiling. The contract's A1 checker enforces these discount semantics structurally.

---

## Why Capacity Numbers Are Asymmetric (and Why They Changed)

### The Defect: Per-Slug Enforcement Without Pooling or Weighting

Checkout enforces capacity **strictly per `ticketType` slug**. Each Sanity `ticketType` document's `capacity` field becomes that slug's independent ceiling; each Firestore `tickets` position (reserved or paid) counts as exactly one unit against its own slug's counter. The enforcement path in `lib/checkout-reservation.ts`, `lib/data/tickets.ts`, and `app/api/tickets/checkout/route.ts` contains no pooling across slugs and no occupancy-weighting (a couple ticket = 2 heads, but checkout counts it as 1 unit).

This enforcement model was acceptable for the five admission products (five separate, non-overlapping product categories). It introduced a real oversell risk for the Workshops & Field Trips products:

**Defect 1 — Sunset Cocktails couple undercounts headcount.** A couple ticket is 2 attendees by definition, but checkout counts one couple ticket as 1 unit against its own 200-capacity ceiling (the original estimate). Worst case: both single and couple slugs sell out at 200 units each = 200 heads + 400 heads (200 couple units × 2) = 600 real heads against a venue designed for ~200. The sold-out badges would read correctly (200/200, 200/200) while the venue was already 3× oversold.

**Defect 2 — Field Trip single and all-outings share a physical pool but separate counters.** Both slugs draw on the same bus/trip seats (one shared 60-seat resource) but were independently capped at 60 each. Worst case: both sell out = 60 + 60 = 120 seats claimed against a 60-seat pool. The sold-out badges would read correctly in isolation while actual capacity was 2× breached.

This defect was caught by the mandatory Codex GPT-5.5 cross-model review and independently verified by reading the enforcement code.

### The Fix: Resize Capacity Numbers to Safe Worst-Case Bounds

Rather than rewrite checkout's enforcement logic (a much larger and riskier change that belongs in Mission Two F4's own checkout-support scope), this pass resizes the capacity NUMBERS so that the worst case of today's per-slug, unweighted enforcement is safe:

**Sunset Cocktails:** `single.capacity = 100`, `couple.capacity = 50`
- Worst case: 100 heads (single) + (50 × 2) heads (couple) = 200 heads = exactly the real venue ceiling, never above it regardless of single/couple sales split.

**Field Trip:** `single.capacity = 30`, `all-outings.capacity = 30`
- Worst case: 30 + 30 = 60 seats = exactly the real pool ceiling, never above it regardless of single/all-outings split.
- An even 30/30 split was used (not an invented asymmetric distribution) because the original 60/60 had no documented reason to favour either product — the smallest deviation from the original intent that still closes the oversell.

### The Tradeoff: Interim vs. Real Fix

This is a **conservative, interim, worst-case-safe cap**, not a claim that demand will ever actually hit either worst case. It **does permanently cap total sellable inventory below what the original 200/60 figures implied** — for example, Field Trip can now sell at most 60 total seats across both products combined, never 120, even if in practice almost everyone buys `field-trip-single` and the all-outings pool goes unused.

A genuine shared/weighted checkout-time capacity check would recover that lost headroom. That decision and implementation belongs to whoever scopes the real checkout-capacity fix in Mission Two F4 or later, and this tradeoff is documented here explicitly, not left to be discovered.

**Mechanically enforced going forward:** `check-workshop-products.mjs` (contract A1) computes each worst case from the ACTUAL exported capacity numbers and asserts it against the real physical ceiling (200 heads / 60 seats) — not a numbers-match against today's specific values. A future capacity edit that reintroduces either oversell fails the gate automatically.

---

## Single Source of Truth: `lib/provisional-figures.ts`

Every price and capacity value lives in exactly one place: the `WORKSHOP_FIELD_TRIP_PRODUCTS: ProvisionalAdmissionProduct[]` export, following the same discipline as `ADMISSION_PRODUCTS` and `CONFERENCE_PRODUCTS`.

```ts
export const WORKSHOP_FIELD_TRIP_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'sunset-cocktails-single',
    name: 'Sunset Cocktails (Single)',
    description: 'Admission to the Sunset Cocktails evening reception. 18+ event.',
    price: 250,
    capacity: 100,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  // ... three more products follow same structure
];
```

**Why reuse `ProvisionalAdmissionProduct`?** Same reasoning as F1: the interface name is a minor mismatch (not all rows are "admission"), but renaming it would touch every import across `ADMISSION_PRODUCTS` and `CONFERENCE_PRODUCTS` for a cosmetic gain — not worth the blast radius. The shape is identical and intentionally generic.

**Why this matters:** This project has twice had estimates spread across multiple files, then edited independently, creating silent conflicts. A single source of truth is enforcement. `scripts/seed-ticketing.ts` imports this array; no second copy exists anywhere in the codebase.

---

## Workshops: The Pricing Structure (NOT a Sellable Product Yet)

```ts
export const WORKSHOP_PRICING_STRUCTURE = {
  model: 'per-session',
  estimatedSessionPrice: 120,
  note: 'No real workshop session (name, date, capacity) is council-confirmed yet, so none is ' +
        'instantiated as a sellable ticketType here. This price is a starting anchor for a human ' +
        'to adjust per session once real sessions are defined — not a figure to transcribe ' +
        'verbatim into every future workshop regardless of its actual content.',
  provisional: true,
} as const;
```

**Why Workshops is structured differently from Sunset Cocktails and Field Trips:**

Sunset Cocktails and Field Trips are **generic entitlements**, not session-specific products. A cocktail-reception ticket or a field-trip ticket doesn't need to name a specific outing/session to be sellable — "admission to the evening reception" and "one guided outing" / "all guided outings" are coherent, priceable products regardless of which specific outing dates end up on the calendar, exactly like Day Visitor is sellable today without the show's exact daily programme being finalised. Their cost drivers (catering headcount; transport + guide costs) are also reasonably uniform across whichever specific instances get scheduled.

Workshops are **structurally different: each session IS the product.** A "workshop" isn't a generic entitlement the way a cocktail seat or a bus seat is — different workshops (e.g. a hands-on repotting class vs. a judging-technique talk) plausibly have different content, materials cost, instructor cost, and capacity. Selling a workshop ticket without naming which workshop is not analogous to Day Visitor's "pick your day" (a date is a neutral parameter on an otherwise-identical product); it would be inventing a product whose actual content is unknown.

There is no council-confirmed session list to anchor even a single instance against. Anything built as a real `ticketType` document here would be a fabricated placeholder, which `provisional-figures.md`'s own standing rule and this mission's brief both explicitly prohibit.

**Resolution:** `WORKSHOP_PRICING_STRUCTURE` is a documented price anchor and an explicit note explaining why no sellable session exists yet — never a placeholder `ticketType` entry. When real workshop sessions are defined (names, dates, capacities, instructor-specific cost differences), a later feature creates one real `ticketType` document per confirmed session, using `estimatedSessionPrice: 120` as a starting anchor to adjust from, not a number transcribed verbatim into every session regardless of its actual content.

---

## The 18+ Restriction: Copy-Only This Pass, Enforcement Deferred

The Sunset Cocktails evening carries an **18+ age restriction**, documented in each cocktail product's `description` field:
- "Admission to the Sunset Cocktails evening reception. **18+ event.**"

**Decision: this pass states the restriction as permanent factual copy, adds no schema field, defers enforcement to F4.** Reasoning: an age restriction is a fixed attribute of the product (like "full-weekend admission" is a fixed attribute of Weekend Pass) — it belongs in `description` under the existing rule that `description` carries permanent factual copy, distinct from the `provisional` flag's pricing/confirmation-status signal.

What this pass explicitly does NOT decide is the **enforcement mechanism** — a DOB capture field, a checkout-time acknowledgement checkbox, or purely a door-check policy with no schema involvement at all. That is a checkout-flow design question, not a data-shape question, and Mission Two F4's own brief ("checkout support... do not assume additive without checking") already owns exactly this class of decision. Deciding it here would be scope creep into F4's job with no checkout code in front of us to design against.

---

## Sanity Schema: No Changes Required

The five fields F4 added to `sanity/schemas/documents/ticketType.ts` are already fully generic:

| Field | Already in F4 | Reused Here |
|---|---|---|
| `provisional` | ✓ | ✓ Flag is true for all four; replaced when real figures land |
| `earlyBirdCutoff` | ✓ | ✗ Set to `null` (no early-bird window for these products) |
| `releasedQuantity` | ✓ | ✗ Set to `null` (no phased release; all capacity available day one) |
| `requiresDaySelection` | ✓ | ✗ False for all four (none is a multi-day admission product where "which day" is a neutral parameter) |
| `requiresAttendeeNames` | ✓ | ✓ True for all four (cocktails need headcount/name for catering and 18+ verification; field trips need names for transport manifest and outing safety list) |

The four products are plain `ticketType` documents using the existing fields. No new Sanity schema changes. The A3 contract assertion proves no workshop-named or parallel schema was added.

---

## Naming: "Workshops & Field Trips" Label Convention

`ticketing-nav-restructure` F2's golden (`f2-events-naming.golden.md`) pre-specified this exact category's required qualified form to avoid a collision with the existing `/events` nav item (societies' calendar): **"Workshops & Field Trips."**

This feature's category-level copy (wherever a future `/national-show/tickets` chooser surface labels this category) must use that exact phrase, folding Sunset Cocktails under it per the mission's own category grouping. No product name or description in `lib/provisional-figures.ts` contains the bare word "Events" — the A2 contract assertion verifies this by negative assertion.

---

## Checkout Enforcement

No code changes. The existing functions `lib/checkout-reservation.ts` — `effectiveCapacity()` and `isWithinEarlyBirdWindow()` — work generically on any `ticketType` document's `capacity`, `releasedQuantity`, and `earlyBirdCutoff`. The four products flow through the same existing validation pipeline with zero new code.

**Existing validation in `app/api/tickets/checkout/route.ts`:**

1. For each distinct ticket type in the cart, compute effective capacity: `effectiveCapacity(capacity, releasedQuantity)` — never exceeds capacity regardless of released quantity.
2. If `earlyBirdCutoff` is set and we're past that date, refuse with a **409** (business state). (Not applicable for Sunset Cocktails or Field Trip products.)
3. Validate total quantities against aggregated capacity — same fail-closed posture as all precondition checks.

This validation is real, server-side, and enforced before any write. No cart can proceed if any product (admission, conference, or workshop-category) fails its early-bird window or capacity check.

---

## UI: Provisional Badge

`components/tickets/TicketTypeCard.tsx` already renders the provisional badge when the `provisional` boolean prop is `true`. The four products carry `provisional: true`, so the badge will render for all of them on the `/tickets` page with the text "Provisional pricing — subject to change."

The badge is the sole place where provisional status is communicated to the buyer. Descriptions carry only permanent, factual copy (what the ticket covers, age restrictions), never pricing or status messaging.

---

## Provisioning: `scripts/seed-ticketing.ts`

The seed script was updated to:

1. Import `WORKSHOP_FIELD_TRIP_PRODUCTS` alongside `ADMISSION_PRODUCTS` and `CONFERENCE_PRODUCTS` from `lib/provisional-figures.ts`.
2. Combine all three arrays: `const allProducts = [...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS]`.
3. Seed all 15 products (five admission + six conference + four workshop-category) as `ticketType` documents using `createIfNotExists`, keyed on `ticketType-${product.slug}`.

Note: `WORKSHOP_PRICING_STRUCTURE` is NOT seeded into Sanity — there is nothing to seed; it has no document counterpart until real sessions exist.

---

## Replacement Procedure: When Lee-Ann's Real Numbers Land

Identical to F4's and F1's existing procedure — when real figures arrive:

1. Read Lee-Ann's questionnaire answers (the `reference_leeann_pricing_artifact` memory carries the URL; WebFetch the page to extract section D).
2. Replace the values in `lib/provisional-figures.ts` — the single source of truth. Do not edit them at multiple call sites.
3. Set `provisional: false` on each Sanity `ticketType` document as it is confirmed. Or keep `true` for values still pending — the flag is per-document, not per-file.
4. Re-run the contract gate to verify no assertion that only passes because a value is provisional breaks against confirmed figures, and that no reintroduced oversell pattern slips past A1's worst-case check.
5. Update `.agent/memory/project/provisional-figures.md` to record what the council actually said and what Athanor estimated wrongly. That delta trains better estimates next time.

**For Workshops specifically:** Once real sessions are defined, a later feature adds one genuine new per-session `ticketType` array seeded from `WORKSHOP_PRICING_STRUCTURE.estimatedSessionPrice` as a starting point (to adjust per session, not to transcribe verbatim), and `WORKSHOP_PRICING_STRUCTURE` itself can be retired.

---

## What F2 Does NOT Do

- **Invent a workshop session.** No name, date, or capacity for any specific workshop is created anywhere in this pass — only the pricing structure anchor, explicitly flagged as not-yet-sellable.
- **Nav wiring** — adding these four products to the National Show mega-menu's Tickets column is **F3's scope** (`components/chrome/nav-config.ts` — already a plain data array per Mission One, ready for exactly this kind of append). Not touched here.
- **Checkout enforcement changes or the 18+ age gate** — existing functions already work for any ticket type; the enforcement of age restrictions is **F4's scope** — that feature owns verifying whether and how to check age at checkout time. The restriction is documented as copy, not enforced.
- **A real shared-pool or occupancy-weighted capacity check.** The genuine fix for the field-trip shared-pool and cocktails-couple-occupancy oversell risks is explicitly deferred, most likely to Mission Two F4.
- **Seeding `WORKSHOP_PRICING_STRUCTURE` into Sanity** — there is nothing to seed; it has no document counterpart until real sessions exist.
- **A dedicated ticket-type page or cart-UI copy.** Presentation and checkout wiring belong to F3/F4.
- **A live HTTP round-trip or real Sanity dataset check.** Same offline, credential-free posture as F1/F4.

---

## Known Open Items

**The real capacity-enforcement fix is deferred to Mission Two F4.** This feature closes the oversell risk conservatively via capacity NUMBERS. A shared-pool or occupancy-weighted capacity check in `lib/checkout-reservation.ts` would recover the lost headroom (allowing up to 200 cocktail heads and 60 trip seats to actually be sold, not capped below that by worst-case-safe numbers). That fix belongs to whoever scopes the checkout-support feature and the tradeoff is documented explicitly here.

**Seed-script ambiguity on multi-show:** If multiple `nationalShows` are marked `active: true`, the seed script's `findActiveShow()` query picks `[0]` (database order). For a single-show model, this is unambiguous. For multi-show scenarios, this becomes a real gap and should fail closed instead — recorded for the next multi-show feature.

---

## Files Changed

- `lib/provisional-figures.ts` — new `WORKSHOP_FIELD_TRIP_PRODUCTS` array (four entries) and `WORKSHOP_PRICING_STRUCTURE` export
- `scripts/seed-ticketing.ts` — imports `WORKSHOP_FIELD_TRIP_PRODUCTS`, combines it with `ADMISSION_PRODUCTS` and `CONFERENCE_PRODUCTS`, seeds all 15 products

No changes to:
- `sanity/schemas/documents/ticketType.ts` (schema is already generic)
- `sanity/queries.ts` (existing query already selects all needed fields)
- `lib/checkout-reservation.ts` (existing functions work generically)
- `app/api/tickets/checkout/route.ts` (existing validation works generically)
- `app/(marketing)/tickets/page.tsx` (already passes provisional flag)
- `components/tickets/TicketTypeCard.tsx` (already renders provisional badge)

---

## Sources

- `.agent/memory/project/missions/2026-08-21-ticketing-conferences-and-events.md` — F2 scope and rationale
- `contracts/golden/ticketing-workshops-f2/README.md` — design decisions: why these four products, why capacity numbers were resized, why workshops is structured differently, why no schema changes, why the 18+ restriction is copy-only
- `lib/provisional-figures.ts` — source of truth for all figures (no copy anywhere else)
- `.agent/memory/project/provisional-figures.md` — replacement procedure and why this file exists

# ticketing-conferences-and-events F5 — checkout support decision record

Mission `ticketing-conferences-and-events`, milestone M2, feature F5: "Checkout support for
Conference and Workshop/Field-Trip/Cocktail ticket types." Extends
`contracts/golden/ticketing-conferences-f1/README.md`, `contracts/golden/ticketing-workshops-f2/
README.md`, and `contracts/golden/ticketing-purchase-pages-f3/README.md` — read all three
first; this file assumes them. **This doc is the guide; `contract-f5-checkout.yaml` is the
specification.**

## Determination 1: additive vs. gap — checked, not assumed

Read `lib/checkout-reservation.ts`, `app/api/tickets/checkout/route.ts`,
`lib/data/tickets.ts`, `docs/f4-admission-products.md`, and `docs/f5-day-selection-attendees.md`
before deciding.

**Conference products (6, `lib/provisional-figures.ts` `CONFERENCE_PRODUCTS`): fully additive,
zero gap.** Every one uses `requiresAttendeeNames: true`, `requiresDaySelection: false`,
`capacityPool` unset (per-slug, same as VIP/Weekend Pass today). F5 (day-attendees, the
multi-line-item-cart mission's F5, not to be confused with this feature) already enforces both
flags generically, flag-driven not slug-driven. The checkout route's per-distinct-type Sanity
fetch, capacity check, and per-line-item validation pass need **zero new code** to sell these
six products. Confirmed by F3 already shipping both purchase pages against the existing
pipeline with no checkout changes.

**Workshop/Field-Trip/Cocktails products (4 real, sellable, `WORKSHOP_FIELD_TRIP_PRODUCTS`):
additive for per-line-item fields (`requiresAttendeeNames: true`, `requiresDaySelection: false`
on all four — same flags, same enforcement, no gap there either) — BUT the capacity-enforcement
MECHANISM has a real, confirmed gap.** `contracts/golden/ticketing-workshops-f2/README.md`'s
"Capacity revision" section already found and named this: `getSoldCountsByTicketType()` counts
Firestore `tickets` positions strictly per `ticketType` slug, `effectiveCapacity()` computes a
ceiling strictly per slug, and `planCapacity()` checks each slug's requested-vs-sold-vs-capacity
independently — nothing pools capacity across slugs or weights a unit by how many physical
heads/seats it actually represents. F2 closed the two resulting oversell defects (couple ticket
= 2 heads counted as 1 unit; two field-trip products drawing on one shared physical pool but
capped independently) with a **numbers-only interim fix** — resizing the four capacity
constants down (200/200→100/50 for cocktails, 60/60→30/30 for field trips) so the worst case of
today's per-slug enforcement can never exceed the real physical ceiling. That fix was explicit,
documented, and explicitly named as *this* feature's to properly resolve, not just re-verify.

**Workshops itself (the per-session structure, `WORKSHOP_PRICING_STRUCTURE`): out of scope,
correctly.** It is deliberately not a sellable `ticketType` document — no slug, no capacity, no
checkout path exists for it at all yet. Nothing in F5 touches it. A future feature that
instantiates real workshop sessions inherits this feature's pooling mechanism if a session
needs it (e.g. two "Repotting Workshop" time-slots sharing one instructor's total capacity), but
building that today would be inventing a session that doesn't exist — explicitly out of scope
per F2's own "crux decision."

**The 18+ restriction on Sunset Cocktails: F2 explicitly deferred deciding the enforcement
mechanism to this feature ("checkout-flow design question... Mission Two F4's own brief already
owns exactly this class of decision"). Decided here — see "Determination 3" below.**

## Determination 2: the real capacity-pooling fix

### Design: additive pool fields + a generalized pure capacity-check function

Two new fields on `ticketType` (Sanity schema, additive, optional — same posture as F4's
`releasedQuantity`/`earlyBirdCutoff`):

- **`capacityPool: string | null`** — the shared pool this product's sold units draw from.
  `null`/unset (the default) means the product is its own singleton pool, byte-identical to
  today's per-slug behavior.
- **`headcountPerUnit: number`** — how many physical seats/heads one sold unit of this product
  consumes against its pool. Defaults to `1`. `sunset-cocktails-couple` is the only product in
  the codebase today that is not `1`.

One new pure function in `lib/checkout-reservation.ts`, `planPooledCapacity()`, added alongside
(not replacing) the existing `planCapacity()`:

```ts
export interface CapacityPoolConfig {
  pool: string | null; // null => this ticketType is its own singleton pool
  headcountPerUnit: number; // default 1 when a type has no explicit config
}

export function planPooledCapacity(input: {
  requestedQtyByType: Record<string, number>;
  soldCountsByType: Record<string, number>;
  /** Keyed by resolved POOL KEY (poolConfigByType[slug]?.pool ?? slug), not always by slug. */
  capacityByType: Record<string, number>;
  poolConfigByType: Record<string, CapacityPoolConfig>;
}): { kind: 'ok' } | { kind: 'over-capacity'; ticketTypes: string[] };
```

**Algorithm:** for each entry, resolve its pool key as `poolConfigByType[slug]?.pool ?? slug`
and its weight as `poolConfigByType[slug]?.headcountPerUnit ?? 1`. Sum
`requestedQty * weight` per pool key into `requestedHeadsByPool`, and `soldQty * weight` per pool
key into `soldHeadsByPool` (both dictionaries built from the SAME slug-keyed inputs the route
already has — no new data source). A pool is over capacity when
`soldHeadsByPool[pool] + requestedHeadsByPool[pool] > capacityByType[pool]`. The returned
`ticketTypes` array lists every REQUESTED slug (not pool key) whose resolved pool is over
capacity, preserving `planCapacity()`'s existing contract of "every offending type, not just
the first."

**Why this is a strict generalization, not a second capacity-check code path:** when
`poolConfigByType` is empty (or every entry has `pool: null, headcountPerUnit: 1`), pool key ==
slug and weight == 1 for everything, and `planPooledCapacity()` produces byte-identical results
to `planCapacity()` on the same inputs — proven mechanically by A7 (behavior script Test 1),
which calls both functions on the same scenario and asserts identical outcomes. Admission and
Conference products get zero behavior change; they simply never set `capacityPool`.

`app/api/tickets/checkout/route.ts`'s one call site switches from
`planCapacity()`/`aggregateRequestedQuantities()` to `planPooledCapacity()` (keep
`aggregateRequestedQuantities()` unchanged — it still produces the slug-keyed
`requestedQtyByType` input `planPooledCapacity()` consumes). The legacy `planCapacity()` export
itself may stay in `lib/checkout-reservation.ts` (removing it is not this feature's job and
risks breaking something outside checkout that isn't visible from this pass) — but the route
must call `planPooledCapacity()`, not `planCapacity()` (A2).

### Route.ts wiring: capacityByType becomes pool-keyed, not always slug-keyed

The per-distinct-ticketType Sanity fetch loop (route.ts, the `for (const slug of
distinctTicketTypes)` block) already fetches each type's own document. F5 adds `capacityPool`
and `headcountPerUnit` to that fetch (extend `SanityTicketType`, `ticketTypeBySlugQuery`) and,
per fetched type, resolves `poolKey = capacityPool ?? slug` and writes
`capacityByType[poolKey] = effectiveCapacity(capacity, releasedQuantity)` — **using
`Math.min` against any value already present at that key**, not a blind overwrite. This is a
defensive floor: the data invariant (A6, pool-data-invariant script) already requires every
pool member to declare an identical `capacity`/`releasedQuantity`, so `Math.min` should be a
no-op in the correct case — but if that invariant is ever violated by a future edit, `Math.min`
fails safe toward the LOWER ceiling rather than silently trusting whichever pool member the cart
happened to reference first. Build `poolConfigByType[slug] = { pool: capacityPool ?? null,
headcountPerUnit: headcountPerUnit ?? 1 }` in the same loop, and pass it to
`planPooledCapacity()` in place of the old `planCapacity()` call.

### Real ceiling numbers restored — the interim fix's conservatism recovered

| Slug | capacityPool | headcountPerUnit | capacity (pool ceiling) |
|---|---|---|---|
| `sunset-cocktails-single` | `sunset-cocktails` | 1 | 200 |
| `sunset-cocktails-couple` | `sunset-cocktails` | 2 | 200 |
| `field-trip-single` | `field-trip` | 1 | 60 |
| `field-trip-all-outings` | `field-trip` | 1 | 60 |

These are F2's ORIGINAL estimates (200/200 heads, 60/60 seats) — the real physical ceilings —
now enforced correctly instead of approximated conservatively. F2's interim 100/50/30/30 numbers
permanently capped total sellable inventory below the real ceiling (e.g. Field Trip could never
sell more than 60 total seats across both products even if demand skewed entirely toward one);
`planPooledCapacity()` recovers that lost headroom while proving (A7) it never allows the pool
to exceed 200 heads / 60 seats under any request mix, including cross-slug sold-count
accumulation from a prior purchase of the OTHER pool member (A7 Test 6 — this is exactly the
shape of oversell Codex caught in F2: a slug's own historical count looking safe in isolation
while the pool it shares is already near or at its ceiling).

**Data invariant, mechanically enforced (A6):** every product sharing a `capacityPool` value
must declare the identical `capacity` and `releasedQuantity` — the single real physical ceiling,
agreed by every member, not a per-product guess. `check-pool-data-invariant.mjs` checks this
generically (loops over every pool found across all three provisional-figures arrays), not as a
hardcoded numbers-match, so a future pool added anywhere else in the file is covered
automatically.

## Determination 3: the 18+ restriction — door-check policy, no schema/checkout change

**Decision: enforcement stays a physical door-check (ID verification at the Sunset Cocktails
entrance), not a checkout-time mechanism.** No new schema field (no date-of-birth capture, no
age-confirmation checkbox), no new checkout validation.

**Rationale:** a checkout-time self-attestation (a checkbox, a typed birth year) verifies
nothing — nothing stops a 15-year-old from checking a box — and would create a false sense of
enforcement without closing any real risk. The actual control that matters is what already
happens at a physical evening reception door regardless of what checkout collects: ID check at
entry. F2 already put permanent factual copy ("18+ event") in both cocktail products'
`description` fields, which is the correct and sufficient advance notice for a purchaser. Adding
a DOB field would also create a new PII-handling surface (retention, POPIA scope) for a
control that a door check already provides more reliably. This is the honest resolution of the
question F2 explicitly left open ("what this pass explicitly does NOT decide is the enforcement
mechanism") — not a default or an oversight.

A9 mechanically guards against scope creep back the other way: the schema must not gain a
`dateOfBirth`/`ageVerification`-shaped field as a side effect of this feature.

## Second repair (Codex GPT-5.5, 2026-08-21): two defects in the same pass

The first repair (A10) closed a cross-slug oversell in `route.ts`'s wiring. A second Codex
GPT-5.5 pass on the same diff found two more defects — one backend, one UI — both stemming from
the same root cause: `active == true` and "own sold count vs. own capacity field" are both
per-slug assumptions that stop being safe once a slug is one member of a shared pool.

**Defect 2 (backend oversell, higher severity):** `ticketTypesByPoolQuery` (`sanity/
queries.ts:203`) filtered pool siblings on `active == true`. But `getSoldCountsByTicketType()`
counts Firestore `tickets` positions regardless of the ticketType document's current `active`
flag — a sibling deactivated after selling out, or retired, still holds real sold/reserved
positions. The `active == true` filter meant that sibling's heads were dropped from
`poolConfigByType` entirely, so they fell back to being counted as their own singleton pool
instead of the shared one — an oversell exactly analogous to A10's original defect, but via a
different mechanism (a stale document flag rather than route wiring). **Fix:** drop the
`active == true` filter — see the query's own comment for the full reasoning, including why this
is safe with respect to Sanity draft-document exclusion (the client never resolves drafts
regardless of this filter). Regression-guarded by A11.

**Defect 1 (UI correctness):** `CategoryTicketsPage.tsx`'s sold-out check compared a pooled
product's own sold count against its own `capacity` field. Since the data invariant (A6)
requires every pool member to declare the FULL pool ceiling as its own `capacity` (200/60, not a
per-product share), that comparison almost never trips — a genuinely sold-out shared pool could
still render as available, because no single product's own sold count reaches the full pool
ceiling on its own. **Fix:** `CategoryTicketsPage.tsx` now calls `planPooledCapacity()` — the
same function `route.ts` uses server-side — once per listed product, asking "would exactly 1
more unit of this slug fit?", using the same `Math.min`-across-pool-members `capacityByType`
construction as `route.ts`, and fetching pool siblings not present in the category's own listing
via `ticketTypesByPoolQuery` (the same query `route.ts` uses, now also free of Defect 2's
filter). `activeTicketTypesByCategoryQuery` gained `capacityPool`/`headcountPerUnit` selections
to make this possible. Behaviorally proven by A12 (the per-unit call shape, distinct from A7's
bulk-cart shape); reachability proven by A13 (the same brace-matching wiring technique as A10,
applied to the `cardData` map callback instead of `route.ts`'s `POST()` body).

**Why A7 alone did not already cover Defect 1:** A7 proves `planPooledCapacity()`'s math against
checkout's own call shape — a full cart's aggregate requested quantities, checked once. It never
exercises the "1 more unit" per-product query shape the UI actually needs, and it never touches
`CategoryTicketsPage.tsx` at all, so a correct pure function wired incorrectly (or not wired at
all) into the UI would have passed A7 while still shipping the bug. A12 closes the math gap for
the new call shape; A13 closes the wiring gap A7 structurally cannot see.

**A14 (2026-08-21): closes a coverage gap in A13 itself, found by @qa-apex.** A13 only proves
`planPooledCapacity()` is called inside the `cardData` map and drives `soldOut` — it never proves
the separate sibling-fetch-and-merge loop (`for (const poolKey of poolKeysTouched) { ... }`,
~lines 157-174 — the UI-side analog of what A10 already protects in `route.ts`'s `POST()`) that
populates `poolConfigByType` with off-page/inactive pool siblings before that map runs is itself
wired and reachable. @qa-apex proved this concretely: deleting that entire loop from a copy of
the file left A13 green, because `planPooledCapacity()` is still called with SOME
`poolConfigByType` — just one silently missing those siblings, quietly reintroducing Defect 1's
exact oversell shape. A14 brace-matches `CategoryTicketsPage()`'s body, finds the loop's own
brace-matched body inside it, requires `ticketTypesByPoolQuery` to be genuinely invoked (passed
to `sanityFetch`'s `query:` argument) inside that loop, requires the
`poolConfigByType[sibling.slug] = ...` merge to live directly in the loop body (not a dead nested
function), and requires it to textually precede `cardData`'s computation. See
`contracts/checks/ticketing-conferences-and-events-f5/check-category-page-sibling-wiring.mjs`.

## Third repair (@dev, 2026-08-21): capacity's field-validation predicate

`route.ts`'s `capacity` field validation had been sharing `isUsableAmount()` (which permits
fractional values — correct for `price`) instead of enforcing an integer, despite the Sanity
schema declaring `capacity: Rule.required().integer().min(0)`
(`sanity/schemas/documents/ticketType.ts`). A document with a fractional `capacity` written
outside Studio (schema `validation:` is authoring-time only, not a read-time guarantee — see the
comment above `isUsableAmount()`) would have silently carried that fraction into
`effectiveCapacity()`/`planPooledCapacity()`'s arithmetic. **Fix:** a dedicated
`isUsableCapacity()` (`typeof value === 'number' && Number.isInteger(value) && value >= 0`),
capacity's call site switched onto it, price's call site left unchanged on `isUsableAmount()`.

`isUsableHeadcountPerUnit()` already had the equivalent integer check from this feature's own
original scope (matching `headcountPerUnit: Rule.integer().min(1)`) but had never received a
behavioral assertion of its own — A6/A7/A12 exercise `planPooledCapacity()`'s *consumption* of
headcount values, not the field-validation predicate in isolation.

Both `isUsableCapacity()` and `isUsableHeadcountPerUnit()` are unexported `route.ts` internals,
and the route module imports `next/server` + `firebase-admin`, so importing it directly in a bare
verification script isn't practical. A15/A16 use the same comment-stripped brace-matching
technique A10/A13/A14 already established for this file, extract each predicate's REAL body text,
and execute it via `new Function` against a truth table — proving the actual guarded code, not a
hand re-implementation that could drift from it. A15 also regression-guards price's call site
(`isUsableAmount(price)`, still accepting fractional amounts like 99.99) so a future edit cannot
silently over-tighten price to integer-only too. See
`contracts/checks/ticketing-conferences-and-events-f5/check-capacity-validator-behavior.mjs` and
`contracts/checks/ticketing-conferences-and-events-f5/check-headcount-validator-behavior.mjs`.

## What this feature does NOT do

- **Touch `getSoldCountsByTicketType()`'s counting granularity.** It still counts Firestore
  `tickets` positions per `ticketType` slug (unchanged) — pooling happens entirely at the
  planning layer (`planPooledCapacity()`), converting slug-keyed sold counts into pool-weighted
  totals. Positions still record their own real `ticketType` slug (needed for confirmation
  emails, check-in, and CSV export) — nothing about what a position document looks like changes.
- **Instantiate a real workshop session or extend the pooling mechanism to Workshops.** Out of
  scope per F2's own "crux decision" — see "Determination 1" above.
- **Add per-workshop-session attendee-slot logic.** No workshop `ticketType` document exists to
  attach it to; inventing one would be exactly the fabricated-placeholder failure F2 already
  ruled out.
- **Add checkout-time age verification for the 18+ restriction.** See "Determination 3" above.
- **Remove or repurpose the legacy `planCapacity()`/`aggregateRequestedQuantities()` exports.**
  `aggregateRequestedQuantities()` is still used as-is to build `planPooledCapacity()`'s
  `requestedQtyByType` input. `planCapacity()` may remain unused in the file; deleting it is not
  this feature's job.

## Files expected to change

- `lib/checkout-reservation.ts` — new `planPooledCapacity()`, new `CapacityPoolConfig`
  interface; `planCapacity()`/`aggregateRequestedQuantities()` unchanged
- `app/api/tickets/checkout/route.ts` — fetches `capacityPool`/`headcountPerUnit` per
  ticketType, builds pool-keyed `capacityByType` (via `Math.min`) and `poolConfigByType`, calls
  `planPooledCapacity()` instead of `planCapacity()`
- `sanity/schemas/documents/ticketType.ts` — two additive optional fields: `capacityPool`
  (string), `headcountPerUnit` (number, integer, min 1)
- `sanity/queries.ts` — `ticketTypeBySlugQuery` selects `capacityPool`, `headcountPerUnit`
- `lib/provisional-figures.ts` — `WORKSHOP_FIELD_TRIP_PRODUCTS`' four entries gain
  `capacityPool`/`headcountPerUnit`; capacities restored to the real ceilings (200/200/60/60)
- `scripts/seed-ticketing.ts` — if it constructs `ticketType` documents field-by-field rather
  than spreading the `ProvisionalAdmissionProduct` object, confirm `capacityPool`/
  `headcountPerUnit` are written through (same class of gap F3 found and fixed for `category`)

## Sources

- `contracts/golden/ticketing-workshops-f2/README.md` — "Capacity revision" section: the
  original oversell defect, Codex's finding, and the interim fix this feature replaces
- `contracts/golden/ticketing-conferences-f1/README.md`, `contracts/golden/
  ticketing-purchase-pages-f3/README.md` — prior features in this mission
- `docs/f4-admission-products.md`, `docs/f5-day-selection-attendees.md` — the flag-driven
  enforcement (`requiresAttendeeNames`, `requiresDaySelection`) this feature relies on unchanged
- `lib/checkout-reservation.ts`, `app/api/tickets/checkout/route.ts`, `lib/data/tickets.ts` —
  the actual checkout pipeline read before any design decision above was made
All are load-bearing.

## Repair: pool-sibling query show-scoping gap (2026-08-21, A11/A17)

Third Codex GPT-5.5 cross-model review defect (same pass as A11's original active==true fix):
`ticketTypesByPoolQuery` (sanity/queries.ts) matched pool siblings by `capacityPool == $pool`
alone — no show scoping. Any published `ticketType` document anywhere sharing the same
`capacityPool` STRING, regardless of which `show` it belonged to, was treated as a sibling,
poisoning the current checkout's pool config with an unrelated show's sold counts/headcount.
Two unrelated shows both naming a pool `"workshop-hall"` would collide.

Fix: added `show._ref == $showId` to the query's filter, and both call sites now pass
`showId: activeShowId` alongside `pool: poolKey`:
- `app/api/tickets/checkout/route.ts` (~line 519, `client.fetch(ticketTypesByPoolQuery, { pool: poolKey, showId: activeShowId })`)
- `components/tickets/CategoryTicketsPage.tsx` (~line 164, `sanityFetch({ query: ticketTypesByPoolQuery, params: { pool: poolKey, showId: activeShowId } })`)

Coverage: A11 (extended) now also asserts the query's GROQ body contains
`show._ref == $showId`. A17 (new) separately proves both call sites actually bind a `showId`
param — GROQ params left unbound don't error, they silently fail to filter, which is a distinct
failure mode from the query definition itself being wrong. Both negatively verified against
scratch-copy fixtures (query filter removed; each call site's `showId` param removed) —
confirmed FAIL for the right reason in every case.

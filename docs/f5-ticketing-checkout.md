# F5: Checkout Support for Conference and Workshop/Field-Trip/Cocktail Ticket Types

**Feature:** F5 of mission `ticketing-conferences-and-events` (milestone M2). Full checkout support for Conference and Workshop/Field-Trip/Cocktail ticket types, including the real pooled-capacity mechanism that F2 explicitly deferred until checkout design was in scope.

**Contract:** `.agent/memory/project/specs/ticketing-conferences-and-events/contract-f5-checkout.yaml` — the full design record; read it first. **This doc is the guide; that is the specification.**

**Status:** Gated ✓, QA-passed, Codex cross-model-passed (five defect-repair cycles complete).

---

## The Gap This Feature Closes

F2 identified and documented a genuine capacity-enforcement defect: checkout counts capacity strictly **per `ticketType` slug** with no pooling or occupancy-weighting. This introduces real oversell risks for Workshop/Field-Trip products:

**Defect 1 — Sunset Cocktails couple-ticket undercounts headcount.** A couple ticket represents 2 attendees by definition, but checkout counts it as 1 unit. Both single and couple slugs selling out = 200 heads + 400 heads (200 couple units × 2) = 600 real heads against a ~200-head venue — a 3× oversell.

**Defect 2 — Field Trip single and all-outings share a pool but separate counters.** Both draw on the same 60-seat bus, but independently cap at 60. Both selling out = 120 seats claimed against the 60-seat pool — a 2× oversell.

F2 closed these risks conservatively via **capacity number resizing** (200/200→100/50 for cocktails, 60/60→30/30 for field trips) so worst-case per-slug enforcement stays safe. This is an interim fix that permanently caps total sellable inventory below the real physical ceiling. F2 explicitly documented that this feature would properly resolve it.

**This feature implements the real fix:** a pooled-capacity mechanism with per-product occupancy weighting, restoring the original ceiling numbers (200 heads / 60 seats) while proving the enforcement never allows any request mix to exceed them.

---

## Design: Three Foundational Determinations

### Determination 1: Conference Products Are Fully Additive, Zero Gap

Read `lib/checkout-reservation.ts`, `app/api/tickets/checkout/route.ts`, and `lib/data/tickets.ts` before deciding scope.

**Conference products (6, `lib/provisional-figures.ts` `CONFERENCE_PRODUCTS`): fully additive through the existing checkout pipeline, zero new code required.** Every one uses `requiresAttendeeNames: true` and `requiresDaySelection: false`. The multi-line-item-cart mission (M2-F5, a distinct mission) already enforces both flags generically, not slug-driven. The per-distinct-ticketType Sanity fetch, capacity check, and per-line-item validation all pass through unchanged. F3's purchase pages already confirmed this works end-to-end.

**Workshop/Field-Trip/Cocktails products (4 real, sellable, `WORKSHOP_FIELD_TRIP_PRODUCTS`): additive for per-line-item fields, but the capacity-enforcement MECHANISM has a genuine gap.** This feature closes that gap.

### Determination 2: The Real Pooled-Capacity Fix

Two new fields on `ticketType` (Sanity schema, additive, optional):

- **`capacityPool: string | null`** — the shared pool this product's sold units draw from. `null`/unset (the default) means the product is its own singleton pool.
- **`headcountPerUnit: number`** — how many physical seats/heads one sold unit consumes against its pool. Defaults to 1. Only `sunset-cocktails-couple` differs (value 2).

One new pure function in `lib/checkout-reservation.ts`, `planPooledCapacity()`, added alongside (not replacing) the existing `planCapacity()`:

```ts
export interface CapacityPoolConfig {
  pool: string | null;
  headcountPerUnit: number;
}

export function planPooledCapacity(input: {
  requestedQtyByType: Record<string, number>;
  soldCountsByType: Record<string, number>;
  capacityByType: Record<string, number>;
  poolConfigByType: Record<string, CapacityPoolConfig>;
}): { kind: 'ok' } | { kind: 'over-capacity'; ticketTypes: string[] };
```

**Algorithm:** for each entry, resolve its pool key as `poolConfigByType[slug]?.pool ?? slug` and its weight as `poolConfigByType[slug]?.headcountPerUnit ?? 1`. Sum weighted requested and sold quantities per pool. Over capacity when `soldHeadsByPool[pool] + requestedHeadsByPool[pool] > capacityByType[pool]`. The returned `ticketTypes` lists every REQUESTED slug (not pool key) whose pool is over capacity.

**Why this is a strict generalization, not a second code path:** when `poolConfigByType` is empty or every entry has `pool: null, headcountPerUnit: 1`, this function produces byte-identical results to `planCapacity()` on the same inputs (proven mechanically by A7 of the contract).

#### Route.ts Wiring: Capacity Keyed by Pool, Not Always Slug

The per-distinct-ticketType Sanity fetch already built `capacityByType[slug] = effectiveCapacity(...)`. F5 extends it:

1. Fetch `capacityPool` and `headcountPerUnit` per ticketType
2. For each type, resolve `poolKey = capacityPool ?? slug`
3. Write `capacityByType[poolKey] = Math.min(capacityByType[poolKey] ?? Infinity, effectiveCapacity(...))` — defensive floor in case a pool's members carry mismatched capacities
4. Build `poolConfigByType[slug] = { pool: capacityPool ?? null, headcountPerUnit: headcountPerUnit ?? 1 }`
5. Pass `poolConfigByType` to `planPooledCapacity()` instead of the old `planCapacity()` call

#### Real Ceiling Numbers Restored

| Slug | Pool | Weight | Capacity |
|---|---|---|---|
| `sunset-cocktails-single` | `sunset-cocktails` | 1 | 200 |
| `sunset-cocktails-couple` | `sunset-cocktails` | 2 | 200 |
| `field-trip-single` | `field-trip` | 1 | 60 |
| `field-trip-all-outings` | `field-trip` | 1 | 60 |

These are F2's ORIGINAL estimates — the real physical ceilings — now enforced correctly instead of approximated conservatively. **Data invariant, mechanically enforced (A6 of contract):** every product sharing a `capacityPool` must declare the identical `capacity` — the single real physical ceiling, agreed by every member. `check-pool-data-invariant.mjs` verifies this generically, so a future pool added anywhere is covered automatically.

### Determination 3: The 18+ Restriction — Door-Check Policy, No Schema Change

**Decision: enforcement stays a physical door-check (ID verification at entry), not a checkout-time mechanism.** No new schema field (no date-of-birth capture, no age-confirmation checkbox), no new checkout validation.

**Rationale:** a checkout-time self-attestation verifies nothing — nothing stops a 15-year-old from checking a box. The actual control that matters is the physical door check, which already happens at a physical evening-reception entry regardless of what checkout collects. F2 already embedded permanent factual copy ("18+ event") in both cocktail products' `description` fields, which is correct and sufficient advance notice. Adding a DOB field would create new PII-handling scope without closing any real risk. This is the honest resolution of F2's explicitly-open question, not a default or oversight.

---

## Implementation: Five Defect-Repair Cycles

This feature required **five independent detect-and-repair cycles** (four via Codex GPT-5.5 cross-model review, one via @qa-apex and @dev collaboration) before shipping clean. The defects and fixes are load-bearing for future ticketing work.

### Cycle 1: Cross-Slug Pool Oversell in Route.ts Wiring (Codex GPT-5.5)

**Defect:** `poolConfigByType` was built from the cart's own distinct ticketType slugs only. When a pool sibling's prior sold tickets (e.g. already-sold `sunset-cocktails-couple` when the cart only requests `sunset-cocktails-single`) existed in Firestore, their pool key resolved as themselves instead of the shared pool, escaping the shared ceiling — an oversell.

**Why A7 alone cannot catch this:** A7's `check-pooled-capacity-behavior.mjs` hand-builds a complete `poolConfigByType` and so only proves the pure function. It never exercises route.ts's construction of it, so a correct pure function wired incorrectly would pass A7 while still shipping the bug.

**Fix:** In `app/api/tickets/checkout/route.ts`'s `POST()` body, after building initial `poolConfigByType` from the cart's own types, add a loop merging every pool sibling (fetched via `ticketTypesByPoolQuery`) into it, so the cart's aggregate pool accounting includes prior sold siblings whether or not they appear in this cart.

**Verification (A10):** `check-pool-sibling-wiring.mjs` brace-matches `POST()`'s own function body, requires the sibling-merge loop to sit directly inside it, and confirms the merged `poolConfigByType` is passed to `reserveTicket()`. Negatively verified against dead-code shapes and merge-after-call ordering defects.

### Cycle 2: UI Sold-Out Display + Inactive Sibling Pool Escape (Codex GPT-5.5, Same Pass)

**Defect 2a (UI correctness):** `CategoryTicketsPage.tsx`'s sold-out check compared a pooled product's own sold count against its own `capacity` field. Since the data invariant requires every pool member to declare the FULL pool ceiling (200/60, not a per-product share), that comparison almost never trips — a genuinely sold-out shared pool could still render as available because no single product's sold count reaches the full ceiling on its own. This reintroduces Defect 1's exact oversell shape.

**Defect 2b (backend oversell, higher severity):** `ticketTypesByPoolQuery` filtered pool siblings on `active == true`. But `getSoldCountsByTicketType()` counts Firestore `tickets` positions regardless of the current `active` flag — a retired sibling still holds real sold positions. The `active == true` filter let those heads escape the shared ceiling, treating a sold-out retired sibling as if it held zero units.

**Fix for 2a:** `CategoryTicketsPage.tsx` now calls `planPooledCapacity()` — the same function `route.ts` uses server-side — once per listed product, asking "would exactly 1 more unit of this slug fit?" This uses the same `Math.min`-across-pool-members `capacityByType` construction as `route.ts`, and fetches pool siblings not present in the category's own listing via `ticketTypesByPoolQuery`.

**Fix for 2b:** Drop the `active == true` filter from `ticketTypesByPoolQuery`. (The query's own comment explains why this is safe with respect to Sanity draft-document exclusion.)

**Verification (A11, A12, A13, A14):**
- A11: Proves the query's GROQ body contains no `active == true` filter, negatively verified against a fixture with it reintroduced
- A12: Proves `planPooledCapacity()` correctly computes the per-unit "would 1 fit" shape (distinct from A7's bulk-cart shape)
- A13: Proves the per-unit call is wired and reachable inside `CategoryTicketsPage`'s card-render loop
- A14 (added by @qa-apex): Proves the sibling-fetch-and-merge loop (`for (const poolKey of poolKeysTouched)`) that populates `poolConfigByType` before that map runs is itself wired and reachable — @qa-apex proved the gap concretely by deleting the loop and confirming A13 still wrongly passed

### Cycle 3: Capacity Field-Validation Predicates (Codex GPT-5.5, Cycle 2 Pass)

**Defect 3a:** `route.ts`'s `capacity` field validation shared `isUsableAmount()` (which permits fractional values — correct for `price`) instead of enforcing an integer. Sanity schema declares `capacity: Rule.required().integer().min(0)`, but the schema is authoring-time only, not a read-time guarantee. A document written outside Studio could persist a fractional capacity that `effectiveCapacity()` and `planPooledCapacity()` would silently carry into arithmetic.

**Defect 3b (coverage gap):** `isUsableHeadcountPerUnit()` already enforced integer checks for headcount, but no prior assertion behaviorally proved it — A6/A7/A12 exercised `planPooledCapacity()`'s *consumption* of headcount values, not the field-validation predicate in isolation.

**Fix for 3a:** Dedicated `isUsableCapacity()` (`typeof value === 'number' && Number.isInteger(value) && value >= 0`), capacity's call site switched onto it. Price's call site stays on `isUsableAmount()` to regression-guard that fractional amounts like 99.99 are still accepted.

**Fix for 3b:** Mechanical assertion of `isUsableHeadcountPerUnit()` itself (A16, same technique as A15).

**Verification (A15, A16):** Both are unexported `route.ts` internals, so A15/A16 extract each predicate's REAL body text via comment-stripped brace-matching, execute it via `new Function` against a truth table (proving the actual guarded code, not a hand re-implementation that could drift). Negatively verified against deliberately weakened fixtures (capacity accepting 10.5; headcount accepting 0) — confirmed FAIL for the right reason.

### Cycle 4: Pool-Sibling Query Show-Scoping Gap (Codex GPT-5.5, Cycle 2 Pass Extended)

**Defect:** `ticketTypesByPoolQuery` matched pool siblings by `capacityPool == $pool` alone, with no show scoping. Any published `ticketType` document anywhere sharing the same `capacityPool` STRING, regardless of which show it belonged to, was treated as a sibling. Two unrelated shows both naming a pool `"workshop-hall"` would collide, poisoning the checkout's pool config with an unrelated show's sold counts.

**Fix:** Added `show._ref == $showId` to the query's filter. Both call sites now bind `showId: activeShowId`:
- `app/api/tickets/checkout/route.ts` (~line 519)
- `components/tickets/CategoryTicketsPage.tsx` (~line 164)

**Verification (A11 extended, A17):**
- A11 (extended): Asserts the query's GROQ body contains `show._ref == $showId`
- A17: Separately proves both call sites actually bind a `showId` param — GROQ params left unbound silently fail to filter, a distinct failure mode from the query definition being wrong. Negatively verified against fixtures with the filter removed and each call site's param removed independently — confirmed FAIL for the right reason.

### Cycle 5: UI Query Field Selections (Codex GPT-5.5, Cycle 2 Pass)

**Defect:** `activeTicketTypesByCategoryQuery` (the query `CategoryTicketsPage.tsx` actually calls) wasn't selecting `capacityPool` and `headcountPerUnit` fields. Even after Cycles 1–4 fixed the logic, the UI had no access to the data it needed to build `poolConfigByType`.

**Fix:** Extended `activeTicketTypesByCategoryQuery` to select both new fields.

**Verification (A11):** `check-ui-query-regression-guards.mjs` extracts the real GROQ body and asserts both fields are present, negatively verified against a fixture with them removed — confirmed FAIL.

---

## Out of Scope: What This Feature Does NOT Do

- **Touch `getSoldCountsByTicketType()`'s counting granularity.** It still counts Firestore `tickets` positions per `ticketType` slug (unchanged) — pooling happens entirely at the planning layer.
- **Instantiate a real workshop session or extend pooling to Workshops.** Out of scope per F2's own "crux decision."
- **Add checkout-time age verification for the 18+ restriction.** See Determination 3.
- **Remove or repurpose the legacy `planCapacity()`/`aggregateRequestedQuantities()` exports.** `aggregateRequestedQuantities()` is still used to build `planPooledCapacity()`'s input. `planCapacity()` may remain unused; deleting it is not this feature's job.

---

## Files Changed

**New function exports:**
- `lib/checkout-reservation.ts` — new `planPooledCapacity()` function and `CapacityPoolConfig` interface; `planCapacity()` and `aggregateRequestedQuantities()` unchanged

**Modified files:**
- `app/api/tickets/checkout/route.ts` — fetches `capacityPool`/`headcountPerUnit` per ticketType, builds pool-keyed `capacityByType` and `poolConfigByType`, calls `planPooledCapacity()` instead of `planCapacity()`
- `sanity/schemas/documents/ticketType.ts` — two additive optional fields: `capacityPool` (string), `headcountPerUnit` (number, integer, min 1)
- `sanity/queries.ts` — `ticketTypeBySlugQuery` and `activeTicketTypesByCategoryQuery` both now select `capacityPool` and `headcountPerUnit`; `ticketTypesByPoolQuery` (new) for fetching pool siblings; added show-scoping (`show._ref == $showId`)
- `lib/provisional-figures.ts` — four Workshop/Field-Trip products gain `capacityPool`/`headcountPerUnit`; capacities restored to real ceilings (200/200/60/60)
- `components/tickets/CategoryTicketsPage.tsx` — sold-out display now reflects pooled capacity via `planPooledCapacity()`; fetches pool siblings not visible on current page
- `scripts/seed-ticketing.ts` — writes `capacityPool`/`headcountPerUnit` fields through to Sanity documents

**Untouched:**
- `app/api/tickets/checkout/route.ts`'s existing validation (existing functions work generically for any category)
- `lib/checkout-reservation.ts`'s existing `planCapacity()` (kept for backward compatibility, but checkout route calls `planPooledCapacity()`)
- Any other checkout logic — multi-line-item-cart features are in a separate mission

---

## Why This Matters: Defect Patterns Worth Remembering

### 1. Live-Data QA Catches Defects Code Review Alone Cannot See

**Defect 2b (inactive sibling pool escape)** was invisible in development — the test dataset's documents carry `active: true` from the start. It only surfaced when @qa-apex ran against the actual production Sanity dataset. **Lesson:** when a feature's behavior depends on existing data state, add an explicit "run against real live data" step to QA.

### 2. Cross-Model Review Finds Classes Same-Model Review Misses

**All five defects were found by Codex GPT-5.5 or caught during its review passes.** Same-model review (whether @dev or @qa) passed every check every time. This is not a reflection on review quality — it is simply empirical proof that two independent models with different blind spots catch different classes of bugs. The standing rule (mandatory Codex pass on every apex-tier feature) exists for exactly this reason.

### 3. Pure Functions Are Testable; Wiring Defects Hide Inside Integration

**Defects 1, 2a, 2b, 4** were all wiring/integration failures, not pure-function bugs. **A7's `planPooledCapacity()` behavior assertion** passes for all of them because the pure function itself is correct. The defects lived in **route.ts's pool construction, category-page's sibling-merge loop, query-field selections, and show-scoping**. Comprehensive contract checks exist precisely because a correct pure function wired incorrectly is still a defect.

---

## Sources

- `.agent/memory/project/specs/ticketing-conferences-and-events/contract-f5-checkout.yaml` — live contract with all 17 assertions
- `.agent/memory/project/specs/ticketing-conferences-and-events/goldens/f5-checkout.golden.md` — full design decisions and repair history
- `contracts/golden/ticketing-workshops-f2/README.md` — "Capacity revision" section: the original defect, interim fix, and deferred-to-F5 rationale
- `lib/provisional-figures.ts` — source of truth for all 15 products and their pool config
- `docs/f3-ticketing-purchase-pages.md` — the routes this feature's checkout supports
- `docs/f4-ticketing-nav-wiring.md` — nav wiring that makes these products discoverable

---
schema: athanor.mission/v1
slug: ticketing-conferences-and-events
goal: 'Mission Two: extend ticketing to the two remaining categories from Lee-Ann''s spec -
  Conferences (SAOC Symposium / WOSA Conference / Joint) and Workshops/Field Trips/Cocktails -
  using the nav shell and provisional-figures discipline Mission One and F4 already established'
created_at: '2026-08-21T13:30:00+00:00'
started_at: '2026-08-21T16:05:00+00:00'
completed_at: '2026-08-21T23:00:00+00:00'
last_active_at: '2026-08-21T00:00:00+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M2
  feature: F5
  ts: '2026-08-21T23:00:00+00:00'
features:
- id: F1
  status: done
  tier: apex
  title: Estimate and structure the Conferences category (SAOC Symposium / WOSA Conference / Joint)
  inline_brief: 'Per Lee-Ann''s spec (Drive `1fegrT9UKObJ71tUjUme_kFtqieSOsYca`, section C):
    SAOC Symposium Early-Bird/Normal, WOSA Conference Early-Bird/Normal, SAOC/WOSA Joint
    Early-Bird/Normal - six ticket types. Before scoping, check whether
    `leeann-content-corrections` F4 (estimate remaining unpriced categories) has run and
    already produced these figures in `lib/provisional-figures.ts` - if so, use them as the
    source of truth rather than re-deriving; if not, this feature must do that estimation
    itself using the SAME discipline (estimated, provisional-flagged, single source of truth,
    trivial to replace when real figures land) rather than waiting - Brad''s standing
    instruction is estimate now, correct later, do not block on the council. Read
    `docs/f4-admission-products.md` and `contracts/golden/ticketing-f4-admission-products/`
    for the established pattern before designing a new one. Build as Sanity `ticketType`
    documents (or extend the existing schema) the same way the five admission products work,
    NOT a separate bespoke data model - confirm this is still the right approach by reading
    the current schema before assuming. Tier: apex - this is new checkout-affecting ticket
    logic (money, capacity), same class of risk as F4/F5 in multi-line-item-cart, which both
    needed apex-level rigor and both had Codex catch real defects Claude missed.'
- id: F2
  status: done
  tier: apex
  title: Estimate and structure the Workshops/Field Trips/Cocktails category
  inline_brief: 'Per Lee-Ann''s spec section D: Sunset Cocktails (single/couple), Workshops
    (per-session), Field Trip (single/all-outings). Her spec itself notes this category
    CANNOT be fully priced yet because individual workshops/field trips are not yet defined -
    scope to what CAN be reasonably estimated (the ticket types and their pricing STRUCTURE,
    e.g. per-session pricing model) and explicitly flag what genuinely cannot be estimated
    (specific session count/dates) rather than inventing placeholder workshops. Same
    provisional-figures discipline as F1. This is the category that also carries the "Events"
    naming risk flagged in `ticketing-nav-restructure` F2 - Mission One resolved the
    top-level nav collision by construction, but this feature''s own labels/copy must still
    avoid bare "Events" for this category (e.g. "Workshops & Field Trips", not "Events") to
    stay consistent with that resolution. Tier: apex, same reasoning as F1.'
- id: F3
  status: done
  tier: apex
  title: Build category-aware Conferences and Workshops & Field Trips purchase pages
  inline_brief: 'Inserted 2026-08-21 after @architect found F3 (now F4, nav wiring) and F4
    (now F5, checkout) both assumed this already existed. It does not. F1/F2 (done, commits
    9b48493 and 2937c50) only built the ticketType DATA MODEL - no route/page exists for
    either category. Confirmed: the existing `/tickets` page''s `activeTicketTypesQuery`
    (sanity/queries.ts:119) has zero category filter and `ticketType.ts` has no
    category-discriminating field, so all 15 products (5 admission + 6 conference + 4
    workshop/field-trip) would render mixed together on one page today. This feature adds
    the category field (Sanity schema), the filtered query/page(s) for Conferences and
    Workshops & Field Trips (read `app/(marketing)/tickets/page.tsx` as the pattern to
    extend or sibling), and confirms the purchase flow works end-to-end for both new
    categories using the EXISTING checkout pipeline (do not assume F5''s scope is required
    first - check whether checkout already accepts these ticketType docs generically before
    treating this as blocked on F5; multi-line-item-cart''s checkout code may already be
    generic enough). Read `contracts/golden/ticketing-nav-f3/README.md` (the architect''s
    full option analysis: a/b/c and why each was rejected/deferred) before scoping. Tier:
    apex - new Sanity schema field, new query, new page(s), same risk class as F4/F5 in
    multi-line-item-cart.'
- id: F4
  status: done
  tier: standard
  title: Extend the National Show mega-menu''s Tickets column to include both new categories
  inline_brief: 'Mission One (`ticketing-nav-restructure`, shipped commit `3b83471`)
    deliberately built `components/chrome/nav-config.ts`''s Tickets column as a plain data
    array specifically so this step would be an append, not a rewrite - read that file and
    `docs/f1-ticketing-nav-restructure.md` first. Add "Conferences" and "Workshops & Field
    Trips" as two more entries (direct links, matching the existing Visitor/Exhibitor/Vendor
    pattern) once F3''s routes exist (formerly gated on "F1/F2''s routes" - corrected 2026-08-21,
    see F3). Do NOT touch Header.tsx/MegaMenu.tsx/MobileMenu.tsx structurally - if this
    feature finds it needs to, that''s a signal Mission One''s "data-driven for
    extensibility" claim was wrong and needs flagging, not silently patching around. A
    guard-rail contract already exists at contract-f3.yaml (written when this was F3,
    status blocked) - read it, it documents exactly what must change before this feature
    is unblocked (A1-A5). Tier: standard - this should be a small, mechanical extension
    once F3 ships real routes.'
- id: F5
  status: done
  tier: apex
  title: Checkout support for Conference and Workshop/Field-Trip/Cocktail ticket types
  inline_brief: 'Extend the existing multi-line-item cart/checkout (shipped in
    `multi-line-item-cart` M1+M2) to accept these new ticket types alongside the five
    admission products - read `docs/f4-admission-products.md`, `docs/f5-day-selection-
    attendees.md`, and the checkout/reservation code (`lib/checkout-reservation.ts`,
    `app/api/tickets/checkout/route.ts`) before scoping to confirm whether this is
    genuinely additive (new ticket-type data flowing through the same cart/PayFast/
    confirmation pipeline) or whether these categories need different fields the current
    schema does not carry (e.g. the cocktail evening''s 18+ restriction noted in the
    refunds-policy mission brief, or per-workshop-session capacity). Do not assume additive
    without checking - the Workshops category in particular may need attendee-slot-per-
    session logic the current day-selection code was not built for; also read
    `contracts/golden/ticketing-workshops-f2/README.md`''s "Capacity revision" section -
    the interim per-slug capacity fix documented there (multi-head products, shared pools)
    is explicitly this feature''s to properly resolve, not just re-verify. Tier: apex -
    checkout/payment code, same risk class as the rest of ticketing.'
milestones:
- id: M1
  title: Estimate and structure both new categories
  features:
  - F1
  - F2
  status: done
- id: M2
  title: Build purchase pages, wire nav, and extend checkout
  features:
  - F3
  - F4
  - F5
  status: done
---

# Mission: Conferences and Events ticketing (Mission Two)

## Context

Brad, 2026-08-21: "mission one is [nav restructure]... when mission one is complete, mission
two is to expand the ticketing to the other two categories, conferences and events." Mission
One (`ticketing-nav-restructure`) shipped and closed 2026-08-21, commit `3b83471`, gate 8/8
green - its nav is explicitly data-driven so this mission can extend it without touching
Header/MegaMenu/MobileMenu.

This mission was originally going to wait on `leeann-content-corrections` F4 (estimate
remaining ticket prices) before drafting, to avoid inventing scope with no pricing anchor.
Brad instead said "launch mission 2" directly - per his own standing instruction (estimate
now, correct later, do not block on the council), F1/F2 below now own doing that estimation
themselves if `leeann-content-corrections` F4 has not already produced it, using the exact
same provisional-figures discipline rather than duplicating or contradicting it.

## Notes

- M1 (estimate/structure) must complete and be genuinely stable before M2 (nav + checkout
  wiring) starts - wiring checkout to ticket types whose data model might still change is
  how the "duplicated Order/Ticket fields" and other backlog data-model gaps happened before.
- Check `leeann-content-corrections` F4 status at dispatch time - if it has since run and
  produced real provisional figures, F1/F2 should consume them, not redo the work.
- Follow the same mandatory chain as Mission One: @architect(-apex where tier says apex) ->
  @dev -> @qa(-apex) adversarial -> mandatory Codex GPT-5.5 cross-model review -> @docs ->
  contract gate -> @maintainer -> commit. Do not skip the Codex pass - it caught a real bug
  Mission One's own adversarial QA missed.

## Closeout — F1 (2026-08-21)

F1 (Estimate and structure the Conferences category) done, contract gate 5/5 green.
@architect-apex confirmed `leeann-content-corrections` F4 had not yet run and real pricing
data does not exist, so F1 owned the provisional estimation itself per Brad's standing
instruction (estimate now, correct later, do not block on the council) rather than waiting.
`CONFERENCE_PRODUCTS` (6 entries: SAOC Symposium Early-Bird/Normal, WOSA Conference
Early-Bird/Normal, SAOC/WOSA Joint Early-Bird/Normal) added to `lib/provisional-figures.ts`,
following the exact same provisional-flagged, single-source-of-truth discipline as the F4
admission products; `scripts/seed-ticketing.ts` wired to seed them as `ticketType` Sanity
documents, same schema as the five existing admission products — no bespoke data model, no
Sanity schema/nav/checkout changes (those are F3/F4 of this mission). Chain: @architect-apex
(contract-f1.yaml, 5 shell assertions, goldens, decision record in
`contracts/golden/ticketing-conferences-f1/README.md`) -> @dev -> @qa-apex adversarial
(independently re-verified diff, pricing math, tsc, scope discipline, and the new
`requiresAttendeeNames` + `!requiresDaySelection` combination against every downstream
consumer — PASS, no defects) -> mandatory Codex GPT-5.5 cross-model review (PASS, exit 0)
-> @docs (`docs/f1-ticketing-conferences.md`, README milestones table) -> contract gate
5/5 PASS. M1 (F1+F2) not yet complete — F2 (Workshops/Field Trips/Cocktails category)
still pending. Next up: F2.

## Closeout — F2 (2026-08-21)

F2 (Estimate and structure the Workshops/Field Trips/Cocktails category) done, contract gate
5/5 green. **M1 (F1+F2) is now complete.** @architect-apex split the category into 4 real
priceable products (Sunset Cocktails single/couple, Field Trip single/all-outings) plus a
non-sellable `WORKSHOP_PRICING_STRUCTURE` placeholder — deliberately did not invent specific
workshop sessions, since those genuinely cannot be estimated without a council-confirmed list.

**Notable defect, first-pass chain missed it, Codex caught it:** first-pass @dev implementation
passed all 5 contract assertions, tsc, and @qa-apex's first adversarial review — PASS all
round. The mandatory Codex GPT-5.5 cross-model review then FAILED it, finding a real oversell
defect: `sunset-cocktails-couple` sells 2 heads per 1 capacity-slug-unit, and the two field-trip
options (single/all-outings) share one physical capacity pool as two independent counters —
both cases capable of overselling under the checkout's existing per-slug-only capacity
enforcement (`lib/checkout-reservation.ts`), which neither @architect-apex's original design nor
@qa-apex's first pass had modelled. This is exactly the class of bug the mandatory Codex pass
exists for: same-model-writes-and-reviews-its-own-code missed a real business-logic/capacity
defect that an independent model with no shared blind spot caught immediately.

**Fix pattern — interim numbers-only fix over touching shared checkout logic:**
@architect-apex, on revision, grounded the fix in the real checkout code
(`lib/checkout-reservation.ts`, `lib/data/tickets.ts`,
`app/api/tickets/checkout/route.ts`) and chose to resize the four capacity constants
(200/200/60/60 -> 100/50/30/30) so the worst case (all sales as the largest-heads-per-slug
variant, or all sales concentrated in one of the two pooled counters) can never exceed the real
physical ceiling — rather than rewriting the shared per-slug capacity-enforcement logic itself,
which is checkout-wide and higher risk to touch inside a data-model feature. The real fix (making
capacity enforcement multi-head- and shared-pool-aware) is explicitly deferred to F4 (checkout
wiring), with the tradeoff and the deferral documented in the golden README rather than left
implicit. @qa-apex's second pass independently hand-recomputed both worst cases and confirmed
both land exactly at the real ceiling, never over. Codex GPT-5.5's second pass, on the fixed
diff, PASS exit 0. Worth reusing this pattern elsewhere: when a real fix requires touching
shared, high-blast-radius logic that is out of the current feature's scope, a structurally-safe
numbers-only interim fix with an explicit documented tradeoff and a named deferred follow-up
feature is preferable to either scope creep or shipping the defect.

Chain: @architect-apex (contract-f2.yaml, 5 shell assertions + 2 new mechanical invariant
checks added on revision, goldens, `contracts/golden/ticketing-workshops-f2/README.md`) ->
@dev (first pass, then second pass applying the exact 4-constant fix) -> @qa-apex (first pass
PASS, missed the oversell defect; second pass PASS with independent worst-case
recomputation) -> Codex GPT-5.5 (first pass FAIL with file:line-cited oversell finding; second
pass PASS exit 0) -> @docs (`docs/f2-ticketing-workshops-field-trips.md`, README milestones
table) -> contract gate 5/5 PASS. Mission status stays `in_progress` — M2 (F3 nav extension,
F4 checkout wiring, which now also owns the deferred real capacity-pooling fix) still pending.
Next up: F3.

## Closeout — F3 (2026-08-21)

F3 (Build category-aware Conferences and Workshops & Field Trips purchase pages) done,
contract gate 14/14 green. @architect-apex confirmed the existing multi-line-item checkout
needed zero changes (already generic) and designed the category schema field, a
category-filtered GROQ query, and new pages/routes: `/national-show/conferences`,
`/national-show/workshops`, plus a `/national-show/tickets` chooser and the existing
`/tickets` admission page kept intact.

**This feature needed THREE defect-repair cycles — the most of any feature so far in this
mission.** Worth a future session knowing the pattern, since each cycle was a genuinely
different hazard class, not repeats of the same mistake:

1. **Real production-data hazard (caught by @qa-apex, not the contract).** Pass 1 was
   contract-green, but QA independently ran a real dev server against the live production
   Sanity dataset and found every existing `ticketType` doc has `category: null` — the new
   category-filtered query would have emptied the live `/tickets` admission page in
   production. Fixed with an admission-only null-category read-time fallback in the GROQ
   query plus a `warnMissingCategoryFallback` console-warning safety valve (A11-A13 added).
2. **Seed-script gap (caught by Codex GPT-5.5, not Claude's own QA).** Codex's first pass on
   the fix found `scripts/seed-ticketing.ts` never writes `category` onto newly-created docs
   — a permanent gap, not a migration-timing issue, since the null-fallback is deliberately
   admission-only.
3. **Import-safety hazard (found by @architect-apex while building fix #2, not looked for).**
   While fixing the seed-script gap, @architect-apex also found `scripts/seed-ticketing.ts`
   ran its live seed function unconditionally on module import — the same "a script that
   mutates live data unconditionally on import" defect class already known from
   `project_contract_checks_mutate_live_content.md` (second confirmed instance in this
   project). Confirmed non-destructive only because the seed operations happen to be
   idempotent. Fixed by extracting a pure `buildTicketTypeDoc()` (now including `category`)
   and adding an `import.meta.url === file://${process.argv[1]}` direct-execution guard
   (A14 added, 14 total).

Chain: @architect-apex (contract-f3-purchase-pages.yaml) -> @dev pass 1 + @qa-apex pass 1
(contract PASS, live-dataset FAIL) -> @architect-apex repair 1 (null-fallback + warning) ->
@dev pass 2 + @qa-apex pass 2 (PASS, re-verified against live dataset) -> Codex GPT-5.5 pass 1
(FAIL, seed-script category gap) -> @architect-apex repair 2 (pure builder fn + import guard,
found the import-safety hazard along the way) -> @dev pass 3 + @qa-apex pass 3 (PASS,
independently reproduced the import guard in isolation) -> Codex GPT-5.5 pass 2 (PASS, exit 0,
also ran tsc/eslint itself) -> @docs (`docs/f3-ticketing-purchase-pages.md`, README milestones
table) -> contract gate 14/14 PASS.

Mission status stays `in_progress` — M2 also has F4 (nav wiring, was blocked on F3's routes
existing, now unblocked) and F5 (checkout capacity-pooling fix, deferred from F2) still
pending. Next up: F4.

## Closeout — F4 (2026-08-21)

F4 (Extend the National Show mega-menu's Tickets column to include Conferences and Workshops &
Field Trips) done, contract gate 8/8 green. Confirmed Mission One's data-driven design held up
exactly as intended: `components/chrome/nav-config.ts`'s Tickets column is a plain data array,
so this was a pure append — two new entries (Conferences, Workshops & Field Trips) added
alongside the existing Visitor/Exhibitor/Vendor pattern, no structural change to
Header.tsx/MegaMenu.tsx/MobileMenu.tsx.

**Notable pitfall, orchestrator-caught, not a design/scope issue:** the architect-authored
`contract-f4-nav-wiring.yaml` had a YAML syntax bug — 5 of 8 shell `command:` values used a
shell-style `'"'"'` quote-splice inside a YAML single-quoted scalar, which YAML doesn't
understand (illegal "mapping values are not allowed here" or unbalanced quotes). Caught when
`execution/contract.py gate` failed to parse the file; fixed by switching to YAML's native `''`
single-quote-doubling escape, validated with `python3 -c "import yaml; yaml.safe_load(...)"`
before re-running the gate, which then passed 8/8 clean. See `learned.md` for the reusable
lesson — future architect passes should use YAML's own escaping, not shell idiom, when a
contract assertion's shell command needs literal single quotes.

Chain: @architect (contract-f4-nav-wiring.yaml + golden) -> @dev (`components/chrome/nav-
config.ts` append) -> @qa PASS, no defects -> Codex GPT-5.5 cross-model review PASS, no defects
-> @docs (`docs/f4-ticketing-nav-wiring.md`, README ticketing table) -> contract gate 8/8 PASS
(after the orchestrator's YAML fix).

**M2 is now 2 of 3 features done (F3, F4).** Only **F5** (checkout support for Conference and
Workshop/Field-Trip/Cocktail ticket types, plus the multi-head/shared-pool capacity-pooling fix
deferred from F2) remains before this mission closes. Next up: F5.

## Closeout — F5 (2026-08-21) — MISSION COMPLETE

F5 (checkout support for Conference and Workshop/Field-Trip/Cocktail ticket types) done,
contract gate 17/17 green. **This was the last feature of Mission Two — M2 is now 3/3 (F3, F4,
F5) and the entire mission (M1 + M2, all 5 features) is complete.**

@architect-apex confirmed Conference products (6, from F1) are fully additive against the
existing checkout with zero gap — the day-attendees flag-driven enforcement already handles
them generically. The Workshop/Field-Trip/Cocktail products (4, from F2) had a real, previously
named gap: F2's capacity-enforcement mechanism is strictly per-slug, with no concept of pooling
capacity across slugs or weighting a unit by how many physical heads it represents — the exact
gap F2's own "Capacity revision" section explicitly deferred to this feature rather than
pretending its interim numbers-only fix (resized constants) was the real fix.

**Design shipped:** two new additive/optional `ticketType` fields (`capacityPool: string | null`,
`headcountPerUnit: number`, default 1) and a new pure `planPooledCapacity()` function in
`lib/checkout-reservation.ts`, added alongside (not replacing) the existing `planCapacity()`.
When no product sets `capacityPool`, pool key == slug and weight == 1 for everything, so the new
function is byte-identical to the old one on every existing product — Admission and Conference
products get zero behavior change. `route.ts` now fetches `capacityPool`/`headcountPerUnit` per
ticketType, builds a pool-keyed `capacityByType` via `Math.min` (a defensive floor against the
data invariant — every pool member must declare an identical `capacity` — ever being violated),
and calls `planPooledCapacity()` in place of `planCapacity()`. The interim conservative numbers
from F2 (100/50/30/30) were restored to their real physical ceilings (200/200/60/60) now that
the pooling math correctly enforces them. The 18+ Sunset Cocktails restriction (left open by F2)
was decided here as a physical door-check policy, not a checkout-time mechanism — a checkout-time
self-attestation verifies nothing and would add a new PII surface for a control a door check
already provides more reliably; a contract assertion (A9) guards against the schema growing a
`dateOfBirth`/age-verification field as scope creep.

**This feature needed FIVE independent defect-repair cycles — the most of any feature in this
mission, and each one a genuinely different real bug, not a repeat.** Full account:

1. **Cross-slug pool oversell (route.ts wiring).** First Codex GPT-5.5 pass: `poolConfigByType`
   only covered ticketType slugs present in the current cart, not other slugs that share a pool
   but sold out via a different sibling. A10 added to prove pool config is built from every
   sibling, not just cart members.
2. **Two defects in the same second Codex pass, one backend and one UI, same root cause** (`active
   == true` and "own sold count vs. own capacity" both being per-slug assumptions unsafe once a
   slug joins a shared pool): (a) `ticketTypesByPoolQuery` filtered siblings on `active == true`,
   silently dropping a deactivated-but-still-holding-real-positions sibling from the pool
   entirely — an oversell via a different mechanism than #1, closed by A11. (b)
   `CategoryTicketsPage.tsx`'s sold-out check compared a pooled product's own sold count against
   its own `capacity` field, which almost never trips because the data invariant requires every
   pool member to declare the FULL pool ceiling, not a per-product share — closed by rewiring the
   UI to call the same `planPooledCapacity()` route.ts uses, proven by A12 (math) and A13
   (wiring/reachability).
3. **A14, found by @qa-apex auditing A13 itself, not a new production defect but a coverage gap
   in the proof:** A13 only proved `planPooledCapacity()` drives `soldOut` inside the UI's
   `cardData` map — it never proved the separate sibling-fetch-and-merge loop that populates
   `poolConfigByType` with off-page/inactive siblings was itself wired and reachable. @qa-apex
   proved the gap concretely: deleting that loop left A13 green, quietly reintroducing #2(b)'s
   exact oversell shape. A14 closes it by brace-matching the loop and requiring it to genuinely
   invoke the query and precede `cardData`'s computation.
4. **Fractional `capacity` accepted despite the Sanity schema declaring `integer()`.** Schema
   `validation:` is authoring-time only, not a read-time guarantee — a document written outside
   Studio with a fractional `capacity` would silently corrupt `planPooledCapacity()`'s arithmetic.
   Found the route was sharing `isUsableAmount()` (correct for the genuinely-fractional `price`)
   for `capacity` too. Fixed with a dedicated `isUsableCapacity()`; A15/A16 prove both predicates'
   real guarded bodies (via brace-matching + `new Function`, not a hand re-implementation that
   could drift) against a truth table, and A15 regression-guards that price's call site was left
   unchanged (not silently over-tightened to integer-only).
5. **`ticketTypesByPoolQuery` not scoped to the active show.** Third Codex pass: the query matched
   pool siblings by `capacityPool == $pool` alone, no show scoping — two unrelated shows both
   naming a pool the same string would collide, poisoning one checkout's capacity math with an
   unrelated show's sold counts. Fixed by adding `show._ref == $showId` to the query and passing
   `showId` at both call sites (route.ts and CategoryTicketsPage.tsx). A11 extended to assert the
   GROQ body; new A17 separately proves both call sites actually bind the `showId` param (an
   unbound GROQ param silently fails to filter rather than erroring — a distinct failure mode from
   the query definition itself being wrong).

Every one of the five was closed with a negatively-verified contract assertion (proven to fail
for the right reason against a broken copy of the code), not just re-reading the fix and agreeing
it looked right. Final Codex GPT-5.5 pass: PASS, no findings (also ran tsc/eslint itself). Final
@qa-apex whole-diff pass: PASS, no blocking findings.

Chain: @architect-apex (`contract-f5-checkout.yaml`, `goldens/f5-checkout.golden.md` — the design
record, read in full for the pool-key/weight algorithm and the door-check-policy rationale) ->
@dev (multiple passes, one per repair cycle above) -> @qa-apex (adversarial, including the A14
proof-of-proof-gap finding) -> Codex GPT-5.5 (three review passes, findings 1 and 2 on pass one/
two, finding 5 on pass three) -> @docs (`docs/f5-ticketing-checkout.md`, README updated) ->
contract gate 17/17 PASS.

**MISSION COMPLETE.** Both M1 (F1 Conferences estimation, F2 Workshops/Field-Trips/Cocktails
estimation) and M2 (F3 purchase pages, F4 nav wiring, F5 checkout) are done. SAOC ticketing now
covers all three categories from Lee-Ann's spec (Exhibition/Admission from Mission One +
`multi-line-item-cart`, Conferences and Workshops/Field-Trips/Cocktails from this mission) on one
shared cart/PayFast/confirmation pipeline, with pooled-capacity enforcement now generically
correct rather than approximated. Outstanding, tracked in `backlog.md`: workshop sessions
themselves are still unpriced/unbuilt (genuinely blocked on a council-confirmed session list, not
this mission's gap), and the admission products' `category: null` backfill (protected by F3's
fallback, not urgent) remains open.

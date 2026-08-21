---
schema: athanor.mission/v1
slug: ticketing-conferences-and-events
goal: 'Mission Two: extend ticketing to the two remaining categories from Lee-Ann''s spec -
  Conferences (SAOC Symposium / WOSA Conference / Joint) and Workshops/Field Trips/Cocktails -
  using the nav shell and provisional-figures discipline Mission One and F4 already established'
created_at: '2026-08-21T13:30:00+00:00'
started_at: '2026-08-21T16:05:00+00:00'
last_active_at: '2026-08-21T00:00:00+00:00'
status: in_progress
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F2
  ts: '2026-08-21T00:00:00+00:00'
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
  status: pending
  tier: standard
  title: Extend the National Show mega-menu''s Tickets column to include both new categories
  inline_brief: 'Mission One (`ticketing-nav-restructure`, shipped commit `3b83471`)
    deliberately built `components/chrome/nav-config.ts`''s Tickets column as a plain data
    array specifically so this step would be an append, not a rewrite - read that file and
    `docs/f1-ticketing-nav-restructure.md` first. Add "Conferences" and "Workshops & Field
    Trips" as two more entries (direct links, matching the existing Visitor/Exhibitor/Vendor
    pattern) once F1/F2''s routes exist. Do NOT touch Header.tsx/MegaMenu.tsx/MobileMenu.tsx
    structurally - if this feature finds it needs to, that''s a signal Mission One''s
    "data-driven for extensibility" claim was wrong and needs flagging, not silently
    patching around. Tier: standard - this should be a small, mechanical extension if Mission
    One''s design holds.'
- id: F4
  status: pending
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
    session logic the current day-selection code was not built for. Tier: apex - checkout/
    payment code, same risk class as the rest of ticketing.'
milestones:
- id: M1
  title: Estimate and structure both new categories
  features:
  - F1
  - F2
  status: done
- id: M2
  title: Wire them into nav and checkout
  features:
  - F3
  - F4
  status: pending
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

# F1 golden — Conferences category (SAOC Symposium / WOSA Conference / Joint)

Full decision record, pricing/capacity rationale, and schema-reuse justification live in
`contracts/golden/ticketing-conferences-f1/README.md` — this file is the pointer + the exact
shape @dev must produce; that README is the specification of *why*.

## Required shape: `lib/provisional-figures.ts`

Add a new export `CONFERENCE_PRODUCTS: ProvisionalAdmissionProduct[]` (reusing the existing
interface — do not declare a second, structurally-identical interface), alongside the existing
`ADMISSION_PRODUCTS`. Six entries, exact `slug`s:

- `saoc-symposium-early-bird`, `saoc-symposium`
- `wosa-conference-early-bird`, `wosa-conference`
- `saoc-wosa-joint-early-bird`, `saoc-wosa-joint`

Field values for every row are specified in `contracts/golden/ticketing-conferences-f1/README.md`'s
table. Non-negotiable structural invariants (enforced by
`contracts/checks/ticketing-conferences-f1/check-conference-products.mjs`):

- `requiresDaySelection: false` and `requiresAttendeeNames: true` on all six.
- `provisional: true` on all six.
- Early-bird rows (`*-early-bird` slugs): `earlyBirdCutoff === EARLY_BIRD_CUTOFF` (the existing
  shared constant, not a new literal date), `releasedQuantity === capacity`.
- Normal rows: `earlyBirdCutoff === null`, `releasedQuantity === null`.
- Each early-bird price is strictly less than its own normal sibling's price.
- The Joint price (either window) is less than the sum of the matching Symposium + Conference
  price in that same window, but greater than either alone — a real bundle discount, not a
  markup and not a giveaway.

## Required non-changes

- `sanity/schemas/documents/ticketType.ts` gets NO new fields and no conference/symposium/joint
  -named field. The six products are plain `ticketType` documents using fields F4 already added.
- No new Sanity schema document file for conferences (no parallel bespoke model).
- `scripts/seed-ticketing.ts` must import `CONFERENCE_PRODUCTS` from `lib/provisional-figures`
  the same way it already imports `ADMISSION_PRODUCTS` — never re-type the six price literals.
- No product name or description uses the bare word "Events."

## Out of scope for F1 (do not build in this feature)

- Nav wiring (Mission Two F3), checkout-code changes (Mission Two F4 — the existing
  `effectiveCapacity()`/`isWithinEarlyBirdWindow()` already work generically; only touch them if
  investigation genuinely shows a gap), any dedicated Conferences page/UI, and any live Sanity
  seed run.

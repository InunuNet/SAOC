# Partners section redesign

Contract: [`contracts/contract-partners-cards.yaml`](../contracts/contract-partners-cards.yaml)
(24/24 assertions green). Goldens: [`contracts/golden/partners-cards/`](../contracts/golden/partners-cards/).

## What this is

Brad rejected the home page's "In collaboration with" section as a bare
6-column bordered grid of names in 110px cells — it read as an unstyled
table, not a designed section. This redesigns it as three typography-led
partner cards and fixes a site-wide dead link the same review surfaced.

## Files changed

- `components/home/PartnersSection.tsx` — home page section, feeds from
  Sanity `sponsor` docs with a static fallback (`STATIC_PARTNERS`).
- `lib/data/partners.ts` — separate static list feeding the site-wide
  footer's "Partners" column.
- `components/chrome/Footer.tsx:117` — standalone "Looking for wild
  orchids?" link.

## Why three partners, not six

The previous six included American Orchid Society, Royal Horticultural
Society, and World Orchid Conference — invented during earlier work, with no
basis in any client document. Publicly asserting a partnership with real
external organisations that was never confirmed is a factual/legal exposure,
not a design nitpick. They are removed from both `STATIC_PARTNERS` and
`lib/data/partners.ts`, and the contract asserts their absence (PC-05–07,
FTR-01–03) so nobody reintroduces them by "restoring" the old list.

The three kept partners (WOSA, SANBI, Kirstenbosch NBG) are real and
documented. WOSA's card copy specifically names the 2027 National Show tie-in
(WOSA hosts a conference at the Show — see Spec V3) rather than generic
filler — per CLAUDE.md's scope boundary, the copy describes the *partnership
and the Show tie-in*, never wild-orchid conservation as SAOC's own remit.

## Why the footer was in scope

The handoff originally targeted only the home page section. QA's PASS on
that scope surfaced that `components/chrome/Footer.tsx` renders a *third*,
independent partner list — `lib/data/partners.ts` — on every page via
`app/(marketing)/layout.tsx`. Fixing only the section would have left the
home page self-contradicting (3 partners in the section, 6 in its own
footer) and every other page still asserting the invented partnerships. The
team lead pulled the footer back into scope once this was caught. Lesson:
a visual fix scoped to "the component the designer flagged" can still miss a
second hardcoded copy of the same data — worth an explicit grep for other
consumers before calling a data trim done.

The footer fix is asserted on `/about` (FTR-01–08), not `/`, specifically to
prove it's page-wide via the shared component rather than coincidentally
correct only where the section also happens to be fixed.

## Two hardcoded sources, deliberately not merged

`STATIC_PARTNERS` in `PartnersSection.tsx` and `partners` in
`lib/data/partners.ts` are two separate arrays kept in sync by hand — both
list the same three names, but the footer's list is `{ name }` only. This is
a known, accepted trade-off, not an oversight: merging them into one shared
data source is a data-model refactor (the `Partner` type in
`types/index.ts:79` already has optional `url?`/`logoUrl?` fields that could
carry it) and didn't belong in a visual fix. If the two lists ever need to
diverge in structure again, that merge is the right-sized follow-up, not
scope for a redesign task.

## Sanity path — how an editor takes over

The static list only renders because `sanity/queries.ts:164`'s
`partnersQuery` filters `*[_type == "sponsor" && active == true]`, and no
live `sponsor` document has `active` set today. To make Sanity content take
over from `STATIC_PARTNERS`:

1. In Studio, open a `sponsor` document and set `active: true`.
2. Optionally set `description` — `PartnersSection.tsx` renders it under the
   name (`toCards()` now carries `description` through from Sanity, same as
   `name`/`website`).
3. Repeat for each partner that should appear; `tier` controls sort order.

The component does not assume exactly three cards — it maps over the full
`cards` array with a responsive grid (`grid gap-6 sm:grid-cols-2
lg:grid-cols-3`), so N live `sponsor` docs render correctly without a code
change (guarded structurally by PC-10, which greps for hardcoded
`slice(0,3)`/`cards[0]`/`length === 3`).

## What the gate does and doesn't prove

PC-09 asserts the section's rendered text exceeds 250 characters, as a
proxy for "this is designed copy, not a bare name grid" (pre-change: ~190
chars). It's a proxy, not a design check — it can't distinguish real partner
descriptions from arbitrary padding text of the same length. Card layout,
hover state, and typographic hierarchy were verified by QA screenshots
across two rounds, not by any shell assertion. Treat the gate as proof of
data correctness, dead-link fixes, accessibility attributes, and structural
scalability — not proof of visual quality.

## Known open defect (not fixed here)

The card's name and description are adjacent JSX `<span>`s with no
whitespace between them, so the anchor's accessible name concatenates them
without a space (e.g. "...AfricaPartner organisation..."). Minor,
non-blocking, logged as a follow-up — not fixed as part of this change.

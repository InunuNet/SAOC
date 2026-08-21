# ticketing-conferences-f1 — decision record

Mission `ticketing-conferences-and-events`, milestone M1, feature F1: "Estimate and structure
the Conferences category (SAOC Symposium / WOSA Conference / Joint)." Full mission file:
`.agent/memory/project/missions/2026-08-21-ticketing-conferences-and-events.md`. Extends the
discipline established in `contracts/golden/ticketing-f4-admission-products/README.md` — read
that first; this file assumes it.

## What this feature is, in one sentence

Add six Conference `ticketType` documents (SAOC Symposium Early-Bird/Normal, WOSA Conference
Early-Bird/Normal, SAOC/WOSA Joint Early-Bird/Normal) to the same provisional-figures discipline
and the same Sanity schema the five admission products already use — no new schema fields, no
parallel data model, one new sibling array in the existing single-source-of-truth file.

## Why F1 does its own estimation instead of waiting

`leeann-content-corrections` F4 was going to produce these figures but has NOT run — confirmed
by reading `lib/provisional-figures.ts` (only `ADMISSION_PRODUCTS` exists, five entries, git log
shows only commit `360dd15` touched the file) and that mission's own file (`status: pending` on
F4). Lee-Ann's pricing questionnaire artifact (`reference_leeann_pricing_artifact` memory,
re-verified 2026-08-21) confirms her actual answers are still unsaved — `<script
id="state">{}</script>` is empty; section C (Conferences) carries no client-supplied figures at
all, unlike the admission products where her doc had pencilled-in prices to transcribe verbatim.
There is no real anchor to transcribe. Per Brad's standing instruction (estimate now, correct
later, do not block on the council — see `project_ticketing_spec_approved` /
`provisional-figures.md`'s own header), this feature estimates from scratch, using the exact
same containment discipline: one file, one array, a machine-readable `provisional: true` flag
per row, trivial wholesale replacement later.

## Schema: reuse, not a parallel model

Read `sanity/schemas/documents/ticketType.ts` before designing anything. F4 already made this
schema fully generic — `provisional`, `earlyBirdCutoff`, `releasedQuantity`,
`requiresDaySelection`, `requiresAttendeeNames` are per-document booleans/optionals with no
admission-specific semantics baked in. **No schema changes are needed or permitted by this
feature.** The six Conference products are plain `ticketType` documents using the existing
fields; A3 in the contract proves no conference/symposium/joint-named field or sibling schema
file was added, which would indicate a parallel bespoke model instead of reuse.

## Single source of truth: `lib/provisional-figures.ts` — new `CONFERENCE_PRODUCTS` array

Reuses the existing `ProvisionalAdmissionProduct` interface verbatim (same six required fields
per row) rather than declaring a second, structurally-identical interface — a duplicate type for
an identical shape is exactly the kind of divergence-by-copy this file's own header warns
against. The interface name is a minor mismatch (`Admission` no longer describes every row) but
renaming it would touch every existing F4 import (`scripts/seed-ticketing.ts`,
`app/(marketing)/tickets/page.tsx`, `lib/checkout-reservation.ts` call sites) for a cosmetic
gain — not worth the blast radius for this feature. @dev should add `CONFERENCE_PRODUCTS:
ProvisionalAdmissionProduct[]` as a new export, alongside (not replacing) `ADMISSION_PRODUCTS`.

```ts
export const CONFERENCE_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'saoc-symposium-early-bird',
    name: 'SAOC Symposium (Early-Bird)',
    price: 450,
    capacity: 150,
    releasedQuantity: 150,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  { slug: 'saoc-symposium', name: 'SAOC Symposium', price: 550, capacity: 150,
    releasedQuantity: null, earlyBirdCutoff: null,
    requiresDaySelection: false, requiresAttendeeNames: true, provisional: true },
  { slug: 'wosa-conference-early-bird', name: 'WOSA Conference (Early-Bird)', price: 450,
    capacity: 150, releasedQuantity: 150, earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false, requiresAttendeeNames: true, provisional: true },
  { slug: 'wosa-conference', name: 'WOSA Conference', price: 550, capacity: 150,
    releasedQuantity: null, earlyBirdCutoff: null,
    requiresDaySelection: false, requiresAttendeeNames: true, provisional: true },
  { slug: 'saoc-wosa-joint-early-bird', name: 'SAOC/WOSA Joint (Early-Bird)', price: 750,
    capacity: 80, releasedQuantity: 80, earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false, requiresAttendeeNames: true, provisional: true },
  { slug: 'saoc-wosa-joint', name: 'SAOC/WOSA Joint', price: 900, capacity: 80,
    releasedQuantity: null, earlyBirdCutoff: null,
    requiresDaySelection: false, requiresAttendeeNames: true, provisional: true },
];
```

Each `description` is @dev's call for exact copy, but MUST be permanent factual copy (what the
registration covers), never pricing/confirmation-status prose — same rule as F4's `description`
field, enforced there by the flag-gated badge doing all provisional messaging. Descriptions must
never use the bare word "Events" (see "Naming: no bare Events" below).

## The six products — pricing and structure rationale (ALL our estimate, no client source)

| Slug | Name | Price | Capacity | Released | Early-Bird Cutoff | Day Select | Attendee Names |
|---|---|---|---|---|---|---|---|
| `saoc-symposium-early-bird` | SAOC Symposium (Early-Bird) | R450 | 150 | 150 | 2027-07-31 | ✗ | ✓ |
| `saoc-symposium` | SAOC Symposium | R550 | 150 | ∅ | ∅ | ✗ | ✓ |
| `wosa-conference-early-bird` | WOSA Conference (Early-Bird) | R450 | 150 | 150 | 2027-07-31 | ✗ | ✓ |
| `wosa-conference` | WOSA Conference | R550 | 150 | ∅ | ∅ | ✗ | ✓ |
| `saoc-wosa-joint-early-bird` | SAOC/WOSA Joint (Early-Bird) | R750 | 80 | 80 | 2027-07-31 | ✗ | ✓ |
| `saoc-wosa-joint` | SAOC/WOSA Joint | R900 | 80 | ∅ | ∅ | ✗ | ✓ |

**Early-bird cutoff:** reuses the existing `EARLY_BIRD_CUTOFF` constant (`2027-07-31`) rather
than inventing a second date — one early-bird window across the whole show, consistent with the
admission products, and there is no basis to estimate a different cutoff for conference
registration specifically.

**Symposium and Conference priced identically:** both are parallel single-track registrations
at the same venue over the same show days (talks/lectures, not admission), so there's no basis
to price one differently from the other absent any client input distinguishing them.

**Joint is priced as a real bundle, not a sum:** R750 (early-bird) / R900 (normal) is roughly
17–18% cheaper than buying both single-track early-bird/normal tickets separately (R900/R1,100),
while remaining pricier than either single track alone — the whole point of a "Joint" product
existing is to be a genuine discount for attending both, never a de facto free upgrade. The
checker script (`contracts/checks/ticketing-conferences-f1/check-conference-products.mjs`)
enforces this relationship structurally (bundle < sum of singles, bundle > either single alone),
not just as a documented intention — a defect that priced Joint above the sum of singles, or
below either single track, would fail A1.

**Capacity — OUR ESTIMATE, no client source, same caveat as admission products':** The venue is
The Hangar (Stellenbosch Flying Club) — same physical constraint noted in
`provisional-figures.md`. Symposium/Conference are parallel breakout tracks sharing the hangar
floor with the exhibition and vendor stands, so 150 each (matching the admission Early-Bird
Weekend Pass's rough order of magnitude) is a conservative seated-lecture estimate, not a
bare-floor figure. Joint attendees occupy seats in both tracks' schedule simultaneously (by
alternating sessions), so their pool is necessarily smaller — 80 is set below either single
track's capacity, never above, per `provisional-figures.md`'s "capacity is a ceiling to be
lowered, never raised" instruction.

**`requiresAttendeeNames: true` on all six (new, no admission-product precedent for "all"):**
conference/symposium registration conventionally requires a named attendee for badges/session
sign-in, unlike the bare Day Visitor/Weekend Pass admission tickets. Only the admission VIP
ticket sets this today; here it's true for every row because every row IS a named registration,
not an anonymous admission ticket. This is a genuine judgement call, not a client-confirmed
requirement — flagged here explicitly, not buried in a comment.

**`requiresDaySelection: false` on all six:** a Symposium/Conference/Joint registration is a
multi-day pass to that track for the whole show run, not a single day's admission — there is no
"which day" choice to capture, unlike Day Visitor.

## Naming: no bare "Events" — this category doesn't collide, but stays consistent

`ticketing-nav-restructure` F2's golden (`f2-events-naming.golden.md`) flagged that the
Workshops/Field-Trips/Cocktails category (Mission Two's F2, not this feature) risks colliding
with the existing `/events` societies-calendar nav label if it's ever called bare "Events."
Conferences carries no such collision risk — none of "Symposium," "Conference," or "Joint" is
ambiguous with the site's existing "Events" nav item. This feature's names/descriptions simply
never use the word "Events" at all (A4 proves this negatively, so if a future edit does
introduce it, the regression is caught rather than assumed impossible forever).

## What this feature deliberately does NOT do

- **Nav wiring** — adding these six products to the National Show mega-menu's Tickets column is
  Mission Two F3's scope (`components/chrome/nav-config.ts` — already a plain data array per
  Mission One, ready for exactly this kind of append). Not touched here.
- **Checkout enforcement changes** — `effectiveCapacity()`/`isWithinEarlyBirdWindow()` already
  work generically on any `ticketType` document's `capacity`/`releasedQuantity`/
  `earlyBirdCutoff`; the six new products flow through the SAME existing enforcement with zero
  code changes, per F4's design. Mission Two F4 owns confirming/extending checkout if these
  categories turn out to need fields the current schema doesn't carry (Brad's own F4 brief says
  do not assume additive without checking) — this feature's job is only to prove the DATA shape
  is a clean fit, which A1 does.
- **A dedicated ticket-type page or cart-UI copy for Conferences** — out of scope; F3/F4 of this
  mission own presentation and checkout wiring respectively.
- **Seeding into Sanity** — `scripts/seed-ticketing.ts` extension (importing `CONFERENCE_PRODUCTS`
  the same way it imports `ADMISSION_PRODUCTS`) is @dev's implementation task, not proven by a
  live Sanity round-trip in this contract (same offline posture as F4's own contract) — A2 proves
  the seed script does NOT re-type the six price literals itself (must import, not duplicate).

## What this contract deliberately does NOT prove

- A live HTTP round-trip against a deployed Next server or a real Sanity dataset — same
  offline/credential-free posture as `ticketing-f4-admission-products`.
- Whether R450/R550/R750/R900 are anywhere close to what the council will actually charge — they
  are the web team's estimate, explicitly flagged provisional, and expected to be replaced
  wholesale per `provisional-figures.md`'s "Replacement procedure" once Lee-Ann's answers land.

## Replacement procedure

Identical to `provisional-figures.md`'s existing procedure — when real figures land, replace the
`CONFERENCE_PRODUCTS` values in this one file, flip `provisional: false` per Sanity document as
each is confirmed, re-run the gate, and record the delta in `provisional-figures.md`.

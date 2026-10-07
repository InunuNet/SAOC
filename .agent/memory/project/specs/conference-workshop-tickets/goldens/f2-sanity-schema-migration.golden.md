# F3 Golden — Sanity Schema + Migration + Pool/Day-Exclusion Enforcement Wiring

Mission `conference-workshop-tickets`, feature F3 (milestone M2; renumbered from the
original F2/M1, then revised again same day for Brad's message 6 shared-pool/no-Thursday
ruling — filename kept as `f2-sanity-schema-migration.golden.md` per the project's
no-delete/no-rename-files rule).

## New Sanity schema: exactly ONE new field

### `sanity/schemas/documents/ticketType.ts` — `excludedDays`

```
excludedDays: array of strings (ISO date, e.g. '2027-09-23'), optional
```

Additive, optional, defaults to no exclusion when unset — zero behavior change for every
existing product that doesn't set it. Backs F2's new `excludedDays` field on
`ProvisionalAdmissionProduct` (day-visitor and its early-bird slug: `['2027-09-23']`,
excluding Thursday per Brad's message 6).

**`capacityPool`/`headcountPerUnit` already exist on this schema** (used today by
Sunset Cocktails single/couple) — confirmed by assertion, NOT re-added. Applying them to
`weekend-pass-early-bird` and the `early-bird` slug is a pure data classification, no
schema change.

**`earlyBirdTrancheSize` is NOT added.** F1's revision (message 6: "No early bird for
Symposiums and conferences") removed this field's only would-be consumer before it was
ever added to the schema — it never existed in Sanity and does not get added here.

### `conferencePresenter` / `workshopSession` document types — unchanged, carried forward

Unaffected by message 6 (Brad's message 5 on presenter cards stands). Same shape as the
prior revision of this golden:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `role` | string | no | |
| `photo` | image | no | Omitted until Lee-Ann supplies one |
| `bio` | text | no | |
| `event` | string, options `['saoc-symposium', 'wosa-conference']` | yes | |
| `order` | number | no | |
| `provenance` | string, options `['council-supplied', 'council-draft', 'research', 'placeholder-ai']`, NO initialValue | yes | Same discipline as `showPageSection.ts` |

`workshopSession`: `title` (string, required), `description` (text), `presenter`
(reference to `conferencePresenter`), `timeSlot` (free text, no invented date/time),
`ticketType` (reference, set only once a real session is confirmed), `provenance` (same
4-value enum, required, no initialValue).

Both registered in `sanity/schemas/index.ts`'s documents array.

**Deliberately NOT reused:** `showPageSection`'s reserved `entityList` `kind` — same
reasoning as the prior revision; stays scoped to `national-show-ia-alignment`'s M2.

## Migration script: `scripts/migrate-conference-workshop-tickets.ts`

Correct polarity (matches `scripts/migrate-f2-ticket-taxonomy.ts`'s precedent exactly —
the mission's own "LIVE HAZARD" note names six prior scripts that got this backwards):

- `const APPLY = process.argv.includes('--apply');` checked **before** any
  `createClient(...)` call. Dry-run needs zero Sanity env vars and exits 0 printing the
  planned diff from `lib/provisional-figures.ts`.
- `--apply` is the only mutating path.
- **New requirement (team-lead's correction, 2026-10-07, after a read-only Sanity query on
  the live dataset found `ticketType-saoc-symposium`/`ticketType-wosa-conference` still
  `active: true` at the OLD price 550, and the four `RETIRED_CONFERENCE_SLUGS` documents
  also still `active: true`):** the script's patch set is NOT computed ad hoc inline —
  it exports one pure function,

  ```typescript
  export function buildMigrationPatches(): Record<string, Record<string, unknown>>
  ```

  keyed by Sanity document `_id`, built directly from `lib/provisional-figures.ts`'s live
  exports (`CONFERENCE_PRODUCTS`, `ADMISSION_PRODUCTS`, `WORKSHOP_FIELD_TRIP_PRODUCTS`,
  `RETIRED_CONFERENCE_SLUGS`, `RETIRED_SUNSET_COCKTAILS_SLUGS`) — never a second,
  hand-typed copy of any slug list or figure. Both the dry-run path (prints this plan) and
  the `--apply` path (patches each `_id` with its value) call this SAME function, so the
  two paths cannot diverge. This is also what makes the plan independently verifiable: a
  check script can `import` and inspect `buildMigrationPatches()` directly — deterministic,
  zero Sanity env vars, same dry-run posture as A11 — rather than scraping console output
  or requiring a live dataset read to prove the plan is correct.
- **Patches, never creates**, every one of: `ticketType-saoc-symposium`,
  `ticketType-wosa-conference` (flat R2000/80cap, no tranche field, no early-bird),
  `ticketType-vip`, `ticketType-weekend-pass` (price 380, regularPrice/earlyBirdCutoff
  cleared to null), `ticketType-day-visitor` (price/capacity + new `excludedDays:
  ['2027-09-23']`), `ticketType-early-bird` (price/capacity/`capacityPool:
  'admission-early-bird'`/`excludedDays: ['2027-09-23']`/earlyBirdCutoff cleared),
  `ticketType-sunset-cocktails-single`, `ticketType-sunset-cocktails-couple`. The
  symposium/WOSA patch object explicitly includes `price: 2000, capacity: 80,
  earlyBirdCutoff: null` and omits/clears any tranche-named field — read from
  `CONFERENCE_PRODUCTS` directly, never a separately-typed 2000/80.
- **Does NOT create `ticketType-weekend-pass-early-bird`.** That document does not exist
  yet by definition (it's a new product), so this script has nothing to patch for it.
  Its creation is `scripts/seed-ticketing.ts`'s existing, UNMODIFIED job: that script
  already iterates `ADMISSION_PRODUCTS` generically and calls
  `client.createIfNotExists(buildTicketTypeDoc(product, ...))` per product
  (`scripts/seed-ticketing.ts:181`) — once F2 adds the product to the array, re-running
  that existing script creates its document with zero new code. Keeping creation out of
  the migration script preserves its patch-never-create invariant with no exception.
- **Sets `active: false` on every one of the four `RETIRED_CONFERENCE_SLUGS` documents
  (read from the constant — `RETIRED_CONFERENCE_SLUGS.map(slug => \`ticketType-${slug}\`)`,
  never a hand-typed list of four ids), if each exists, never `.delete()`.** This is the
  piece the live-dataset read-only query found missing; it is now a first-class, separately
  asserted part of `buildMigrationPatches()`'s own output, not folded invisibly into the
  "patches the seven pre-existing docs" bullet above where it can silently go missing
  again.
- Sets `active: false` on the one `RETIRED_SUNSET_COCKTAILS_SLUGS` document
  (`ticketType-sunset-cocktails-couple`) if it exists, same existence-checked, never-delete
  pattern — team-lead's second-pass default (2026-10-07), flagged not a resolution of
  whether this tier should exist at all.
- Creates **zero** `conferencePresenter`/`workshopSession` documents.
- Every patched document also gets a non-null `sourceCitation` citing Brad's message 6
  (or the earlier Lee-Ann's-sheet citation where message 6 didn't touch a value).

## Enforcement wiring: `app/api/tickets/checkout/route.ts`

Two additive changes, both narrowly scoped, neither touching the ticket-router/buy UI
tree (`app/(marketing)/national-show/tickets/buy/**` — a separate in-flight mission's
lane):

1. **Shared early-bird pool — ZERO code change needed.** The route's existing
   `poolConfigByType`/`capacityByType` construction (route.ts:505-639) already reads
   `capacityPool`/`headcountPerUnit` generically from EVERY distinct ticketType's own
   Sanity document — it is not hardcoded to Sunset Cocktails. Classifying
   `weekend-pass-early-bird` and `early-bird` with `capacityPool: 'admission-early-bird'`
   in their Sanity documents is sufficient: `planPooledCapacity()`
   (`lib/checkout-reservation.ts:440`) already enforces the combined 500-ticket ceiling
   race-safely, the same way it already enforces the Sunset Cocktails pool in production.
   Proven by an assertion that this feature's diff does NOT touch
   `poolConfigByType`/`planPooledCapacity` construction code — reuse, not reinvention.
2. **Day exclusion — one small additive read-and-check.** `SanityTicketType` gains an
   `excludedDays: unknown` field; the GROQ projection (`ticketTypeBySlugQuery`) projects
   it; a new `isUsableExcludedDays()` validator (same fail-closed-on-garbage,
   null/undefined-means-no-exclusion posture as its sibling `isUsableX` validators)
   checks it; captured into a new `excludedDaysByType: Record<string, string[]>` map
   alongside the existing per-type maps (route.ts:505-515's pattern); and in the existing
   per-line-item day-selection validation loop (route.ts:645-662), immediately after the
   `isValidChosenDay()` check, a new check rejects a `chosenDay` present in that type's
   `excludedDays` with a 400 and a message naming the reason (e.g. "Day Pass is not
   available on this day"). `isValidChosenDay()` itself is UNCHANGED — this is a second,
   additive check, not a modification of the existing show-window validator (so nothing
   else that calls `isValidChosenDay()` is affected).


## Addendum (architect, 2026-10-07, check-authoring pass): one small pure helper for A24's testability

The day-exclusion DECISION itself (is this `chosenDay` excluded for this ticket type) gets
one small pure function, same convention as `resolveChosenDayForPosition()`
(`lib/checkout-reservation.ts`, F5/ticketing-f5-day-attendees) — the route stays
structurally provable by a line-position "wiring" check (A22), while the decision logic
itself is directly unit-testable by a "real dry-run" check (A24) without mocking Next.js
requests or Sanity fetches:

```typescript
export function isChosenDayExcluded(
  chosenDay: string | null | undefined,
  excludedDays: string[] | null | undefined,
): boolean
```

Lives in `lib/checkout-reservation.ts`, next to `resolveChosenDayForPosition()`. Returns
`true` only when both a `chosenDay` and a non-empty `excludedDays` are present AND
`excludedDays.includes(chosenDay)`; `false` whenever `excludedDays` is null/undefined/empty
(the "optional, defaults to no exclusion" invariant stated above) or `chosenDay` is
null/undefined. The route's new rejection check (§"Day exclusion" above) calls this function
inline, the same "inline inside the call" wiring shape `check-chosen-day-persistence-
wiring.sh` already proves for its sibling strip function — never a second, hand-written
`.includes()` check duplicated elsewhere.

## What this feature does NOT do

- Does not touch `field-trip` — unchanged, absent from every source, flagged not deleted.
- Does not create any sellable `workshopSession` ticketType document — none is
  council-confirmed yet.
- Does not modify `app/(marketing)/national-show/**` or the ticket-router/buy tree — F5
  and a separate in-flight mission respectively.
- Does not touch `lib/vendor-stand-pricing.ts` or any exhibitor/vendor pricing — F4's own
  milestone.
- Does not build any "N of X left" display — the pool/exclusion mechanism is enforced
  server-side regardless of whether any UI shows a running count; F1 and F5 both record
  that decision as flagged-not-built.

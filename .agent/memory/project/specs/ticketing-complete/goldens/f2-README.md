# ticketing-complete M1/F2 — design record

Sanity `ticketType` schema/seed extension covering every F1 taxonomy category, with
provisional capacities. This is the first feature in the mission that CAN write to the
Sanity dataset — and there is only one dataset (`production`), read by both local dev and
the live beta site. Designed accordingly: **the migration is code, written and unit-tested,
but its real execution against the live dataset is explicitly deferred to Brad's own
approval in the morning (F8)**. Nothing in F2's contract gate mutates data.

## 1. Files this feature creates/extends

- `scripts/migrate-f2-ticket-taxonomy.ts` — NEW. The migration script. Patches the 5
  admission SKUs' `category` field, retires (`active: false`) the two invented
  Sunset-Cocktails/Field-Trip SKUs plus `early-bird-weekend-pass`, and seeds the new
  flat-rate Field Trip product. Never deletes, never renames a slug.
- `lib/provisional-figures.ts` — EXTENDED. Adds `sourceCitation: string | null` to
  `ProvisionalAdmissionProduct`; updates `WORKSHOP_FIELD_TRIP_PRODUCTS` per
  `goldens/f2-provisional-figures-decisions.json`.
- `components/tickets/TicketTypeCard.tsx` — EXTENDED. Adds `data-placeholder="true"` on
  the card's root element when `provisional === true`, alongside the existing
  `data-testid="provisional-badge"` text marker. `data-placeholder` is the repo-wide
  convention (`components/societies/SocietyAbout.tsx`, `BoardGrid.tsx`, `Timeline.tsx`) for
  marking placeholder content in a way integrity checks can grep the rendered DOM for — it
  is how Brad finds every guessed number in the morning walkthrough, not just a visual badge.
- `docs/ticketing-complete-f2-open-decisions.md` — NEW. The surfaced-not-resolved decisions
  list, feeding F8's morning review. See `goldens/f2-open-decisions.json` for required
  content.

## 2. THE HARD RULE — no dataset writes in this mission

Confirmed 2026-09-08 (team lead, live dataset-list API query): there is only ONE Sanity
dataset, `production`. Local `next dev` and the deployed beta site read the SAME data. Any
write this mission RUNS is a deploy by side-effect, contradicting Brad's explicit
"local only, not deployed" instruction — he is asleep and cannot approve it.

**The precedent script gets this backwards and must not be copied.**
`scripts/fix-vip-and-weekend-pass-pricing.ts:78` reads
`const DRY_RUN = process.argv.includes('--dry-run')` — meaning its DEFAULT, no-flag
invocation MUTATES; you must remember to pass `--dry-run` to stay safe. That is the unsafe
polarity: a script is one missed flag away from a live write. `migrate-f2-ticket-taxonomy.ts`
inverts it:

- Default invocation (no flags at all) prints the plan and writes nothing. It must not even
  construct a Sanity write client, and therefore must not require `SANITY_API_TOKEN` /
  `NEXT_PUBLIC_SANITY_PROJECT_ID` / `NEXT_PUBLIC_SANITY_DATASET` to be set for this path to
  succeed — the flag check happens BEFORE any client construction or env read, not after.
- `--apply` is the ONLY flag that mutates. There is no `--dry-run` flag to forget.
- `--verify` reads live state back (query only, `client.fetch`, never `.patch`/`.commit`) to
  confirm a prior `--apply` run landed correctly — same shape as the precedent script's own
  `runVerify()`, which is already safely read-only and fine to reuse as a pattern.
- This mission never invokes `--apply`. That step is explicitly Brad's, in the morning,
  after he reads F8's review — not something any agent runs tonight "to be helpful."

## 3. Retire, never delete or rename

Firestore has 39 real ticket positions. Retired slugs already have real positions against
them (`adult` 14, `exhibitor` 7, `pensioner` 1) and are already handled correctly —
`active: false`, document intact. **`early-bird-weekend-pass` has 1 REAL position** — a real
person's real booking, and its `_id` is a foreign key from that position's perspective.
The migration script must set `active: false` on it and nothing else; it must never appear
as the target of a delete call or a slug-rename anywhere in the script's source.
`weekend-pass` has 0 positions — reshaping it is comparatively low-risk, but "low-risk" is
not "in scope for --apply tonight" either; the same dry-run-only rule covers it.

## 4. Idempotent, keyed on stable identity

Matches the established, already-audited-correct convention (`seed-ticketing.ts`'s
`createIfNotExists`, keyed `ticketType-${slug}`): every document this script touches or
creates is addressed by its stable `_id` (`ticketType-<slug>`), never re-derived from a
mutable display `name`. This is a prior audited defect in this repo, not a hypothetical.

## 5. Provisional capacities: `provisional: true` AND `data-placeholder`

Every capacity/price this script seeds or leaves as a guess carries `provisional: true` on
the Sanity document (existing field) AND causes `data-placeholder="true"` to render on the
public card (new `TicketTypeCard.tsx` behaviour, §1). `data-placeholder` is load-bearing —
F8's morning-review integrity check (and any future Playwright coverage, F7) can grep the
rendered DOM for it directly, rather than relying on someone visually noticing a small italic
badge.

## 6. Real-vs-provisional citation — `sourceCitation`

See `goldens/f2-provisional-figures-decisions.json` for the exact field addition and the two
real figures it carries: Sunset Cocktails (Single R800 / Couple R1500) and Field Trips (flat
R200/trip, replacing the invented Single/All-Outings bundle split) — both cited to Lee-Ann's
"13.1 Ticketing system details.docx". `provisional` and `sourceCitation` answer different
questions (council-confirmed? vs. where did this number come from?) and are not mutually
exclusive — a cited real figure can still be provisional pending council sign-off.

## 7. SAOC Symposium — date and venue are UNKNOWN, not just unset

Per the analyst's finding: Lee-Ann's own FAQ document contains a literal placeholder
("xx, xx September 2027 at the xx") for the Symposium's date/venue — nobody on the client
side has decided this yet. `ticketType` has no date/venue field today; F2 must not add one
populated with a guess, and must not default it to the show's own `startDate`/venue as a
stand-in (that would fabricate an eligibility/scheduling fact the mission's hard constraint
#4 forbids just as much as an invented price would). The existing Symposium product
descriptions already say nothing about date or venue — F2 must keep it that way.

## 8. Surfacing, not resolving

Every open decision in `goldens/f2-open-decisions.json` (VIP price ladder, the two-SKU
Weekend Pass gap, the 2027-07-31-vs-2027-06-18 cutoff mismatch, the Sunset
Cocktails/Field-Trip figure replacement, the Symposium date/venue unknown, council@ vs
info@, the six-script dry-run-polarity hazard (§12), and the membership
question — see §10 and §11) is written into `docs/ticketing-complete-f2-open-decisions.md`
for F8's morning review — never silently picked by the migration. A migration that quietly
chooses a winner destroys the evidence that a decision was ever needed, which is worse than
leaving the inconsistency visible.

## 9. Workshop restraint

`workshop` stays a taxonomy CATEGORY (F1) with zero sellable ticketType documents (F2). No
fake session (name/date/capacity) gets seeded to "complete" the taxonomy —
`WORKSHOP_PRICING_STRUCTURE`'s existing "no real session is council-confirmed yet" rationale
is unchanged and F2 must not override it.

## 10. Exhibitor Entry — resolved by NOS, lands here as a FOURTH schema enum value

Negotiated 2026-09-08 with the NOS session (`saocnosdesign-ea`): Exhibitor Entry is its own
category, `exhibitor-entry` — deliberately NOT folded into `admission`. Entering plants for
judging is a different transaction from attending (the buyer is a participant, not a
visitor); collapsing the two would silently destroy the visitor-vs-exhibitor split in any
later count, which is exactly the distinction Brad asked to be unmistakable.

**F1 is not retrofitted.** `lib/ticket-taxonomy.ts`'s `TICKET_CATEGORY_PURCHASE_SURFACE.exhibitor`
stays the literal `'unresolved-nos-boundary'` — F1 is contract-locked (A8) and verified
11/11 exactly as shipped, and that literal did its job: it refused to guess, which is what
forced this negotiation instead of a silent mismatch surfacing weeks later. The resolution
lands where the enum can actually hold the answer:

- `sanity/schemas/documents/ticketType.ts`'s `category` field widens from 3 values
  (`admission` | `conference` | `workshop-field-trip`) to 4, adding
  `{ title: 'Exhibitor Entry', value: 'exhibitor-entry' }`.
- This is a schema-only change in F2's scope. Actually seeding/selling an exhibitor
  `ticketType` document is NOT F2's job — that purchase surface
  (`/national-show/exhibitors`) lives inside `app/(marketing)/national-show/**`, still out
  of bounds for this mission. F2 only needs to prove the enum can hold the value; it is not
  required to create a document that uses it yet.
- F5's component-API handoff to the NOS session documents this enum-widening as the
  resolution of the boundary F1 originally left unresolved.

## 11. Conferences — read pages vs. the one purchase surface (NOS boundary, accepted)

Also negotiated 2026-09-08: `/national-show/symposium` and `/national-show/wosa-conference`
are CONTENT pages (theme, speakers, programme) — they carry a CTA through to
`/national-show/conferences`, the single PURCHASE surface. **F2 seeds one purchase concept
per conference product, never one per content page.** The existing
`CONFERENCE_PRODUCTS` shape in `lib/provisional-figures.ts` already matches this — three
purchase concepts (SAOC Symposium, WOSA Conference, SAOC/WOSA Joint), each an
early-bird/normal pair sold exclusively via `/national-show/conferences` — and F2 must not
add a fourth family or duplicate any of the three per content-page route. See A15 for the
mechanical guard (tightened 2026-09-08 to a runtime base-slug-identity check — see §13).

## 12. Dry-run polarity is a repo-wide problem, not one script (swept 2026-09-08)

The `fix-vip-and-weekend-pass-pricing.ts` finding in §2 generalises. A full sweep of
`scripts/` found **six** scripts sharing the identical unsafe pattern (`DRY_RUN =
process.argv.includes('--dry-run')`, i.e. default = mutate, `--dry-run` is the thing you
have to remember): `fix-venue-never-changed-copy.ts:77`, `migrate-ticket-type-category.ts:102`,
`migrate-show-sales-fields.ts:86`, `fix-vip-and-weekend-pass-pricing.ts:79`,
`fix-show-dates-2027.ts:80`, `fix-visitor-info-dates-confirmed.ts:76`. All six write against
the single shared `production` dataset. Three OTHER scripts already in the repo
(`seed-fictional-test-show`, `seed-demo-ticket-type`, `swap-active-show`) already use the
correct `--apply`-gated polarity `migrate-f2-ticket-taxonomy.ts` follows — the safe pattern
existed in-repo the whole time and was simply not applied consistently to every script.

**Not fixed by this mission.** Recorded as ONE open decision for Brad
(`docs/ticketing-complete-f2-open-decisions.md`), not an overnight patch — several of the
six may already have been run against live data, so flipping their default behaviour
unreviewed carries its own risk independent of the polarity question itself.

## 13. A7/A11/A15 tightened after F1's QA mutation-testing pattern (2026-09-08)

Same defect class QA broke on F1's A1/A4/A8: a check that is syntactically satisfiable by
something that isn't the real property. Three were caught before @dev implementation, not
after, by applying F1's own mutation-testing discipline to F2's draft assertions up front:

- **A7** (Sunset Cocktails/Field Trip prices): the original was a whole-file digit grep —
  `"800"` matches `capacity: 800` on the unrelated Day Visitor admission product, so a wrong
  Sunset Cocktails price would still pass. Now a real runtime read of
  `WORKSHOP_FIELD_TRIP_PRODUCTS`, keyed by slug, checking `.price` and a truthy
  `sourceCitation` on the specific product.
- **A11** (`data-placeholder` on `TicketTypeCard`): a string grep cannot prove DOM
  attachment — it passes on a comment, a prop name, or an unreachable branch just as
  readily as a real render. F2 has no jsdom/browser harness in scope to prove this
  properly, so A11 is downgraded to `required: false` (non-authoritative smoke check only)
  and explicitly defers the real proof to F7's A10, a genuine browser check. **F2 is not
  DONE on this property until F7's A10 is green** — this is a cross-feature dependency, not
  a gap either feature owns alone.
- **A15** (conference-family guard): the original counted distinct product NAME prefixes
  via a hand-maintained grep alternation — a new product sharing a prefix (e.g. "WOSA
  Conference Extra Track") would never trip it, because the alternation list itself would
  need to be edited to ever fail. It also conflated "two base products legitimately have an
  `-early-bird` variant SKU" (true — `CONFERENCE_PRODUCTS` predates F1's computed
  early-bird model) with "a new base identity slipped in." Now a runtime read of
  `CONFERENCE_PRODUCTS` that strips any `-early-bird` slug suffix to recover base identity,
  asserts that identity set is exactly `{saoc-symposium, wosa-conference, saoc-wosa-joint}`,
  and separately asserts the raw array length is exactly 6. Verified in
  `.tmp/sandbox/qa-mutation/`: the old grep-based check silently PASSED against an injected
  "WOSA Conference Extra Track" mutant; the new runtime check correctly failed it.

## 14. Stale check ruling: `check-workshop-products.mjs` (2026-09-08)

`contracts/checks/ticketing-workshops-f2/check-workshop-products.mjs` belongs to an earlier,
separate, already-closed mission (`ticketing-conferences-and-events`, its own F2) — not this
mission's F2. F2 (this mission)'s data changes make three of its assertions **correctly**
fail, and expose one genuine **pre-existing** defect unrelated to this mission. Ruling for
whoever next touches this file:

**Correct-consequence failures (update the check to the new reality — never revert this
mission's data to make the old check pass again):**

1. `REQUIRED_SLUGS` still lists `field-trip-single` and `field-trip-all-outings` — this
   mission retired both (`RETIRED_FIELD_TRIP_SLUGS` in `lib/provisional-figures.ts`,
   `active: false` via the migration script, never deleted) in favour of one `field-trip`
   product. Update `REQUIRED_SLUGS` to `['sunset-cocktails-single', 'sunset-cocktails-couple',
   'field-trip']`.
2. The `WORKSHOP_FIELD_TRIP_PRODUCTS.length === 4` expectation is now wrong — the real,
   correct count is 3. Update the literal.
3. The field-trip bundle-relationship check (lines ~87-102, "all-outings is a real bundle
   relative to single") is now permanently vacuous — `field-trip-single`/`field-trip-all-outings`
   no longer exist, so `bySlug[...]` for both is `undefined` and the guarding
   `if (fieldTripSingle && fieldTripAll)` silently no-ops rather than failing. There is only
   one field-trip product now, so there is no "bundle vs. single" relationship left to check.
   **Delete this block outright** rather than leaving a permanently-skipped check in the file
   (a check that can never run is worse than no check — it looks like coverage and isn't).

**Genuine pre-existing defect, NOT caused by this mission (fix separately, do not fold into
an F2 story):** the "oversell invariant" check at lines ~125-138 sums
`cocktailSingle.capacity * 1 + cocktailCouple.capacity * COUPLE_OCCUPANCY_PER_UNIT` and
asserts the sum stays under 200 — a real venue ceiling. That math assumed a world with
**no real pooling at checkout**, where each slug's `capacity` field was its own independent,
unweighted ceiling, and the check's job was to size the two ceilings conservatively so their
worst-case *sum* couldn't jointly oversell the room (see the check's own lines 104-124 for
that stated premise). That premise is now **false**: `planPooledCapacity()` in
`lib/checkout-reservation.ts` (shipped by the later `ticketing-conferences-and-events` M2/F5,
confirmed via `git show HEAD:lib/provisional-figures.ts`) already enforces real,
weighted, pooled capacity at checkout time via each product's `capacityPool` +
`headcountPerUnit` fields. Under the current data (confirmed by reading
`lib/provisional-figures.ts` directly), `sunset-cocktails-single` and
`sunset-cocktails-couple` both carry `capacity: 200` and `capacityPool: 'sunset-cocktails'`
— i.e. **the same shared pool ceiling value**, not two independent per-slug budgets. Summing
them as the old check does (200 + 200×2 = 600) double-counts one physical pool as if it were
two, and will fail forever regardless of any F2 change — it was never really about F2's data.
The check's foundational premise needs literal rewriting, not a number tweak: assert
`cocktailSingle.capacityPool === cocktailCouple.capacityPool` (they share one pool) and that
pool's declared capacity number (`cocktailSingle.capacity`, `cocktailCouple.capacity` — both
should read the same value) equals the real venue ceiling (200), rather than summing two
fields that were never meant to be added together once pooling shipped. File this as its own
backlog item — it is a real, currently-latent false-positive-shaped defect (it happens to
still numerically read as a "failure" post-F2, for the wrong reason) that predates and is
independent of this mission, and repairing it is implementation work for `@dev`, not an
architect edit.

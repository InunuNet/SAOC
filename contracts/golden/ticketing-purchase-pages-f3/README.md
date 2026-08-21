# Decision Record: F3 (ticketing-conferences-and-events, M2) — purchase pages for Conferences and Workshops & Field Trips

## The gap, confirmed

F1 and F2 (done, commits `9b48493` and `2937c50`) built the ticketType DATA MODEL only —
`CONFERENCE_PRODUCTS` (6) and `WORKSHOP_FIELD_TRIP_PRODUCTS` (4) in
`lib/provisional-figures.ts`, seeded as Sanity `ticketType` documents by
`scripts/seed-ticketing.ts`. Neither built a route or a category-aware query. Confirmed by
reading the code (not assumed):

- `sanity/queries.ts:119` `activeTicketTypesQuery` selects every active `ticketType` document
  for the active show with **no category filter**.
- `sanity/schemas/documents/ticketType.ts` has **no category-discriminating field**.
- `app/(marketing)/tickets/page.tsx` is the only real ticket-purchase-adjacent page besides the
  exhibitor/vendor forms — it renders `activeTicketTypesQuery`'s result directly.
- Both F1's and F2's own docs (`docs/f1-ticketing-conferences.md`, `docs/
  f2-ticketing-workshops-field-trips.md`) explicitly say the provisional badge "will render for
  all of them on the `/tickets` page" — i.e. the mixing was known and deferred, not accidental.

Net effect: as of F2 landing, `/tickets` shows all 15 products (5 admission + 6 conference + 4
workshop/field-trip) mixed into one undifferentiated list. This is a real, live presentation
bug this feature closes, not just a missing-feature gap.

## Is checkout blocked on F5? No — confirmed by reading the code

`app/api/tickets/checkout/route.ts` and `lib/checkout-reservation.ts` were read in full.
Checkout is entirely `ticketType`-slug-driven:

- The request body's `lineItems[].ticketType` is a bare slug string
  (`CheckoutLineItemInput.ticketType: string`).
- Server-side, each distinct slug is looked up fresh via `ticketTypeBySlugQuery` — no
  allowlist, no category branch, no hardcoded slug set anywhere in the route.
- Capacity, price, early-bird window, show-matching, day-selection, and attendee-name
  validation are all driven by fields already on every `ticketType` document
  (`capacity`, `price`, `earlyBirdCutoff`, `show`, `requiresDaySelection`,
  `requiresAttendeeNames`) — every one of which the six Conference and four Workshop/Field-Trip
  products already carry, set by F1/F2.
- Firestore's own `TicketType` (`types/index.ts:137`) is `type TicketType = string` — the bare
  slug, nothing category-shaped.

**Conclusion: checkout requires zero changes for this feature.** The moment a route/query
exists to reach these products, they sell end-to-end through the exact same pipeline admission
products already use, including the existing reservation-transaction, idempotency, and
capacity-enforcement guarantees. F5 remains scoped to its own real, separate work: the
capacity-pooling fix for the couple-ticket/shared-pool oversell risk noted in F2's closeout
(`contracts/golden/ticketing-workshops-f2/README.md` "Capacity revision") — a defect in
*existing* per-slug-only capacity math, unrelated to whether these categories have routes.

## Design decisions

### 1. New `category` field on `ticketType`, not a bespoke per-category schema

Rejected: a separate Sanity document type per category (`conferenceTicket`,
`workshopTicket`, ...). F1/F2 both explicitly confirmed "reuse the schema, don't invent a
bespoke data model" for the exact same reason — one query surface, one checkout code path, one
seed/migration mechanism. A `category` field is the minimal addition that lets a query
discriminate without touching anything else.

Values: `admission` / `conference` / `workshop-field-trip` — three, not more (Sunset Cocktails
and Field Trip both fold under "workshop-field-trip" per the mission's own category grouping
and F2's naming decision). No `initialValue` default, matching the existing `show` field's
precedent (required, no default) — a silent wrong-category default is worse than a Studio
validation error forcing a conscious choice on every future product.

### 2. Category assigned in `lib/provisional-figures.ts`, not re-derived elsewhere

Every product literal across `ADMISSION_PRODUCTS`/`CONFERENCE_PRODUCTS`/
`WORKSHOP_FIELD_TRIP_PRODUCTS` gets an explicit `category` property. This keeps the existing
single-source-of-truth discipline (`ProvisionalAdmissionProduct`) intact — the seed script's
existing spread (`...product`) picks it up automatically, and the migration script (below)
reads the exact same arrays rather than hand-typing a second slug→category table that could
drift from the first.

### 3. One new parameterized query, not a rewrite of the existing one

`activeTicketTypesByCategoryQuery($category)` is added alongside the untouched
`activeTicketTypesQuery` — additive, matching this file's established pattern (every other
query addition in `sanity/queries.ts` is commented "additive," e.g. `provisional`,
`requiresDaySelection`). Nothing else in the codebase references `activeTicketTypesQuery`
besides `/tickets/page.tsx`, so it could have been modified in place, but adding a new
query keeps `/tickets`'s migration to the category-aware version an explicit, visible diff
line rather than an implicit behavior change to a query whose name doesn't mention category.

### 4. Two new static sibling routes, not a dynamic `[category]` route

Considered: `/national-show/tickets/[category]`, matching REST-ish conventions.
Rejected — every existing ticket-purchase-adjacent route in this codebase is a static named
segment (`/tickets`, `/national-show/exhibitors`, `/national-show/vendors/register`), and
`nav-config.ts`'s Tickets column links (`/tickets`, `/national-show/exhibitors`, `/national-show/
vendors/register`) are all direct hrefs, not parameterized. A dynamic route would need its own
category-string validation (reject an unknown `[category]` segment) for no benefit over two
plain routes, and F4 (nav)'s brief explicitly asks for "direct links, matching the existing
Visitor/Exhibitor/Vendor pattern" — two static routes is that pattern.

Chosen: `/national-show/conferences` and `/national-show/workshops`. ("Workshops" as the URL
segment, "Workshops & Field Trips" as the visible heading — the naming rule from
`ticketing-nav-restructure` F2 and this mission's F2 constrains visible copy, not URL slugs.)

### 5. Shared extracted page component, not three copies of `/tickets/page.tsx`'s body

`/tickets/page.tsx` today is a ~130-line async Server Component doing: fetch page copy + sales
state + ticket types + show window, compute sold-out state, render `PageHero` +
`TicketPurchaseForm`/`SalesClosedNotice`. Copy-pasting that three times would triplicate real
logic (the `force-dynamic` / live-inventory reasoning documented at the top of that file,
the F9 demo-ticket-type filter, the F5 show-window computation) — any future fix to one copy
would silently not apply to the other two, exactly the kind of drift this codebase's
`README.md`/commit history shows it has been burned by before (secret/content corruption from
un-synced duplicated logic).

Chosen: extract the shared body into one component (e.g.
`components/tickets/CategoryTicketsPage.tsx`), parameterized by `category` plus per-page copy
(heading, intro, hero image, eyebrow, metadata title). All three route files become thin
(~15-25 line) wrappers that supply their own copy and category. `/tickets/page.tsx`'s
externally-visible behavior for admission products must remain byte-identical to today (same
fallbacks, same `force-dynamic`, same demo-ticket filtering, same day-selection wiring) — this
is a structural extraction, not a rewrite of what admission buyers see.

### 6. Reuse the existing `ticketsPage` Sanity singleton for generic microcopy only

`buyButtonLabel`, `soldOutMessage`, `salesClosedMessage`, `termsNote`, and the
confirmation/cancelled strings are generic UI copy, not admission-specific — reused as-is by
all three pages via the shared component. `title`/`intro` (page heading/lede) are NOT pulled
from this singleton for the two new pages (it would show "Get Your Tickets" wrongly) — they are
hardcoded per page, same posture as this project's existing convention of not inventing new CMS
documents for copy nobody has supplied yet. No new Sanity singleton per category.

### 7. `/national-show/tickets` chooser page also gets two more cards

This page already exists, already implements exactly the "Visitor/Exhibitor/Vendor" three-card
pattern F3's brief pointed at, and is the `headingHref` target for the mega-menu's "Tickets"
column heading. Once this feature ships live routes for Conferences and Workshops & Field
Trips, leaving this page's `OPTIONS` array untouched would mean a visitor who clicks the
"Tickets" heading itself — not a submenu link — still sees only three of the five real options.
Two-line addition to an existing data array; included in this feature's scope rather than left
for F4 (nav), since F4's brief is specifically about the mega-menu column, not this page.

### 8. Migration script for the pre-existing documents

`scripts/migrate-ticket-type-category.ts`, following `scripts/migrate-show-sales-fields.ts`'s
established pattern exactly: `setIfMissing` (never destructive), `--dry-run` support, reads
`.env.local` directly, keyed off `lib/provisional-figures.ts`'s three arrays (the same ones A1
of the contract verifies) rather than a second hand-typed slug→category list that could drift.

**Correction (defect-repair pass, 2026-08-21):** the original header comment said "the 15
pre-existing Sanity ticketType documents" — inaccurate. The real live dataset has 10
`ticketType` documents total, and only 5 of those are covered by this feature's
`ADMISSION_PRODUCTS`/`CONFERENCE_PRODUCTS`/`WORKSHOP_FIELD_TRIP_PRODUCTS` (the other 5 are
legacy/inactive — `adult`/`child`/`exhibitor`/`pensioner`/`saoc-member` — not present in
`lib/provisional-figures.ts` at all; harmless here since they're inactive and excluded by
`active == true` in every query). The 6 conference + 4 workshop products have not been seeded
into the live dataset yet — that's `scripts/seed-ticketing.ts`'s job, out of scope for this
feature. See "Defect repair: null-category read-time fallback" below for the resulting fix to
this script (it must skip document IDs that don't exist yet instead of throwing).

## What F4 (nav) still owns

Adding `{ id: 'conferences', ... }` / `{ id: 'workshops', ... }` to `nav-config.ts`'s Tickets
`links[]` array — unblocked the moment this feature's routes exist. `contract-f3.yaml` (the
guard-rail contract from the prior architect pass, now describing F4) documents exactly what
must flip green.

## Defect repair: null-category read-time fallback (2026-08-21, @qa-apex)

@qa-apex started a real dev server against the live `production` Sanity dataset (not a
hypothetical) and read the actual RSC payload: `"ticketTypes":[]` on `/tickets` — the
currently-live, real-selling admission page — with the first implementation's code. Root cause:
every one of the 10 ticketType documents in the live dataset has `category: null` today (item 8
above's migration script has only ever run `--dry-run`), and the original
`activeTicketTypesByCategoryQuery` filtered strictly `category == $category`. `null ==
"admission"` is false in GROQ, so shipping the first implementation as-is would have taken the
live admission-ticket page to zero products the instant it deployed.

### Fix chosen, and why

Two options were weighed:

- **(a) Require the migration be run for real as a sequenced pre-deploy step**, gated by a
  contract assertion against the live dataset's actual `category` values. Rejected: this
  project's own incident history is specifically about secret/deploy-ordering fragility causing
  real production outages (see `secret_corruption_incidents.md` and
  `project_contract_checks_mutate_live_content.md` in project memory — a prior contract check
  that queried live content left corrupted sentinel data on the deployed site for three days
  because residue alerts went to a log nobody read). Making `/tickets` staying non-empty depend
  on a manual step happening in the right order, checked only if someone remembers to run a
  live-data-querying gate, is exactly that failure shape again.
- **(b) Read-time, admission-only null-category fallback in the query** — chosen. Deploy-order
  independent: the page is correct on day one regardless of whether the migration has run, and
  the fallback becomes moot (not wrong) the moment it eventually does.

`activeTicketTypesByCategoryQuery`'s filter becomes:

```groq
category == $category || (!defined(category) && $category == "admission")
```

**Why admission-only, not category-agnostic:** a fallback that treated null as "whatever
category the visitor requested" would risk permanently masking a real future bug — a
conference/workshop product accidentally left uncategorized would silently show up wherever it
was queried, forever, with nothing surfacing the mistake. Scoping the fallback to `"admission"`
avoids this: it fixes the one category with a real live null-category defect today, and a
null-category conference/workshop product stays simply invisible everywhere (the current,
pre-existing behavior — not a new regression the fallback introduces).

### Two safety valves, so the fallback never becomes a silent permanent state

1. **`lib/tickets-category-warning.ts`'s `warnMissingCategoryFallback`**, called by
   `CategoryTicketsPage.tsx` on every fetch — logs a `console.warn` naming the affected slug
   whenever an admission-page product is relying on the fallback. Admission-only, matching the
   query's own scope (no warning fires for conference/workshop requests — the fallback doesn't
   apply there, so there's nothing to warn about).
2. **The Sanity schema field stays required, no `initialValue`** (unchanged from the original
   design, item 1's decision) — the fallback is a read-side shim for documents that already
   exist with a null value; it does not relax the write-side taxonomy. Every future document
   created or edited in Studio still forces a conscious category choice.

### Mechanical proof (real execution, not source text)

`contracts/checks/ticketing-purchase-pages-f3/check-category-query-null-fallback.mjs` uses
`groq-js` (added as a pinned devDependency, `groq-js@1.30.2` — a real GROQ parser/evaluator) to
execute the actual query text extracted from `sanity/queries.ts` against a synthetic dataset
covering every category state a live document can be in (explicit value, `null`, field absent,
inactive). It proves the fallback fires for `admission`, does not leak into `conference`/
`workshop-field-trip`, and inactive documents are still excluded. Run against the pre-repair
query it fails, reproducing the exact defect QA found against production.

`contracts/checks/ticketing-purchase-pages-f3/check-category-warning.mjs` imports and calls the
real `warnMissingCategoryFallback` export, observing its actual `console.warn` calls.

## What F5 (checkout) still owns

The capacity-pooling fix for `sunset-cocktails-couple` (2 heads/slug) and the
`field-trip-single`/`field-trip-all-outings` shared pool — unrelated to this feature, confirmed
above that checkout needs no category-awareness at all.

## Defect repair 2: seed script never wrote `category` onto created docs (2026-08-21, Codex GPT-5.5, second pass)

Found by the mandatory Codex cross-model review's SECOND pass, after the null-category query
defect above was already fixed and re-verified live by QA. Different bug, same feature:
`scripts/seed-ticketing.ts:126`'s `client.createIfNotExists({...})` object literal spreads every
other product field (`name`, `price`, `description`, `capacity`, `provisional`,
`earlyBirdCutoff`, `releasedQuantity`, `requiresDaySelection`, `requiresAttendeeNames`) but never
writes `category: product.category`, even though every product literal in
`lib/provisional-figures.ts` has carried an explicit `category` field since item 1's design
above. This is almost certainly because `category` was added to `ProvisionalAdmissionProduct`
(and to every product literal) as part of *this* feature, after `seed-ticketing.ts`'s
document-creation object literal had already been written and was not revisited.

**Why this matters and is not just cosmetic:** `activeTicketTypesByCategoryQuery`'s null-category
fallback (see "Defect repair" above) is deliberately scoped to `admission` only — a conference or
workshop-field-trip product with no `category` is, by design, simply invisible everywhere, with
no fallback to catch it (see "Why the fallback is admission-only, not category-agnostic"). Every
FUTURE run of `seed-ticketing.ts` against a dataset that doesn't yet have the conference/
workshop-field-trip documents (e.g. a fresh dataset, or the live `production` dataset once
someone finally runs it for real, per item 8's still-open TODO) would create those 10 documents
with no `category` at all — a permanent gap in the seed path itself, not the one-time
migration-timing gap the first defect repair addressed.

### Fix

Add `category: product.category` to the created-doc object literal.

### Fix, part 2: doc-building logic made testable, and a second, independent safety bug caught along the way

Writing this repair's negative-verification check required importing `scripts/seed-ticketing.ts`
to exercise its real doc-building logic in isolation (this project's standing rule: assertions
must observe the real mechanism, not source text). Doing so surfaced a second, unrelated defect:
the script calls `main().catch(...)` unconditionally at module scope, with no guard for "was this
executed directly, or merely imported." The very first attempt to import the module for testing
printed `Seeding ticketing content in Sanity dataset "production"` and proceeded to actually
re-run the live seed/patch against the real `production` Sanity dataset — confirmed by watching
it happen. `createIfNotExists` and `.patch().setIfMissing()`/`.set({ active: false })` are all
idempotent/non-destructive by the file's own header-documented design, so no data was corrupted
by this — but a test importing a module must never have live side effects at all, full stop; this
is exactly the defect class already flagged in project memory
(`project_contract_checks_mutate_live_content.md`, "sentinel corruption sat on the deployed site
3 days"). This project does not get to rely on "it happened to be harmless this time."

**Combined fix, both parts required together:**

1. Extract the document-creation logic into a pure, exported function:
   `buildTicketTypeDoc(product: ProvisionalAdmissionProduct, index: number, showId: string):
   Record<string, unknown>` — no `.env.local` read, no Sanity client, no network access, just the
   object literal (now including `category: product.category`). `seedTicketTypes()` calls it and
   passes the result to `client.createIfNotExists(...)`.
2. Guard `main()` behind a direct-execution check (e.g. `if (import.meta.url ===
   \`file://${process.argv[1]}\`) { main().catch(...); }`) so importing the module — for this
   check, or for any future test — never triggers `readEnvLocal()`, `createClient()`, or `main()`
   as a side effect of import.

### Mechanical proof (real execution, not source text)

`contracts/checks/ticketing-purchase-pages-f3/check-seed-category-field.mjs` imports the real
`buildTicketTypeDoc` export and calls it against all 15 real product objects from
`lib/provisional-figures.ts`, asserting the returned doc's `category` exactly matches
`product.category` for every one, and that the doc otherwise looks like the real seed doc (same
`_id` convention) so a stub couldn't trivially pass. Run against the pre-repair script it fails
with "does not export a `buildTicketTypeDoc` function" — and running it also live-confirmed the
unguarded-`main()` hazard, since the pre-repair script printed real Sanity-seeding output to the
console purely from being imported.

## Still open: the live migration has still never been run for real

Unrelated to either defect repair above, restated for visibility: item 8's migration script
(`scripts/migrate-ticket-type-category.ts`) and `scripts/seed-ticketing.ts` itself have, per the
"Defect repair" section, only ever been run with `--dry-run` / not run at all against the real
`production` dataset for the conference/workshop-field-trip documents. This repair fixes the code
paths so that whenever someone does run them for real, the resulting documents (both freshly
seeded and migrated) will carry the correct `category`. Actually running them against production
remains a manual operational step outside this contract's scope, same posture as documented
above under "Fix chosen, and why."

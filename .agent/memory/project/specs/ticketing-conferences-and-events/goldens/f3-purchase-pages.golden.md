# Golden: F3 — Conferences and Workshops & Field Trips purchase pages

## What must be true when this feature is done

1. **Every one of the 15 existing `ticketType` products carries a `category`** —
   `admission` (5), `conference` (6), `workshop-field-trip` (4) — set on the literal product
   objects in `lib/provisional-figures.ts`, not invented in a second list. No 4th category
   value exists anywhere.

2. **Sanity schema enforces the same three-value taxonomy** — `sanity/schemas/documents/
   ticketType.ts` gets a `category` field (string, options list of exactly `admission` /
   `conference` / `workshop-field-trip`), matching the `show` field's precedent: required for
   new documents, no default `initialValue` (a silent wrong-category default is worse than a
   Studio validation error forcing a conscious choice).

3. **A category-parameterized query** — `activeTicketTypesByCategoryQuery` in
   `sanity/queries.ts`, `$category`-parameterized, same shape/fields as the existing
   `activeTicketTypesQuery` plus `category`. The existing `activeTicketTypesQuery` is left
   alone (additive change, not a rewrite) in case anything else references it. **Defect
   repair:** the filter is `category == $category || (!defined(category) && $category ==
   "admission")` — a null/missing `category` field is treated as `"admission"` ONLY when the
   caller requested `"admission"`. See "Defect repair" section below for why.

4. **Three routes, one shared component:**
   - `/tickets` (existing) — now queries `category: 'admission'` only. This is the fix for the
     live bug: today, with F1/F2's 10 products already seeded and no category filter, all 15
     products render mixed on this page.
   - `/national-show/conferences` (new) — `category: 'conference'`.
   - `/national-show/workshops` (new) — `category: 'workshop-field-trip'`, page heading
     "Workshops & Field Trips" (never bare "Workshops" or "Events" — see
     `contracts/golden/ticketing-nav-f3/README.md` and F2's own naming rule).
   - All three render through one shared, extracted page component (parameterized by
     category + heading/intro/hero copy) rather than ~130 lines duplicated three times. The
     shared component fetches the generic microcopy (`buyButtonLabel`, `soldOutMessage`,
     `salesClosedMessage`, `termsNote`, confirmation/cancelled strings) from the SAME existing
     `ticketsPage` Sanity singleton `/tickets` already uses — these are generic UI strings,
     not admission-specific, so reusing them is not a scope violation. `title`/`intro`/hero
     image/eyebrow are hardcoded per page (no new Sanity singleton per category — Lee-Ann has
     not supplied copy for these, and inventing three new CMS documents for un-provided marketing
     copy is out of scope).

5. **The existing `/national-show/tickets` chooser page** (its `OPTIONS` card grid) gains two
   more cards — Conferences, Workshops & Field Trips — linking to the two new routes. This page
   already exists and already follows the exact "Visitor/Exhibitor/Vendor" card pattern F3's
   brief described; leaving it out would mean a visitor landing on "what are you here for?"
   still can't find the two categories this feature makes purchasable.

6. **A backfill migration script**, `scripts/migrate-ticket-type-category.ts`, following
   `scripts/migrate-show-sales-fields.ts`'s exact established pattern — `setIfMissing`
   (never `.set()`/`.patch().set()`, never destructive), `--dry-run` support, keyed off the
   same `lib/provisional-figures.ts` arrays item (1) verifies, not a second hand-typed
   slug→category table. Patches whichever of the 15 canonical documents already exist in the
   target dataset — see "Defect repair" section below: the live dataset today has only 5 of
   the 15 (the admission ones), and the script must SKIP the other 10 rather than crash.

7. **Checkout is untouched.** No `category` reference anywhere in
   `app/api/tickets/checkout/route.ts` or `lib/checkout-reservation.ts`. Confirmed by reading
   both files: checkout is entirely `ticketType`-slug-driven (`ticketTypeBySlugQuery` looks up
   by slug; Firestore's `TicketType` is `type TicketType = string`, the bare slug; no
   category-aware branch exists or is needed anywhere in the reservation/capacity/early-bird
   logic). The six Conference and four Workshop/Field-Trip products already sell end-to-end
   through the existing pipeline the moment a route exists to reach them — this feature does
   not need to, and must not, touch checkout code.

## Defect repair (2026-08-21, found live by @qa-apex)

QA started a real dev server against the live `production` Sanity dataset and inspected the
actual RSC payload: `"ticketTypes":[]` on `/tickets` with the first implementation's code. Root
cause — every one of the 10 ticketType documents that exist in the live dataset today has
`category: null` (the backfill migration in item 6 has only ever been run with `--dry-run`,
never for real), and the original query filtered strictly `category == $category`; `null ==
"admission"` is false in GROQ.

**Fix chosen: read-time, admission-only null-category fallback in the query itself (not a
deploy-ordering requirement).** Rejected alternative: require the migration to be run for real
as a sequenced pre-deploy step, gated by a contract assertion against the live dataset. This
project's own incident history (`secret_corruption_incidents.md` and related memory) is
specifically about deploy-ordering and manual-step fragility causing real outages — making
`/tickets` staying non-empty depend on someone remembering to run a script in the right order,
with no automatic enforcement possible without querying live production from the contract gate
(itself independently flagged risky by `project_contract_checks_mutate_live_content.md`), is
exactly that failure shape again. A query that degrades gracefully regardless of migration
timing is strictly more robust, and becomes moot — not wrong — once the migration eventually
runs for real.

**Why the fallback is admission-only, not category-agnostic:** a category-agnostic fallback
(treat null as "whatever category the visitor happens to be browsing") would risk permanently
masking a real future bug — e.g. someone creates a new conference-category product in Studio,
forgets to set `category` before the required-field validation catches it in some edit path,
and it silently starts appearing on `/tickets` as an admission product forever, with nothing
ever surfacing the mistake. Scoping the fallback to `"admission"` only means: (a) it fixes the
one category that actually has a real live null-category defect today (the 5 seeded admission
products), (b) a null-category conference/workshop product is simply invisible everywhere,
which is a pre-existing, not a regression — never silently mislabeled as something else.

**Two safety valves pair with the fallback**, so it never becomes a silent permanent state:
- `lib/tickets-category-warning.ts`'s `warnMissingCategoryFallback`, called by
  `CategoryTicketsPage.tsx` on every fetch, logs a `console.warn` naming the affected slug
  whenever an admission-page product is relying on the fallback — an operator watching server
  logs (or a future log-based alert) sees this, it does not vanish silently.
- The Sanity schema field itself (item 2) stays required with no `initialValue` — the fallback
  is a read-side shim for already-existing documents, not a relaxation of the write-side
  taxonomy. Every future document created in Studio still forces a conscious category choice.

**Migration script correction (also part of this repair):** the script's own header comment
claimed "15 pre-existing documents," but the real live dataset has only 10 ticketType documents
total, and only 5 of those are the ones this feature's `ADMISSION_PRODUCTS`/
`CONFERENCE_PRODUCTS`/`WORKSHOP_FIELD_TRIP_PRODUCTS` cover (the other 5 are legacy/inactive —
`adult`/`child`/`exhibitor`/`pensioner`/`saoc-member` — not tracked in `lib/provisional-
figures.ts` at all, and irrelevant here since they're inactive and never match `active == true`
in any query). The 6 conference + 4 workshop products have not been seeded into the live
dataset yet — that is `scripts/seed-ticketing.ts`'s job, separate from this feature. The
original migration script's `.patch(docId).setIfMissing(...)` would **throw** on every one of
those 10 not-yet-existing document IDs (Sanity's patch API errors on a nonexistent target). The
script must first fetch which of the 15 canonical document IDs actually exist
(`existingIds`), then SKIP — log, don't throw — any that don't. Once `seed-ticketing.ts`
eventually seeds the conference/workshop documents, they'll already carry `category` at seed
time via the `lib/provisional-figures.ts` spread, making this migration's work for those 10 a
no-op by the time it matters.

## What this feature explicitly does NOT do

- Does not fix F5's deferred capacity-pooling defect (the couple-ticket/shared-pool oversell
  risk documented in `contracts/golden/ticketing-workshops-f2/README.md` "Capacity revision").
  That stays F5's to resolve.
- Does not add per-workshop-session ticketType documents — `WORKSHOP_PRICING_STRUCTURE` remains
  deliberately non-sellable (F2's decision); the `/national-show/workshops` page shows the four
  real Workshop-category products (Sunset Cocktails, Field Trip) that ARE sellable, plus, at
  minimum, an honest note that individual workshop sessions are not yet available for purchase.
- Does not invent new Sanity singleton documents for Conferences/Workshops page marketing copy.
- Does not restructure `Header.tsx`/`MegaMenu.tsx`/`MobileMenu.tsx` — F4 (nav) still owns adding
  the two `links[]` entries to `nav-config.ts`'s Tickets column now that these routes exist.

## Negative verification already performed

- `contracts/checks/ticketing-purchase-pages-f3/check-category-assignment.mjs`, run against the
  pre-implementation repo state, fails with 15 "expected category X, got undefined" findings —
  confirming it observes the real mechanism (the exported product objects), not source text,
  and that it correctly fails before this feature lands.
- `contracts/checks/ticketing-purchase-pages-f3/check-category-query-null-fallback.mjs`
  EXECUTES the real GROQ query text via `groq-js` (a real parser/evaluator, added as a pinned
  devDependency — `groq-js@1.30.2`) against a synthetic dataset. Run against the pre-repair
  query (`category == $category`, no fallback clause) it fails, reproducing the exact live
  defect: `admission fallback: expected [...vip, legacy-null-category,
  category-field-never-set], got [vip]`. Run against the repaired query (verified by the
  architect against a scratch copy, not committed) it passes, and does not leak the fallback
  into `conference`/`workshop-field-trip` results.
- `contracts/checks/ticketing-purchase-pages-f3/check-category-warning.mjs` imports and calls
  the real `warnMissingCategoryFallback` export. Run today (function does not exist yet) it
  fails with `ERR_MODULE_NOT_FOUND`. Run against a scratch implementation of the function
  (architect-verified, not committed) it passes: exactly one warning per null/missing-category
  admission product, naming the slug, and silence for fully-categorized products and for
  non-admission category requests.

## Defect repair 2 (2026-08-21, found by Codex GPT-5.5 cross-model review, second pass)

Found AFTER the null-category defect above was already fixed and QA re-verified it live —
Codex's second pass (mandatory, independent of Claude's own @qa) caught a different, permanent
gap in the same feature.

8. **`scripts/seed-ticketing.ts` writes `category` onto every document it creates.** Every
   product literal in `lib/provisional-figures.ts` already carries the field (item 1 above), but
   the seed script's `client.createIfNotExists({...})` object literal never copied it onto the
   created Sanity doc — `category: product.category` was simply missing. Because
   `activeTicketTypesByCategoryQuery`'s null-category fallback is deliberately admission-only
   (see "Defect repair" above, "Why the fallback is admission-only"), any freshly-seeded
   conference/workshop-field-trip product would be created with no `category` at all and be
   genuinely, permanently invisible on `/national-show/conferences` and `/national-show/
   workshops` — those pages have no fallback to catch it. Fix: add `category: product.category`
   to the doc-building logic.

9. **The doc-building logic is a pure, exported `buildTicketTypeDoc(product, index, showId)`
   function**, and `main()` only runs when the script is executed directly, never merely on
   import. Required both for testability (item 8's check must import the real doc-building
   logic in isolation) and as an independent safety fix: the pre-repair script called `main()`
   unconditionally at module scope, so importing it for a test re-ran the full live seed against
   the real `production` Sanity dataset. Confirmed live while writing this repair's negative
   verification — the pre-repair check run printed `Seeding ticketing content in Sanity dataset
   "production"` before failing. `createIfNotExists`/`setIfMissing` are idempotent so no data was
   corrupted, but a test importing a module must never trigger live side effects (see project
   memory `project_contract_checks_mutate_live_content.md` — this is exactly that defect class).

## Negative verification already performed (defect repair 2)

- `contracts/checks/ticketing-purchase-pages-f3/check-seed-category-field.mjs`, run against the
  pre-repair `scripts/seed-ticketing.ts`, fails with "does not export a `buildTicketTypeDoc`
  function." Running it also surfaced, live, that the unguarded `main()` call executes on mere
  import (printed real Sanity dataset-seeding output to the console) — confirming both defects
  are real and that this check observes the actual doc-building output, not source text.

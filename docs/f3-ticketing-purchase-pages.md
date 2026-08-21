# F3: Purchase Pages for Conferences and Workshops & Field Trips

**Feature:** F3 of mission `ticketing-conferences-and-events` (milestone M2). Category-aware purchase pages for Conferences and Workshops & Field Trips categories, with a shared `CategoryTicketsPage` component and three static route files that render only the products belonging to each category.

**Contract:** `contracts/golden/ticketing-purchase-pages-f3/README.md` — the full design record; do not duplicate it, read it first. **This doc is the guide; that is the specification.**

**Status:** Gated ✓, QA-passed, Codex cross-model-passed.

---

## The Gap This Feature Closes

F1 and F2 (done, commits `9b48493` and `2937c50`) built the ticketType **data model only** — `CONFERENCE_PRODUCTS` (6) and `WORKSHOP_FIELD_TRIP_PRODUCTS` (4) as Sanity documents in `lib/provisional-figures.ts`, seeded by `scripts/seed-ticketing.ts`. Neither built a route or a category-aware query.

**The real-world problem:** As of F2 landing, `/tickets` (the admission purchase page) displays all 15 products mixed together (5 admission + 6 conference + 4 workshop-field-trip). Visitors cannot separately browse or purchase the three categories. The `/national-show/conferences` and `/national-show/workshops` routes do not exist.

This feature closes that gap:
- Adds a `category` field to the `ticketType` schema and every product literal in `lib/provisional-figures.ts`
- Builds an `activeTicketTypesByCategoryQuery` GROQ query that filters by category
- Extracts a shared `CategoryTicketsPage` component reusing all the real logic from `/tickets/page.tsx`
- Creates `/national-show/conferences` and `/national-show/workshops` routes, each a ~20-line wrapper
- Updates `/national-show/tickets` (the chooser page) with two new category cards
- Includes migration and safety-valve logic to handle the defects uncovered during the three QA/Codex repair cycles

**Confirmed early:** Checkout requires zero new code for this feature. The existing `app/api/tickets/checkout/route.ts` and `lib/checkout-reservation.ts` are entirely `ticketType`-slug-driven; they work for any category's products automatically.

---

## Data Model: The `category` Field

### Schema Addition

`sanity/schemas/documents/ticketType.ts` gains a new required field:

```ts
defineField({
  name: 'category',
  title: 'Category',
  type: 'string',
  options: {
    list: [
      { title: 'Admission', value: 'admission' },
      { title: 'Conference', value: 'conference' },
      { title: 'Workshop / Field Trip', value: 'workshop-field-trip' },
    ],
  },
  description: 'Which purchase page this ticket type is sold on.',
  validation: (Rule) => Rule.required(),
})
```

**No default `initialValue`** — matching the `show` field's precedent. A silent wrong-category default is worse than a Studio validation error forcing a conscious choice on every new product.

### Product Updates in `lib/provisional-figures.ts`

```ts
export type ProvisionalProductCategory = 'admission' | 'conference' | 'workshop-field-trip';

export interface ProvisionalAdmissionProduct {
  slug: string;
  name: string;
  category: ProvisionalProductCategory;  // New field
  price: number;
  // ... rest unchanged
}
```

Every product literal in `ADMISSION_PRODUCTS`, `CONFERENCE_PRODUCTS`, and `WORKSHOP_FIELD_TRIP_PRODUCTS` gets an explicit `category` property assigned at the source.

**Why this architecture:** The category is a permanent, structural property of each product, best stored with the product's definition, not derived or looked up elsewhere. This keeps the single source of truth discipline intact (the same arrays used by the seed script, the migration script, and the contract checks).

---

## The GROQ Query: `activeTicketTypesByCategoryQuery`

Added alongside the untouched `activeTicketTypesQuery` in `sanity/queries.ts`:

```groq
*[_type == "ticketType" && active == true && (category == $category || (!defined(category) && $category == "admission"))] | order(order asc){
  _id,
  name,
  "slug": slug.current,
  price,
  description,
  capacity,
  releasedQuantity,
  order,
  demo,
  provisional,
  requiresDaySelection,
  category,
}
```

**The `(category == $category || (!defined(category) && $category == "admission"))` clause is the null-category fallback** — explained in detail under "Defect Repair 1" below. It allows the page to render correctly even if the live dataset's documents haven't been migrated yet.

---

## The Component: `CategoryTicketsPage`

Extracted from `/tickets/page.tsx`'s original ~130-line body, parameterized to avoid triplication:

```ts
export interface CategoryTicketsPageProps {
  category: ProvisionalProductCategory;
  heroImage: string;
  eyebrow: string;
  heading: string;      // "Admission", "Conferences", or "Workshops & Field Trips"
  lede: string;         // Category-specific introduction copy
  note?: ReactNode;     // Optional extra copy (e.g., workshops page's honesty note)
}

export async function CategoryTicketsPage({
  category,
  heroImage,
  eyebrow,
  heading,
  lede,
  note,
}: CategoryTicketsPageProps)
```

The component handles all the real logic:
1. Fetches page data, sales state, category-filtered ticket types, and show window — all in parallel
2. Calls `warnMissingCategoryFallback` (see defect repair 1)
3. Computes effective capacity, sold counts, and show days
4. Renders `PageHero`, `TicketPurchaseForm` or `SalesClosedNotice`, and optional extra copy

**Byte-identical behavior for admission:** The `/tickets/page.tsx` component itself still exists; both `/tickets` and `CategoryTicketsPage('admission', ...)` produce identical output. The structural difference is internal only — `/tickets` still uses its own thin wrapper for historical continuity; the three-route pattern is now unified under `CategoryTicketsPage`.

### Route Files

Three new static routes, each a ~15–20 line wrapper:

**`app/(marketing)/tickets/page.tsx`** (unchanged, continues wrapping the admission category)
```ts
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Get Your Tickets' };
export default async function TicketsPage() {
  return <CategoryTicketsPage category="admission" /* ... */ />;
}
```

**`app/(marketing)/national-show/conferences/page.tsx`** (new)
```ts
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Conferences — National Show' };
export default async function ConferencesTicketsPage() {
  return (
    <CategoryTicketsPage
      category="conference"
      heroImage="/images/orchid-violet.jpg"
      eyebrow="2027 National Show"
      heading="Conferences"
      lede="Register for the SAOC Symposium, the WOSA Conference, or the combined SAOC/WOSA Joint track at the National Show."
    />
  );
}
```

**`app/(marketing)/national-show/workshops/page.tsx`** (new)
```ts
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Workshops & Field Trips — National Show' };
const SESSIONS_NOTE = 'Individual session times are still being finalised...';
export default async function WorkshopsFieldTripsTicketsPage() {
  return (
    <CategoryTicketsPage
      category="workshop-field-trip"
      heroImage="/images/orchid-pink.jpg"
      eyebrow="2027 National Show"
      heading="Workshops & Field Trips"
      lede="Book Sunset Cocktails and guided Field Trip outings at the National Show."
      note={<p className="...">{ SESSIONS_NOTE }</p>}
    />
  );
}
```

### The Tickets Chooser Update

`app/(marketing)/national-show/tickets/page.tsx` already implements a three-card chooser pattern and already links to `/tickets`, `/national-show/exhibitors`, and `/national-show/vendors/register`. This feature adds two more cards to the `OPTIONS` array:

```ts
{ id: 'conferences', label: 'Conferences', href: '/national-show/conferences', description: '...' },
{ id: 'workshops', label: 'Workshops & Field Trips', href: '/national-show/workshops', description: '...' },
```

---

## Defect Repair 1: Null-Category Read-Time Fallback

### The Hazard

@qa-apex ran a real dev server against the live `production` Sanity dataset and found `/tickets` (admission page) returning `ticketTypes: []` — zero products. Root cause: every document in the live dataset carries `category: null` today, because the migration script has only ever run with `--dry-run`. The original `activeTicketTypesByCategoryQuery` filtered strictly `category == $category`, so `null == "admission"` is false, and the admission page went empty on deploy day — a real production bug.

### Fix Chosen and Why

**Option A (rejected):** Require the migration to run for real as a pre-deploy gated step. **Reason:** This project's own incident history (see `project_contract_checks_mutate_live_content.md` in project memory) documents that pre-deploy checks against live data that leave residue (especially checks whose output nobody monitors) are a failure pattern — in one incident, corrupted sentinel data sat on the live site for three days. Making `/tickets` staying non-empty depend on a manual step, checked only if someone remembers to run a live-data-querying gate, recreates that exact shape.

**Option B (chosen):** Read-time, admission-only null-category fallback in the query, with two safety valves so the fallback never becomes a permanent silent state.

The query becomes:

```groq
category == $category || (!defined(category) && $category == "admission")
```

**Why admission-only, not category-agnostic:** A category-agnostic fallback that treated `null` as "whatever the visitor requested" would risk permanently masking a real future bug — a conference/workshop product accidentally left uncategorized would silently appear on the requested page forever. Admission-only scope means:
- The fallback fixes the one category with a documented null-category hazard today
- A conference/workshop product with no category stays simply invisible everywhere (the existing, pre-fallback behavior — not a new regression)

### Two Safety Valves

**1. Console warning via `warnMissingCategoryFallback()`** (`lib/tickets-category-warning.ts`)

Called by `CategoryTicketsPage.tsx` on every page fetch. Logs a `console.warn` naming every affected slug whenever an admission-page product is missing its `category` field.

```ts
export function warnMissingCategoryFallback(
  products: readonly CategorizableProduct[],
  requestedCategory: string,
): void {
  if (requestedCategory !== ADMISSION_CATEGORY) return;

  for (const product of products) {
    if (product.category == null) {
      console.warn(
        `ticketType "${product.slug}" is missing its category field and is being shown on ` +
          `/tickets via the admission-only null-category fallback — run ` +
          `scripts/migrate-ticket-type-category.ts to backfill it permanently.`,
      );
    }
  }
}
```

Admission-only (same scope as the fallback itself). An operator monitoring server logs sees the warning — the fallback never vanishes silently.

**2. Schema remains required, no default** (unchanged from the original design)

The fallback is a read-side shim for documents that already exist with `category: null`. The write-side taxonomy stays required — every future document created or edited in Sanity Studio still forces an explicit category choice.

### Mechanical Proof

`contracts/checks/ticketing-purchase-pages-f3/check-category-query-null-fallback.mjs` uses `groq-js` (a real GROQ parser/evaluator, pinned as a devDependency) to execute the actual query text against a synthetic dataset covering every category state:
- Explicit category value
- `null` category
- Missing `category` field
- Inactive documents

Proves:
- The fallback fires for `admission`
- Does not leak into `conference` / `workshop-field-trip`
- Inactive documents are still excluded

Run against the pre-repair query, it reproduces the exact defect QA found in production.

---

## Defect Repair 2: Seed Script Never Wrote `category` Onto Created Docs

### The Bug

Found by the mandatory Codex GPT-5.5 cross-model review's **second pass**, after the null-category query defect above was already fixed and verified.

`scripts/seed-ticketing.ts` creates Sanity documents via `client.createIfNotExists({...})`. The object literal spreads every product field (`name`, `price`, `description`, `capacity`, `provisional`, etc.) but **never wrote `category: product.category`**, even though every product literal in `lib/provisional-figures.ts` carries an explicit `category` property.

**Why this matters:** The null-category fallback (above) is deliberately scoped to admission only. A conference or workshop-field-trip product seeded with no `category` would be **permanently invisible everywhere** — the fallback doesn't apply to other categories, so it would simply disappear from the catalog with no warning. Every future run of the seed script against a dataset lacking those products (a fresh dataset, or the production dataset once someone runs it for real) would recreate that silent gap.

### Fix, Part 1: Write the Category Field

Add `category: product.category` to the document literal in the `buildTicketTypeDoc()` function:

```ts
export function buildTicketTypeDoc(
  product: ProvisionalAdmissionProduct,
  index: number,
  showId: string,
): Record<string, unknown> & { _id: string; _type: string } {
  return {
    _id: `ticketType-${product.slug}`,
    _type: 'ticketType',
    // ... other fields ...
    category: product.category,  // Added
  };
}
```

### Fix, Part 2: Guard Against Module-Scope Side Effects (A Second Defect)

While writing the contract check to verify `buildTicketTypeDoc()`, the test attempted to import `scripts/seed-ticketing.ts` for isolated function testing. The very first import triggered a real seed run against the live `production` dataset — the script calls `main().catch(...)` unconditionally at module scope, with no guard for "am I being executed, or imported."

This is **exactly the defect class already flagged** in project memory (`project_contract_checks_mutate_live_content.md`): a module that should be inert when imported mutates live data at import time. While `createIfNotExists` and `.patch().setIfMissing()` are idempotent/harmless, this project does not get to rely on "it happened to be harmless this time."

**Combined fix, both parts required together:**

1. Extract document-building logic into a pure function (`buildTicketTypeDoc`) with no `.env.local` read, no Sanity client, no network access — just the object literal. `seedTicketTypes()` calls it and passes the result to `client.createIfNotExists(...)`.

2. Guard `main()` behind a direct-execution check:

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
```

Now importing the module for testing never triggers a live seed as a side effect.

### Mechanical Proof

`contracts/checks/ticketing-purchase-pages-f3/check-seed-category-field.mjs` imports the real `buildTicketTypeDoc` export and calls it against all 15 real product objects from `lib/provisional-figures.ts`, asserting the returned doc's `category` matches `product.category` for every one. Run against the pre-repair script, it fails with "does not export a `buildTicketTypeDoc` function."

---

## Migration Script: `scripts/migrate-ticket-type-category.ts`

Backfills the `category` field onto pre-existing `ticketType` documents in the target Sanity dataset:

```bash
node --import tsx/esm scripts/migrate-ticket-type-category.ts [--dry-run]
```

**Follows the established pattern** (`scripts/migrate-show-sales-fields.ts`):
- Uses `setIfMissing`, never `.set()` — a second run or an editor's changes between runs are always a no-op
- Keyed off `lib/provisional-figures.ts`'s three product arrays (the same single source of truth the contract verifies)
- Supports `--dry-run`: prints which documents would be patched, without writing

**DEFECT REPAIR (from golden README item 8):** The real live dataset has only 10 `ticketType` documents total, and only 5 are covered by this feature's three product arrays. The other 5 are legacy/inactive (`adult`, `child`, `exhibitor`, `pensioner`, `saoc-member`), harmless since they're excluded by `active == true` in every query. The 6 conference + 4 workshop products have not been seeded yet — the seed script handles that separately.

**Patching a document ID that doesn't exist yet throws.** So the migration first queries which of the 15 canonical document IDs actually exist (`existingIds`) and **skips (logs, never throws) any that don't**:

```ts
if (!existingIds.has(docId)) {
  console.log(`    ${docId}: SKIP — document does not exist yet in this dataset`);
  continue;
}
```

Those 10 documents will already carry `category` at seed time once `scripts/seed-ticketing.ts` eventually seeds them (the fixed `buildTicketTypeDoc` includes it), making this script's work for those a safe no-op by then.

### Known Open Item

**The migration has only ever been run with `--dry-run` against production.** Actually running it for real is a manual operational step outside this feature's scope — the same posture as documented in the golden README section "Still open: the live migration has still never been run for real."

---

## Out of Scope: F4 and F5

**Navigation wiring (now F4, was blocked on F3):** Adding the two new categories to `nav-config.ts`'s Tickets column links. Unblocked now that F3's routes exist. See `contracts/golden/ticketing-nav-f3/README.md` (the guard-rail contract documenting what must flip green before F4 dispatches).

**Checkout capacity pooling (F5):** The real capacity-pooling fix for the Sunset Cocktails couple-ticket and Field Trip shared-pool oversell risks documented in F2's golden README. Defect confirmed as closed in the interim by capacity-number resizing; proper fix deferred.

---

## Lessons: Three Defect-Repair Cycles Worth Remembering

This feature required **three separate QA/Codex detection and repair cycles** before shipping clean. The defect patterns and fixes are worth internalizing for future ticketing work:

### 1. Verify Against the Real Live Dataset, Not Just Contract Assertions

**Defect 1 (null-category read-time fallback)** was invisible in development because the test dataset's documents carry explicit categories from the start. It only surfaced when @qa-apex ran against the actual production Sanity dataset and saw the admission page go empty on deploy day.

**Lesson:** Contract assertions and structural code review cannot see real production data state. When a feature's behavior depends on existing data having a specific shape or value range, add an explicit "run against real live data" step to QA. It is not paranoia; it is the class of bug same-model code review alone will miss.

### 2. Check Whether a Script Has Import-Time Side Effects Before Writing a Contract Check That Imports It

**Defect 2b (unguarded `main()` call)** surfaced only when the contract check attempted to import `buildTicketTypeDoc` in isolation. The import triggered a real seed run against the live dataset. This is a defect in the script itself, not the check — but it would have remained forever invisible without a test attempting to import the module.

**Lesson:** Before writing a contract check that imports a utility/script module, read the module's top-level code — is there an unguarded async function call, a side effect at module scope, or network/file I/O? If yes, the check itself will mutate live data at import time. Either guard the side effect (as this script did) or split the utilities into a separate, truly pure module (buildTicketTypeDoc could have lived in a standalone utils file). The pattern: pure functions are importable; scripts with side effects need direct-execution guards.

### 3. Codex Cross-Model Review Catches Defects Same-Model Review Misses

**All three defects were found during or after the mandatory Codex GPT-5.5 pass.** Defect 1 required live-data QA to surface, then Codex reviewed the fix. Defects 2 and 2b were both caught by Codex's second pass, after the first defect fix was already applied. Same-model code review (whether @dev or @qa) passed all checks every time.

This is not a reflection on the quality of this project's @qa work — @qa-apex's reviews were thorough and adversarial. It is simply an empirical reminder that two independent models with different blind spots catch different classes of bugs. The standing rule (mandatory Codex pass on every apex-tier feature) exists for exactly this reason, and this feature is evidence it earns its place in the chain.

---

## Files Changed

**New files:**
- `components/tickets/CategoryTicketsPage.tsx` — shared page component, parameterized by category
- `app/(marketing)/national-show/conferences/page.tsx` — Conferences route
- `app/(marketing)/national-show/workshops/page.tsx` — Workshops & Field Trips route
- `lib/tickets-category-warning.ts` — safety-valve warning helper for null-category fallback
- `scripts/migrate-ticket-type-category.ts` — one-time backfill script for pre-existing docs
- Contract checks: `contracts/checks/ticketing-purchase-pages-f3/check-*.mjs`

**Modified files:**
- `lib/provisional-figures.ts` — new `ProvisionalProductCategory` type, `category` field on every product
- `sanity/queries.ts` — new `activeTicketTypesByCategoryQuery` (additive, original query untouched)
- `sanity/schemas/documents/ticketType.ts` — new required `category` field
- `scripts/seed-ticketing.ts` — updated to write `category` via pure `buildTicketTypeDoc` function, guarded against module-scope side effects
- `app/(marketing)/national-show/tickets/page.tsx` — two new cards in OPTIONS array
- `components/tickets/index.ts` — exports `CategoryTicketsPage`

**Untouched:**
- `app/(marketing)/tickets/page.tsx` — continues as-is, thin wrapper around `CategoryTicketsPage('admission', ...)`
- `app/api/tickets/checkout/route.ts` — checkout already accepts all categories generically
- `lib/checkout-reservation.ts` — existing validation works for any category
- Any component using the `ticketsPage` Sanity singleton — generic microcopy already reused

---

## Sources

- `.agent/memory/project/missions/2026-08-21-ticketing-conferences-and-events.md` — F3 scope and rationale
- `contracts/golden/ticketing-purchase-pages-f3/README.md` — full design decisions: null-category fallback, migration strategy, safety valves, three defect-repair details
- `contracts/golden/ticketing-nav-f3/README.md` — option analysis for why F3 was inserted (F1/F2 built data, not pages)
- `lib/provisional-figures.ts` — source of truth for all 15 products and their categories

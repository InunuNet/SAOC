# CMS Wiring Cleanup (Stream C)

Closes a batch of small CMS-correctness defects where a document type or field was
editable in Sanity Studio but had no effect on the rendered site — the secretary could
publish a change and nothing would happen. Contract:
`contracts/contract-cms-wiring-cleanup.yaml` (14 assertions, all independently re-run
by QA and green — see `.agent/memory/scratch/cms-qa.md`).

Every item below was either **wired** (publishing now does something) or **removed**
(the field no longer exists, so it stops promising something it can't deliver). Nothing
was left editable-but-dead.

Not covered here, and not deployed: this is dev-tree work only. Nothing in this stream
has gone to production — there is no live saoc.co.za domain yet. Three other concurrent
streams (ticketing hardening, show visitor info, show exhibitor info) are out of scope
and have their own docs.

---

## 1. `/national-show/archive/[year]` now renders Studio-added shows

**Problem:** a `show` document created in Studio got a card on the archive list (already
Sanity-backed) but 404'd on its own detail page, which read `lib/data/shows` exclusively.

**Fix:** a new shared merge helper, `lib/data/mergeShows.ts`, unions the static
`lib/data/shows` array with Sanity `show` documents by `year`. Both
`app/(marketing)/national-show/archive/page.tsx` (list) and
`app/(marketing)/national-show/archive/[year]/page.tsx` (detail) now read the same
merged result — previously the list took the Sanity branch wholesale while the detail
page ignored Sanity entirely, so the two pages could disagree about the same show (the
list rendered a bare year where the detail page rendered "Edition XVIII", and mislabelled
the 2021 show's month).

**Merge rule** (`lib/data/mergeShows.ts`): a defined Sanity value always wins over the
static value; an undefined Sanity value falls back to static; never the reverse — a
published edit must not be silently masked by a hardcoded literal. A Sanity-only year
(no static record) starts from an empty base and degrades gracefully: `edition`,
`month`, `host` and `venue` are optional on the merged `ArchiveShow` type (they're
required on the older `NationalShow` type, which every static entry has), and the
detail page's "Edition" stat cell renders `—` rather than fabricate an edition number.

**New field:** `exhibitors` lands in its own slot on `ArchiveShow` — it is not conflated
with the static `visitors` field. As of this writing, all six `show` documents have
`exhibitors: null`, so the exhibitors chip and detail line are wired but render nothing
yet; they'll appear as soon as a document sets a value.

**Known gap (not fixed here):** `show.awards` and `show.title` are merged into
`ArchiveShow` but rendered by neither archive page today. Before this change the list
page rendered Sanity `awards` as a "trophies" count; that rendering was dropped in the
consolidation and not reinstated. No live effect currently (`awards` is null on all six
documents), but a Studio show with `awards` set would show nothing on either page. Flagged
as a backlog item, not blocking.

**Schema unchanged:** the `show` schema itself was not extended with `edition`, `month`,
`host`, `days`, `visitors` or `trophies` — that's tied to an open National Show
brand-architecture question and wasn't needed to close the 404.

Files: `lib/data/mergeShows.ts` (new), `app/(marketing)/national-show/archive/page.tsx`,
`app/(marketing)/national-show/archive/[year]/page.tsx`, `types/index.ts`
(`NationalShow.exhibitors`), `sanity/queries.ts`.

---

## 2. `province` document type wired to the `/societies` filter chips

**Problem:** the `province` document type existed in Sanity (9 documents: Western Cape,
Eastern Cape, Northern Cape, Free State, KwaZulu-Natal, Gauteng, Mpumalanga, Limpopo,
North West) but the `/societies` filter chips were sourced from a hardcoded
`lib/data/provinces.ts` array. Renaming a province in Studio had no effect on the site.

Removal was considered and ruled out — the contract's rule is that a schema removal must
first be confirmed empty, and 9 live documents is not empty. So the type was wired
instead, narrowly: only the `/societies` chip source changed.

**What changed:**
- New `order` field (number) added to `sanity/schemas/documents/province.ts`. It
  controls chip position — lower sorts first. The intended sequence is a curated
  south-west-to-north-east geography, not alphabetical.
- `scripts/seed-province-order.ts` (new) patched all 9 existing documents with
  `order` values 1–9, using `setIfMissing` — never `createOrReplace`, so it cannot
  clobber real content. Verified idempotent: re-running it reports "0 patched, 9
  already ordered" and leaves the dataset byte-identical.
- New `provinceListQuery` in `sanity/queries.ts`, ordered `order(order asc, name asc)`
  — deterministic, so chips don't reshuffle between renders.
- `app/(marketing)/societies/page.tsx` fetches the query and passes a `provinces`
  prop to `SocietiesClient.tsx`, which now sources the chips from it.
- Each chip gets `aria-label={province.name}` (e.g. `aria-label="Western Cape"`) while
  the visible chip text stays the two-letter code (`WC`) — this is both an
  accessibility fix (a bare "WC" button was previously opaque to a screen reader) and
  the rendered surface that proves the wiring: renaming a province in Studio now
  changes the chip's aria-label live.
- The **"All" chip stays synthesised in code**, not a Studio document — an editor
  cannot delete it and break filtering.
- `lib/data/provinces.ts` remains only as a fallback, applied in `(sanity ?? fallback)`
  order — never reversed.

**What did *not* change:** `society.province` is still a free-text field, not a
reference to a `province` document. The codes happen to match `province.code` exactly,
which makes a reference migration tempting, but it would touch all 21 society documents
and risk real content to close what was originally a low-priority defect. Deliberately
not done — flagged as outstanding, not attempted.

**Ordering field behaviour for a new province:** `order` has no required validation and
no default. A province document published with `order` left blank sorts *last* in the
list (GROQ's `order(order asc, ...)` puts nulls after all defined values) — it appends to
the end of the chip row rather than breaking the list or jumping to the front. See the
editor-facing note below.

Files: `sanity/schemas/documents/province.ts`, `scripts/seed-province-order.ts` (new),
`sanity/queries.ts`, `app/(marketing)/societies/page.tsx`,
`app/(marketing)/societies/SocietiesClient.tsx`.

---

## 3. `award` document type — no work needed

The backlog listed `award` as orphaned. Verified false: `awardsQuery` already exists in
`sanity/queries.ts`, `/judging` already fetches it, and `AwardsGrid` already takes
`awards` as a prop rather than reading `lib/data/awards`. The backlog entry was stale;
nothing was changed.

---

## 4. `aboutPage.title` wired into `/about`

**Problem:** `aboutPage.title` was fetched into a variable and declared in the
`AboutPageData` interface in `app/(marketing)/about/page.tsx`, but never placed in JSX
— the hero heading was a hardcoded literal. This is the project's canonical "false
green": a substring grep for `title` would have passed while the field rendered
nowhere.

**Fix:** the `PageHero` heading now reads
`heading={about?.title ?? 'A federated body of growers, since 1968.'}` — the Sanity
value wins when set, and the existing hardcoded heading is kept as the fallback when it
isn't. The field is currently unset (`null`) in the dataset, which is expected; nothing
was seeded.

File: `app/(marketing)/about/page.tsx`.

---

## 5. Two dead fields removed

Both were confirmed empty (`defined()` count 0) via live GROQ query before removal, and
the automated gate re-confirms emptiness at grading time — if either had gained a value
before the gate ran, the removal would fail rather than silently destroy content.

- **`homePage.countdownDate`** — a duplicate of the field that actually drives the home
  page countdown, `nationalShow.countdownDate` (wired at
  `app/(marketing)/page.tsx`, `countdownDate={show?.countdownDate}`). Two same-purpose
  fields, one inert, is exactly what produced the original backlog confusion ("the
  countdown field doesn't drive the countdown"). Removed from the schema, the
  `homePageQuery` projection, and the `HomePageData` interface. The live wiring line
  was left untouched and verified unaffected — a headless-browser check read 402 days
  on the hydrated home page, matching a value computed independently from
  `nationalShow.countdownDate` in the dataset.
- **`contactPage.formRecipients`** — present in the schema, editable, read by nothing.
  `/api/contact` (`app/api/contact/route.ts`) writes submissions to Firestore
  `contactSubmissions` and emails only the submitter, via `RESEND_FROM_ADDRESS`
  (`lib/email.ts`) — it never referenced this field. Removed from the schema and from
  two now-stale comment references in `scripts/seed-page-singletons.ts`.

  **Known gap surfaced by this removal (not fixed here):** no SAOC-side notification of
  a new enquiry exists anywhere in the current build — staff only see submissions by
  checking Firestore directly. The removal itself is correct (the field was never
  wired to any actual routing), but the underlying gap — nobody gets notified when a
  visitor submits the contact form — is a separate, unaddressed product gap worth its
  own backlog item.

Files: `sanity/schemas/documents/homePage.ts`, `sanity/schemas/documents/contactPage.ts`,
`sanity/queries.ts`, `app/(marketing)/page.tsx`, `scripts/seed-page-singletons.ts`.

---

## 6. Two structural fixes

- **`contracts/checks/f3-pin-singletons/check-new-document-filter.mjs`** — the
  `MUST_SURVIVE` constant named `'event'`, which is an import binding name in
  `sanity/schemas/index.ts`, not a real schema type. Corrected to `'societyEvent'`,
  the type the event schema actually declares.
- **`sanity/lib/image.ts`** — was importing `@sanity/image-url`'s deprecated default
  export, which logs a warning on every home-page render in dev (deprecated as of
  v2.1.1). Switched to the named `createImageUrlBuilder` export. Verified the home page
  still serves a `cdn.sanity.io` image URL afterward, so `urlFor()` still works.

---

## Regression guard, not new work

`/events/[slug]` revalidation tags were reported in the backlog as `['events']`, which
matches no real Sanity document type (the type is `societyEvent`). Verified already
fixed in the tree — all three `sanityFetch` call sites tag `['societyEvent', 'sanity']`.
No code changed here; the contract adds a regression check (`A11`) that reads the
expected tag strings from their own source definitions, so this can't silently regress.

This stream also does not touch, and did not need to touch:
`app/(marketing)/national-show/page.tsx`, the `national-show/{plan-your-visit,
what-to-expect, faq}` and `national-show/exhibitors` routes, `components/show/
ShowCountdown.tsx`, `sanity/schemas/documents/nationalShow.ts`, the ticketing API
routes, or `apphosting.yaml` — those are reserved by other concurrent streams.

## Explicitly out of scope

- The App Hosting CDN cache-invalidation blocker.
- Anything requiring a deploy or Secret Manager access.
- Prettier formatting drift across the wider codebase.
- The Sanity v6 upgrade.

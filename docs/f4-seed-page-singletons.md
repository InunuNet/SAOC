# F4 — Seed Page Singleton Documents

Mission: `cms-activation-deploy`, F4. Follows F3 (`docs/f3-pin-singletons.md`), which pinned
each of the six page-singleton schemas to a fixed desk-structure entry and a fixed `_id`
(`sanity/structure.ts`, commit `df5ee43`) but wrote no content. F4 seeds those six documents
with copy migrated verbatim from the hardcoded fallbacks already present in
`app/(marketing)/` and `components/` — no invented, rewritten, or "improved" copy.

## What was seeded

Script: `scripts/seed-page-singletons.ts`, run with
`node --import tsx/esm scripts/seed-page-singletons.ts`.

Six documents, one per singleton type, each written at `_id === <type name>` (matching
Sanity's standard singleton pattern, and the ids F3 pinned in `sanity/structure.ts`):

| `_id` | `_type` | Source component(s) |
|---|---|---|
| `homePage` | `homePage` | `app/(marketing)/page.tsx`, `components/home/MissionBlock.tsx`, `lib/data/heroImages.ts` |
| `aboutPage` | `aboutPage` | `app/(marketing)/about/page.tsx` |
| `nationalShow` | `nationalShow` | `components/home/ShowBand.tsx` |
| `contactPage` | `contactPage` | `app/(marketing)/contact/page.tsx` |
| `judgingPage` | `judgingPage` | `app/(marketing)/judging/page.tsx` |
| `membersPage` | `membersPage` | none — deliberate empty placeholder, see below |

Field-by-field values, `kind` tags (`exact` / `exactArray` / `portableText` / `image` /
`imageArray` / `absent`), and the reasoning behind every judgment call are recorded in
`contracts/golden/f4-seed-page-singletons/*.golden.json`, one file per document — that is
the source of truth, not this doc. Verified against the live dataset by
`contracts/checks/f4-seed-page-singletons/check-seed-content.mjs` (contract assertion A1):
6/6 documents exist at their pinned ids, 27 fields match, 4 image asset references resolve.

Two image uploads happened as part of seeding, via `client.assets.upload`, referenced from
the written documents:

- `homePage.heroImages` — the 4 static files listed in `lib/data/heroImages.ts`
  (`orchid-yellow.jpg`, `orchid-violet.jpg`, `orchid-pink.jpg`, `orchid-dark.jpg` from
  `public/images/`), in that order.
- `nationalShow.hero` — `public/images/orchid-yellow.jpg`, the same file `ShowBand.tsx`
  renders as its background image.

`membersPage` was seeded as a document that exists but carries no content fields
(`title`/`intro`/`resources` all absent) — a deliberate empty placeholder per Brad's
decision, 2026-07-29 (recorded in `sanity/structure.ts` and the F3 contract). There is no
`/members` route and no query consumes this schema; F4's job for this type was only to
confirm the document exists, not to give it content.

## Idempotency

`scripts/seed-page-singletons.ts` uses `createOrReplace` against each pinned `_id` (never
creates a second document of the same type) and looks up already-uploaded image assets by
filename before uploading, reusing the existing asset reference on a re-run instead of
uploading a duplicate. This was verified with a real second run of the script against the
already-seeded dataset: it reused the existing image assets and created no duplicate
documents or assets. `contracts/checks/f4-seed-page-singletons/check-no-duplicate-seeds.mjs`
(assertion A2) is the standing guard for this — it fails if any of the six pinned types ever
has more than one document, which would happen if a seed run (or any future API write)
bypassed the pinned id.

## The nine documented gaps

These are open decisions for Brad, not defects to hide. Each is a field that either has no
consuming code, or has hardcoded source copy that doesn't map cleanly onto the schema.
Full reasoning for each lives in the corresponding golden file's per-field `note`; summarised
here:

1. **`homePage.title`** — no component reads this field at all. Seeded with the page's
   `<metadata>` title ("South African Orchid Council") as the closest available analog;
   functionally inert either way.
2. **`homePage.countdownDate`** — DEAD FIELD. Editable in Studio, but read by no component.
   The only hardcoded countdown date in the codebase (`ShowBand.tsx`'s
   `DEFAULT_COUNTDOWN_DATE`) drives `nationalShow.countdownDate`, not this field. Left unset;
   do not invent a value for it. Needs a wire-up-or-remove decision from Brad. (This is also
   the field `docs/secretary-cms-guide.md` §12 previously told the secretary to keep in sync
   with the National Show page — that instruction has been corrected; see below.)
3. **`aboutPage.title`** — no component reads this field; no hardcoded analog exists at all
   (unlike `homePage.title`, there's no metadata title to fall back to). Left unset.
4. **`aboutPage.boardIntroText`** — not actually a gap: `about/page.tsx` renders nothing
   when this is null, so there's no fallback string to migrate. Legitimately empty by
   design.
5. **`nationalShow.showDate`** — `ShowBand.tsx`'s `SHOW_META` only has a display string
   ("September 2027"), not a parseable ISO datetime. Inventing a specific day/time would be
   fabricating content, not migrating it. Left unset.
6. **`nationalShow.location` / "Host Region" gap** — `ShowBand.tsx` has two separate
   hardcoded location-ish strings ("Host Region": "Western Cape", "Venue": "Cape Town
   International Convention Centre") but the schema has only one `location` field. Seeded
   with the Venue string (the more specific physical location); "Western Cape" has no
   corresponding schema field and is not migrated anywhere. Flag for Brad if a host-region
   field is wanted.
7. **`nationalShow.exhibitorStages`** — no hardcoded exhibitor-stage copy exists anywhere to
   migrate. Left unset. Also note: full, current National Show content (real dates, real
   logistics) is time-sensitive and owned by Brad/the National Show committee, tied to the
   still-open National Show brand-architecture question — this seed only migrated what was
   genuinely already hardcoded in the repo, not real show content.
8. **`contactPage.formRecipients`** — orphaned field, no code reads it; the contact form's
   actual submission target is `app/api/contact/`, not this field. No hardcoded value exists
   to migrate. Left unset.
9. **`judgingPage.stats` / `judgingPage.judges`** — neither is a gap in the "missing work"
   sense: `judgingPage.stats` is explicitly conditional in code (renders nothing when empty)
   with no hardcoded fallback numbers to migrate, and `judgingPage.judges` has nothing to
   reference because 0 `judge` documents currently exist in the dataset — the judges
   directory already falls back to an empty array in code. Both left unset.

One related judgment call that is not a gap: `judgingPage.showPublicDirectory` was seeded as
`false` even though no component has a hardcoded `true`/`false` literal for it — the code's
own check (`data?.showPublicDirectory === true`) already treats an absent value as `false`,
so writing `false` explicitly just makes that existing live behaviour visible in the CMS
without changing what renders.

## Documentation follow-up

`docs/secretary-cms-guide.md` §7 and §12 previously told the secretary to open a document
that did not exist before F4 shipped; both are now correct since the documents exist. §12
step 4 previously told her to keep `homePage.countdownDate` in sync with the National Show
page's countdown — since `homePage.countdownDate` has no consumer in the code (gap #2
above), that instruction has been corrected to explain the field is inert and point her to
the National Show page instead, which is the field that actually drives the countdown shown
to visitors (`nationalShow.countdownDate`, seeded here as `2027-09-18T09:00:00+02:00`).

# F6 - Archive honesty (implementation spec for @dev)

Base: `origin/main`. Rule: docs/rules/no-invention.md. Precedent: F4 (goldens/f4/f4-spec.md).

## Findings: sourced vs unsourced
- Unsourced (invented): editions 14-18, years 2012/2015/2018/2021/2024, every venue, host province, month, days,
  entries, visitors, trophies, the "pandemic protocols" note. Source of the copy: `design/design_handoff_saoc/src/data.js:385-440`
  (design MOCK data), copied to `lib/data/shows.ts:15-70` (commit 6451883f) and seeded to Sanity `show-14-2012..show-18-2024`.
  `grep` over docs/leeann-source and content/drive-source finds none of them. Edition numbers and years of past shows are
  themselves unsourced, so no past edition exists as a confirmed fact. Do NOT keep a year-only list.
- Unsourced: "Since 1974" (archive/page.tsx:81 lede). Only appears in the design mock timeline (pages-interior.jsx:152).
- Sourced: "triennial" - Drive `National Show/2. About/2.1 About - 2027 National Show/v1.0/content.md:5`
  ("premier triennial event"). Use that word only; no "rotated across the provinces", no first-year claim.
- Sourced: 2027 entry (`lib/data/shows.ts:6-14`: The Hangar, Stellenbosch Flying Club; September). It is `status: 'upcoming'`
  and the only consumer of `staticShows` filters `status === 'past'` (national-show/page.tsx:420), mergePastShows filters past,
  so the upcoming entry is dead data. Its host "Western Cape" and days 4 are unverifiable here and unneeded; the show page
  reads the Sanity `nationalShow` singleton. Delete the file whole.

## 1. Code
- Delete `lib/data/shows.ts`. `lib/data/mergeShows.ts`: remove the `staticShows` import and loop; `mergeShows` builds from
  Sanity only. Keep the Sanity-only degradation (no edition/month/host invented). Keep exports and signatures.
  Update header comment (static record is gone). Remove any `export` of shows from `lib/data/index.ts` if present.
- `archive/page.tsx`: remove `NOS_HERO_IMAGES` photo use, `next/image`, `archivePhotoFor`, the Badge-on-photo tile image and
  fabricated alt text. Tiles (only for a Sanity past show that exists) are typographic: the year as large Cormorant serif
  (existing `font-serif` classes already on the page) on the `bg-[var(--night)]` block, no image element. Lede becomes
  `The South African National Orchid Show is the council's triennial event.` Metadata description: `Past editions of the South African National Orchid Show.`
  (remove "every", "entry numbers", "winners").
- Empty state (replaces "Archive records coming soon."): heading text `Show history awaiting committee records` and, beside/below it,
  `<ConfirmationBadge status="pending" />` (components/show/ConfirmationBadge.tsx, same wrapper F4 uses; floor label
  "To be confirmed", emits `data-confirmation-badge="pending"`). No other new prose, token, colour or component.
- `archive/[year]/page.tsx`: same removals (photo block, `archivePhotoFor`, `NOS_HERO_IMAGES`). With a Sanity-only show,
  render hero with year + whatever is recorded; the Stats grid renders only recorded values (drop the `—` placeholder cards
  for unrecorded fields); the "About the show" block keeps only facts present; when nothing beyond the year is recorded show
  the same `ConfirmationBadge` pending marker. `summarySentence` must not assert "was held ... hosted by" for absent fields.
  An unrecorded year still `notFound()`. `generateStaticParams` returns `[]` when no Sanity show exists.
- `national-show/page.tsx`: delete the "Past shows" section and its `pastShows` build (lines ~409-421, 710-731), the
  `staticShows` import and `pastEditionImage`. The sitewide F-section nav entry `title: 'Past shows'` (line ~200): leave
  alone unless it links to a removed anchor (then remove the anchor entry only). `components/nos/PastEditionCard.tsx`: if it
  has no remaining importer, delete it.
- `app/sitemap.ts`: unchanged logic, it already derives from `mergePastShows`; with the static base gone and Sanity
  unpublished it emits no archive years. Do not hand-edit beyond import cleanup. The `/national-show/archive` index route
  itself stays in the sitemap (it renders the honest state).
- `scripts/seed-sanity.ts`: remove any `shows` import / past-show seeding so a re-seed cannot recreate the docs.
- `public/llms-full.txt`: after the Sanity apply run `pnpm refresh-llms` (editor token from `.env.local`, never printed)
  and commit the result; it must not contain the three venue strings.

## 2. Content - `scripts/unpublish-invented-shows.ts` (same shape as F4 unpublish)
`pnpm exec tsx scripts/unpublish-invented-shows.ts --dry-run | --apply`; neither flag: usage, exit 2. Reads `.env.local`
directly (no dotenv); `SANITY_API_TOKEN` only needed for `--apply`; never print it. Target ids are the five constants in
`invented-shows.json` (inline). Exact-id only, no query-driven deletes.
- Fetch the published (`_id` not `drafts.`) `show` docs with `_rev`. A published `show` doc with `status == "past"` that is not
  in the target list prints `UNLISTED <id>` and exits 3 without writing (may be a real, newly added edition). Missing target
  ids (already unpublished) are skipped, so the script is idempotent. Never touch the KEEP ids.
- Output, one per line: `MODE dry-run|apply`, `FOUND <n>`, `KEEP <id>` for each of show-19-2027 and show-fictional-test
  (if present), `UNPUBLISH <id> rev=<_rev>` per target, `SUMMARY unpublish=<n> keep=<k> backup=<path|none>`.
- Decision on the fields (what to null): the docs are unpublished whole, not field-edited, because a year-only doc would
  still publish an invented edition. The DRAFT copy is created with `entries` and `location` unset so re-publishing from the
  Studio cannot restore invented figures; the full original goes to the backup first.
- `--apply` order: (1) write full JSON of targets to `.tmp/sandbox/launch-weekend-f6-backup/<ISO timestamp>.json`, re-read
  and verify count, else exit 1 before any write; (2) per doc one transaction: no-op `patch(id, { ifRevisionID: _rev })` +
  `createIfNotExists({ ...doc minus entries/location, _id: 'drafts.' + id })` + `delete(id)`; stale revision aborts and the
  script stops; (3) `DONE unpublished=<n>`. Lead runs `--apply` after review; recoverable from backup and drafts.

## 3. Visuals
Typographic only: reuse the existing serif year display, `bg-[var(--night)]` block and NosHero from the page. No orchid stock
photo posing as a show photo, no invented alt text. No new design; if a visual is needed it comes from
design/design_handoff_saoc/ or branding/National Show 2027/ only.

## Out of scope / known follow-ups
- "19th edition" labelling elsewhere (`showLabelWithEdition`, nationalShow.edition) is not traced to Drive here; report, do not change.
- The `show` schema keeps `entries/exhibitors/awards` fields; no schema change.
- Old checks cms-wiring-cleanup/check-archive-* and ticketing-f1-show-collision/check-backward-compat-past-shows assert the
  static merge; @dev updates or retires them in this change (allowlisted) and says which.

## NOS Design ruling (2026-10-16) - empty-state surface and numeral
Ruling: honest content gap = R11 status surface + the typographic edition numeral (Fraunces numerals role), no photo.
**Which case applies: edition numbers are UNSOURCED, so the numeral cannot appear.** Edition 14-18 and their years trace to
nothing (see Findings); the upcoming show is not an archive entry (its "19th" edition number is itself UNCONFIRMED, an open question to Lee-Ann; F6 neither relies on it nor changes how it renders). Therefore:
- Archive index empty state = the R11 surface only: disclosure chip (`ConfirmationBadge status="pending"`, muted tone, never
  error/red) -> one sentence (the heading `Show history awaiting committee records` is the sentence) -> dashed 2px rail, using the
  existing R11 pattern already used on the NOS pages (reuse it; no new component or token). No numeral, no "Edition", no Roman
  ordinal, no ordinal like 18th anywhere on the empty state.
- The numeral role (serif display, the same `font-serif` numeral treatment used for the year) may be used ONLY for a value that
  exists in a published Sanity `show` doc: the year of a real past show on its tile and detail hero. An edition numeral renders
  only if an `edition` value is recorded; the Sanity projection carries none and the static source is deleted, so today it never
  renders. `toRomanOrdinal` and the `Edition ...` badge/eyebrow stay conditional on a recorded `edition` (never inferred from year).
- Still no photo, no `next/image`, no fabricated alt text on either archive page.

## Round 3: hub (`/national-show`) and llms.txt (Codex FAIL, rulings 2026-10-16)
Neither fact traces to Drive; they came from the design mock. Rule: deletion, no new copy.
- `national-show/page.tsx` `CYCLE_YEARS` (2024 / ed. 18 / KwaZulu-Natal, 2030 / ed. 20 / TBC) and the whole "Three-year cycle" section
  (heading, CycleStep rail and the sentence "Host province rotates among regional orchid societies nominated by the SAOC board", also
  unsourced): delete the section. A cycle of one card is not a cycle. The only sourced fact, triennial, is already on the page in the
  hero meta `Cycle: Triennial` and the `3 yr / Cycle` stat. Delete the now-dead `CYCLE_YEARS`, `toRomanOrdinal`, the `cycle` const, and
  the `CycleStep` import; delete `components/nos/CycleStep.tsx` (its only importer). The current show (2027, 23-26 Sep, The Hangar: sourced via Brad) stays where it
  already renders, edition rendering untouched (hero, CTA), from the nationalShow singleton.
- Stats block: delete the two array entries `{ value: '18', label: 'Editions held' }` and `{ value: '1,240', label: 'Entries — 2024' }`.
  The remaining two (`3 yr Cycle`, `10 Judging classes`) fill the 2-col grid exactly, no orphan, no new copy, no R11 chip.
- `public/llms.txt:25` (static file, no generator writes it): description `Past national shows, champions, and galleries.` -> `Previous editions.`
- Checks: A1 and A2 fail on the hub strings (HUB_FORBIDDEN in `_lib.mjs`: KwaZulu, Editions held, Entries — 2024, 1,240, Three-year
  cycle, Host province rotates, Edition XVIII/XX) and on champion/gallery wording in llms.txt; A1 also fails if CycleStep.tsx exists.
- Backlog note (do not build): unpublish script's createIfNotExists would not strip fields if a draft already existed; live drafts verified clean.

## Round 4 (Codex r2, rulings 2026-10-16)
- Live data: lead deleted all five `drafts.show-1x` docs via the Sanity mutate API (txn yQad5QWWJE4sZKMZ23MR8j) because the drafts kept
  year/title/status past. Only show-19-2027 and show-fictional-test remain in any perspective; originals are in the wt-f6 backup JSON.
  The unpublish script is NOT changed in F6 (backlog: draft retains year/title/status, would need a delete rather than a draft).
- Hub rotation claim (`national-show/page.tsx` ~436-440): delete the clause `it rotates across South Africa&rsquo;s nine provinces,` and
  join with the existing verb: result reads `Held every three years, it brings together growers, hybridisers, judges and collectors for
  four days of competition, education, and community.` Only a connective changes (`bringing` -> `it brings`); no new fact. Deleting the
  clause, not the sentence: the rest traces to Drive 2.1 ("premier triennial event, bringing together ... growers ... judges") and to
  Brad's 23-26 Sep dates (four days). No R11 chip: the remainder is sourced.
- Sourcing audit of that section (gap list for Brad, NOT widened into F6): the title `Three years in the making, four days on the
  bench` is a figure built from two sourced facts (triennial, four days) - accepted. `premier ... competitive orchid event`: "premier"
  sourced, "competitive" not in Drive wording (low risk, judging exists). Second paragraph (100-point scale, ten botanical classes, Grand
  Champion = highest-scoring exhibit across all classes) has no Drive hit for those specifics (grep "100-point", "ten classes", "grand
  champion"); belongs to the judging-content work, report only.
- Archive hero image: NosHero has no image-less variant (`image` is required; no typographic hero component exists in the repo, R29 is
  only a backlog item). Inventing one would be new design, so ACCEPTED with this note: the hero image is the shared decorative NosHero
  photo with alt="", identical to every NOS inner page; it is not presented as a photo of any show. "Photo-free" in this spec means no
  edition tile photo and no fabricated alt/caption. A1 fails on a templated alt; A2 fails if any <img> in <main> of the archive index
  has a non-empty alt. When the R29 typographic hero lands, switch the two archive heroes to it.

Round 4 amendment: "nine provinces" is NOT forbidden. The hub lede and PAGE_DESCRIPTION ("from all nine provinces") are Brad's own wording (2026-09-29), a valid source, and claim participation, not venue rotation. Only the rotation claim ("rotates across") is checked.

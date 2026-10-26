# saoc-pagehero-mirror: spec for @dev (HM-1 with HS-1, HS-2)

Work in a fresh worktree from main AFTER `fix/audit-2026-10-25` has merged (assertion A2). Read every path from the worktree.
No invention (docs/rules/no-invention.md): colours, spacing, type and copy come from existing tokens, `design/design_handoff_saoc/`, `branding/SA Orchid Council/` and the NOS Design rulings in section 1. No new tokens, no copy changes. Never write to Sanity or Firestore. Never set SITE_PUBLIC_LAUNCH.
Stay off the lanes in section 7. The architect's trial worktree measured everything below on main 9378155d; `.tmp/sandbox/saoc-mirror-arch` is removed at the end.

## 1. NOS Design rulings (binding) and where each is checked

| id | ruling | checked by |
|---|---|---|
| HM-1 | Served width at least box x DPR at 2056@2, 1440@2, 1280@2 and 390@3 with NO native-cap exception (the flagged-native pass path is gone). Scope adds the home PhotoBand (purple `700,750 to 5308,2050` on /about at 50% 45%, widened by NOS Design from 1196,750) and the ShowBand (S3 dark, width at least 2200, no stem end). The localised copy scrim replaces the full wash. | A9, A10, A8, A2 |
| gate as ruled | Lede at least 4.5 and h1/eyebrow at least 3 per glyph on the lightest pixel; no clips, stakes or stem ends; hero shots per route at 1280, 2056 and 390. | A11, A13, A8, A15 |
| HS-1 | Home carousel, copy zone 0-50%: slide 1 orchid-dark keeps `0,487 to 5184,2968 @62% 50%`; slide 2 is orchid-purple `408,560 to 5308,2904` (violet retires from home). At 1023 and below the home stacks like NOS H-a (2/1 photo band first, copy on a solid panel). At 1024-1279 the 270deg scrim narrows to the copy block; if dark still fails per glyph there, the stack extends to 1279. The gate reports which. | A13, A14, A9 |
| HS-2 | carousel img `alt=""` stands. | A3, A14 |
| inner picks | Bloom bottom-left 0-44%, bleed to 55-60%, copy from 52%. Horizontal flips only for purple and dark, emitted as build-time files `orchid-purple-flip` and `orchid-dark-flip` (never a CSS transform). `orchid-purple-flip` = `0,450 to 5308,2800` flipped (/judging `0% 40%`, /societies `0% 20%`, /events `0% 60%`). `orchid-dark-flip` = `0,790 to 5184,2560` flipped (/sponsors `0% 100%`; y1 2560 per NOS Design's C1 answer, the 2590 came from a downscaled sheet). Violet cuts: /contact `0,1900 to 4112,3720 @0% 80%`; /about `2300,1100 to 7327,4000 @0% 63%`; /societies/[slug] `0,400 to 4112,2600 @0% 50%`. | A8, A10, A16 |
| typographic | /constitution, /privacy, /terms, /refunds, /members and /media-kit are a typographic PageHero on the solid sage ground, no photograph (the NOS 404 pattern: eyebrow, light serif h1, lede). #76 `components/nos/LegalHero.tsx` renders the SAOC PageHero on the SAOC host and passes `image`; the typographic variant must work through that path. | A3, A9, A10, A11 |
| stack | 2/1 band on solid sage below 768, ruled for SAOC (closes gap G6). Gate 767@2 at least 1534 and 390@3 at least 1170. Copy on the solid panel needs no scrim. | A9, A10 |
| rejected | The unflipped sponsors cut `nos-hero-saoc-sponsors.jpg` is rejected and removed; pink and yellow retire from every hero box. The rect `0,790 to 4112,2610` was NOS Design's own G8 revision of 2026-10-24 for the old centred layout; tonight's ruling (2026-10-25, bloom-left, flipped cut) supersedes it. | A3, A8 |
| ShowBand (G9) | S3 is orchid-dark, the 10-23 left-cluster crop, as the derived cut `orchid-dark-showband`: rect `300,850 to 2700,2600` on the 5184x3456 original (2400x1750, ratio 1.3714; NOS Design's final extension, replaces 300,1000 to 2700,2542), position `50% 50%`, no flip; it replaces orchid-yellow on the ShowBand. The rect stops above the stem stub (x1815-1970, y2618-2786) and y1 must never pass 2600, which clears it by 18 native px; the A8 check asserts y1 <= 2600 on top of the stub probe. Gate: served at least CSS box x DPR (box about 979x620 CSS at 2056, 686x620 at 1440, 610x620 at 1280; the 2400 cut covers up to 1200 CSS wide at @2) plus the stub probe (rect and visible region). Never upscale; a box above 1200 CSS wide at @2 (viewports over about 2520) would need a wider rect. | A8, A9 |

Served-width formula (NOS Design, 2026-10-25, applies to every served-width gate here): required = max(boxW, boxH x srcW/srcH) x DPR, with the aspect of the source or derived cut file, checked against `currentSrc` in a bare `new Image()`. `goldens/crop-map.json` `requiredWidth` records the per-route, per-viewport table (box floors: heroes 480 high, home 720 (984 at 2056), PhotoBand 360, ShowBand its grid box; the gate uses the measured box). Findings: every hero, home slide and PhotoBand file meets it at 2056@2, 1440@2, 1280@2, 767@2 and 390@3 (e.g. /sponsors dark-flip 2.93:1 needs 2812 at 1280@2, file 5184). ShowBand (2400x1750, 1.3714:1; superseded table, see item 3 of the image-sweep section for the final numbers): the 3/2 block is width-driven (box aspect 1.5 is wider than the file), required = 2 x vw, and the grid box is height-driven while H x 1.3714 exceeds W.

SAOC QA findings on served width (folded in 2026-10-25; changed assertions A3 and A9):

1. Box wider than the viewport. SAOC QA measured the home hero box at 1445 at 1440 and 1284 at 1280 (about 5px over) on the audit branch, so 1440@2 needs 2890 against the audit width 2880 and 1280@2 needs 2569 against 2560. The cause is not found in source: `components/home/Hero.tsx:76-103` has no transform or width calc (the image is `fill` in an `absolute inset-0` group inside an `overflow-hidden` section), and `app/layout.tsx`, `globals.css` and the chrome set no `100vw` or negative margin. A scrollbar or a wider ancestor is the open hypothesis; the dev finds it in a browser. A9 now asserts image box width <= `window.innerWidth` (+0.5) for every measured image, so either the box stops exceeding the viewport or the gate fails; candidate widths are not padded to hide it.
2. Height-driven cover boxes under `sizes="100vw"` request too little (1023@2 and 768@2 home about 2380 against 2048 and 1920; 390@3 home dark 3575, violet 3564, /about and /constitution 2160, /societies, /judging, /events 1838, /members and /sponsors 1920, all served 1200). Fix to specify (D6): `sizes` is computed from the file's aspect, not a bare `100vw`: `max(100vw, <boxH>px * aspect)` on a wide hero (boxH = the hero min height, 480 for inner heroes, 720 for the home), and below 768 the 2/1 band, `calc(50vw * aspect)` when the file is wider than 2:1. A3 fails a literal `sizes="100vw"` in PageHero, Hero and PhotoBand. Candidates up to 6144 already exist in the loader. The table is re-derived against the POST-mirror hero (legal pages, /members and /media-kit typographic so they carry no photograph; home stacked 2/1 at 1023 and below).
3. Native-limited sources. After the mirror no hero or band uses pink or yellow (NOS Design, final): /contact violet, /sponsors dark-flip, /members typographic, ShowBand dark cut, /about PhotoBand the purple band cut (4608 wide), /judging PhotoBand orchid-dark native (5184). No native-limited image remains. NavCards and ticket photos are out of hero scope. The /about PhotoBand rulingNeeded flag is cleared; if its box is ever height-driven past 4608 device px (taller than 650 css at @2 or 433 at @3), A9 reports RULING NEEDED, not a pass or a clamp, and NOS Design extends y0 towards 450.

Post-mirror required device px by route and viewport, from `goldens/crop-map.json` `requiredWidth` (H = height-driven so `sizes` must exceed 100vw, ! = the file is too narrow; box heights are floors, the gate measures the real box):

| route / band (file aspect) | 2056@2 | 1440@2 | 1280@2 | 1024@2 | 1023@2 | 768@2 | 767@2 | 390@3 |
|---|---|---|---|---|---|---|---|---|
| hero /about (1.733) | 4112 | 2880 | 2560 | 2048 | 2046 | 1665H | 1534 | 1170 |
| hero /judging (2.259) | 4112 | 2880 | 2560 | 2169H | 2169H | 2169H | 1733H | 1322H |
| hero /societies (2.259) | 4112 | 2880 | 2560 | 2169H | 2169H | 2169H | 1733H | 1322H |
| hero /societies/[slug] (1.869) | 4112 | 2880 | 2560 | 2048 | 2046 | 1795H | 1534 | 1170 |
| hero /events (2.259) | 4112 | 2880 | 2560 | 2169H | 2169H | 2169H | 1733H | 1322H |
| hero /sponsors (2.929) | 4112 | 2880 | 2812H | 2812H | 2812H | 2812H | 2247H | 1714H |
| hero /contact (2.259) | 4112 | 2880 | 2560 | 2169H | 2169H | 2169H | 1733H | 1322H |
| home slide orchid-dark (1.5) | 4112 | 2880 | 2560 | 2160H | 2046 | 1536 | 1534 | 1170 |
| home slide orchid-purple-home (2.09) | 4114H | 3011H | 3011H | 3011H | 2139H | 1606H | 1604H | 1223H |
| PhotoBand /about (orchid-purple-band 700,750-5308,2050 @50% 45%) (3.545) | 4112 | 2880 | 2560 | 2269H | 2269H | 2269H | 2269H | 3403H |
| PhotoBand /judging (orchid-dark native) (1.5) | 4112 | 2880 | 2560 | 2048 | 2046 | 1536 | 1534 | 1440H |

The ShowBand table is in the ShowBand ruling row above.

ShowBand 42/58 split (NOS Design via the #92 sign-off, 2026-10-25; assertion A19): the National Show event page (`/events/[slug]`) gives the photo 42% and the copy column at least 420px above 1024, so the h2 and dates take at most 2 lines at 1440 (3 today). It lands with the dark ShowBand cut, which also fixes the soft yellow photo there. FINDING (flag cleared by NOS Design 2026-10-25: the split is on the event page ONLY): `components/home/ShowBand.tsx` is ONE shared component, used on `/` (`app/(marketing)/page.tsx:79`), `/events` (`events/page.tsx:94`, with `detailsHref`) and, once #92 merges, `/events/[slug]` (`<ShowBand show={show} />`; main has no ShowBand on the event page). Its grid is `min-[1100px]:grid-cols-[1fr_1.1fr]` (47.6% photo). The split is therefore an opt-in variant (event page only, breakpoint 1025 for the variant); `/` and `/events` keep 1fr/1.1fr, and A19 asserts that so the split cannot leak. Sequencing (SAOC correction 2026-10-25): `app/(marketing)/events/[slug]/page.tsx` already exists on main; #92 only edits it (the ShowBand goes under the h1, and the meta `<dl>` is gated on `!show`). Merge order after #76: #93 (audit), then #92, then HM-1. HM-1's branch takes #92's version by merging main once #92 lands (merge, never rebase). A4's allowlist already includes that file, scoped to the `<ShowBand ... split=...>` prop line only (any other changed line in it fails); `check-diff-scope.mjs` takes the merge-base with origin/main, so #92's lines are not counted against HM-1 after the merge. The opt-in prop is `split="event"` on `<ShowBand>`.

Event-page ShowBand cover table (file orchid-dark-showband 2400x1750, 1.3714:1; derived from the measured copy-column curve, not built; the photo box is 42% wide):

| viewport | photo box css (est.) | required device px | file | copy column css |
|---|---|---|---|---|
| 1025@2 | 430x751 | 2060 | 2400 ok | 434 |
| 1100@2 | 462x758 | 2080 | 2400 ok | 478 |
| 1280@2 | 538x688 | 1888 | 2400 ok | 582 |
| 1440@2 | 605x684 | 1877 | 2400 ok | 675 |
| 2056@2 | 864x684 | 1877 | 2400 ok | 720 (capped) |

No row fails. All are height-driven; the cut covers a box up to 875 css high at @2 (1750 / 2). The tightest copy clearance is 434px at 1025, 14px over the 420 floor, assuming the existing 80px side padding applies from 1025.

Image-sweep baseline (SAOC and NOS Design, 2026-10-25, root `comms.md` block "HM-1 served-width baseline (61 rows) + sweep script"; assertion A9 and A3 changed, A4 allowlist gains one file; table finalised, `sweep14.tablePending` false). The 61 rows are the list of things to cover, not expected values: the "sim" rows are a 3x requirement compared with a DPR-2 file, so the gate measures at a real DPR (Playwright `deviceScaleFactor` 3 on 390@3).

1. Gate. A9 asserts required = ceil(max(boxW, boxH x aspect) x DPR) <= served (naturalWidth of `currentSrc` in a bare Image) at 390@2, 390@3, 768@2, 1280@2 and 2056@2, plus 1023@2, 1024@2, 1440@2 and 767@2, for every hero, band and PhotoBand. NEW: a whole-page sweep (the same rule as NOS Design's `image-sweep.js`) runs at 390@2, 390@3, 1280@2 and 2056@2 on `/`, `/events` and the 14 hero routes: every raster img wider than 80 and taller than 60 CSS px, not svg, so the footer emblem, NavCards, YearbookStrip and the ShowBand are covered whether or not they are heroes. `goldens/crop-map.json` `sweep` holds the viewports and routes. The 14 routes: /about, /judging, /societies, /societies/[slug], /events, /sponsors, /contact, /media-kit, /constitution, /privacy, /terms, /refunds, /members, /events/submit (conditional on SF-2; the five typographic routes assert no hero photograph but are still swept).
2. Where each baseline row is resolved (post-mirror):
   - `/` home hero 390 (383x898 box, needs 2694@2 / 4041@3, served 828): the HM-1 stack at 1023 and below replaces that box with a 2/1 band (about 390x195, width-driven at 1.5:1: 780@2, 1170@3), `sizes` aspect-derived. A9 measures the real post-HM-1 band at 390@2 and 390@3; A14 asserts the stacked state.
   - /about, /societies, /judging, /events, /sponsors, /contact, /members, /media-kit, /privacy, /terms, /refunds, /constitution hero at 390: aspect-derived `sizes` (D6). Typographic routes (/privacy, /terms, /refunds, /constitution, /members, /media-kit) carry no photograph, so their rows disappear.
   - /about PhotoBand (pink, 1280@2, 2056@2, 390@3): replaced by the purple band cut (4608, 3.545:1). /judging PhotoBand (orchid-dark): quality 88 lifts the 2048 ladder (see 4).
   - /sponsors (yellow 3100) and /contact (pink 3456) at 2056@2: replaced by the dark-flip (5184) and violet-contact (4112) cuts, both at or above 4112. /members becomes typographic.
   - ShowBand on `/` and `/events` at 1280@2 (602x762, needs 2033, served 1920) and 390@3 (375x250, needs 1125): see 3.
   - NavCards on `/` at 390@3 (343x429, needs 1029, sizes `(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw`): at a real 3x, 100vw is 1170 device px, so the browser picks the 1200 candidate (>= 1029) and the row is expected to be a sim artifact. NavCards are raster imgs outside the hero boxes but inside the sweep, so A9 measures them for real. `components/home/NavCards.tsx` stays a stay-off file: if the sweep fails there, the finding is reported to the lead, not fixed in HM-1. Same for YearbookStrip (343x257, `(min-width: 1100px) 50vw, 100vw`, needs 1029).
   - Footer emblem (`components/chrome/SaocLockup.tsx`, 166x160, `sizes="166px"`, `fill`) needs 498 at @3. Next builds the srcset for a `fill` image with a non-vw `sizes` from the full width set (16 to 6144), so a real 3x asks for the smallest candidate >= 498, which is 640, and the 640 variant of the 640-wide emblem exists; the 384 in the baseline is a DPR-2 pick. By reading the code, a real @3 already reaches 640; this is NOT yet measured (A9's sweep at 390@3 measures it). If it fails, the fix is the `sizes` attribute only (A4 allows `components/chrome/SaocLockup.tsx` for `sizes=` lines only, since the lockup is shared with NOS and there is to be no visual change).
3. ShowBand (`components/home/ShowBand.tsx`). The baseline's "Yellow orchid on t.." rows (602x762 at 1280@2, 375x250 at 390@3) ARE the home and /events ShowBand photo (G9). Yellow retires and the photo becomes the `orchid-dark-showband` cut, rect `300,850 to 2700,2600` (2400x1750, 1.3714:1, NOS Design's final extension of 2026-10-25; y1 never past 2600, 18 native px clear of the stem stub); no `sizes` is tuned for yellow. The binding limit is box height x DPR <= 1750, so the cut covers a photo box up to 875 css high at @2 (and 1200 css wide). Photo `sizes` is `(min-width: 1100px) 1200px, 100vw`: in the stacked 3/2 block the box aspect (1.5) is wider than the file (1.3714), so the box is WIDTH-driven and `100vw` is right (the old `104vw` was for the 1.556 file); above 1100 `1200px` requests the cut's 2400 at @2 and covers H <= 875 (875 x 1.3714 = 1200). A3 fails a `48vw`.
   MEASURED (production build of origin/main ee2e9941, Chromium, DPR 2, read-only; `/` and `/events` identical at every viewport; box heights unchanged by the new rect since only the photo source changes). Required = ceil(max(W, H x 1.3714) x 2). No row exceeds 2400. TALLEST observed box: 762 css high on the plateau from 1276 to 1372 (first at 1276), required about 2090 (602x762 at 1280: 2090), 113 css of headroom under 875. Other side-by-side rows: 1100: 523.8x748.4, 2053; 1388: 709.3 high, 1946; 1440: 685.7x684.5, 1878; 2056: 979x684.5, 1958 (width-driven there). Stacked 768 to 1099: H = vw/1.5, width-driven, required 1536 at 768 to 2198 at 1099 (the box aspect 1.5 is wider than the file). TIGHTEST row: the stacked 1099@2 at 2198 (202 px margin); among the side-by-side rows, 2090 at 1276 to 1372 (310 px). Full 1-per-16px table: `goldens/crop-map.json` `requiredWidth.showBandRealHeight.measured.rows`.
   The row height is content-driven (copy column height plus 180 css of padding): a future copy change, a longer title or a narrower column can push the 762 peak past 875 css and the required width over 2400. A9 and A19 catch that: the run reports the tallest observed ShowBand box and fails above 875 (RULING NEEDED, never a clamp).
   NavCards: measured at a true DPR 3 by the sweep (Playwright `deviceScaleFactor` 3 at 390@3), which is where the 1029 row lives; the baseline says they pass at @2 today.
4. /judging PhotoBand ladder at 2048: cause in `components/ui/PhotoBand.tsx` (no quality 88, so `lib/image-loader.ts` keeps the 2048 cap); fix is `quality={image in heroSourceWidths ? 88 : undefined}` like PageHero. `lib/image-loader.ts` and `lib/image-widths.json` untouched. With the audit ladder (#93), 4112 at 2056@2 snaps to 4160, within native 5184.
5. Interim home P0. SAOC ships `components/home/Hero.tsx` `sizes="(max-width: 767px) 1350px, 100vw"` as a standalone PR first. HM-1's Hero.tsx change replaces that value with the aspect-derived sizes (A3 fails if `1350px` survives) and its at-or-below-1023 stack supersedes the interim fix. HM-1 merges main after that PR lands (merge, never rebase). Merge order after #76: #93 (audit), the interim P0, #92, then HM-1.
6. Harness 3.8.63 (PR #94) is auto-merging; the HM-1 branch gets it through the main merge. No spec file is harness-owned.

## 2. Findings that shaped this spec (measured on main 9378155d, production build, Chromium)

1. Baseline: served width on main already satisfied box x DPR at 2056@2, 1440@2, 768@2, 767@2 and 390@3 for every violet and purple hero route and both carousel slides, because `lib/image-loader.ts` allows `[widths <= native, native]` for a q88 hero source and snaps up (to 4096 or the native width). The single hard failure is `/sponsors`: yellow is 3100 wide, served 3100 against 4112 needed at 2056@2. The audit widths (2560/2880/4160) are a bytes win (a closer candidate than 4096 or native), not a correctness fix. NOS Design's "2048 vs 2850" is not reproducible on main: it names /about as pink and /judging as dark, where main has /about violet (7327) and /judging purple (5308). Treated as measured on an older beta build (gap G2).
2. `/contact` (pink, native 3456) and `/members` (yellow, 3100) cannot reach 4112 at 2056@2 without upscaling. They carry a `flagged` entry; A9 passes them only when the served file is the source's native width and prints `FLAG`.
3. The inner `PageHero` is a centred full-bleed photo under `bg-gradient-to-t from-[var(--primary-800)]/85 via /55 to /25` (components/ui/PageHero.tsx:44-46) with an ivory/85 lede (:56): the full wash. The HM-1 "scrim over the photo" on /sponsors, /contact, /media-kit is this one element.
4. At a 2056x480 inner box the whole source width is visible (source aspect 1.5 against box 4.3), so a horizontal `object-position` changes nothing; only a vertical position or a cut file can place a bloom on the left. Sources: dark and purple have the bloom on the right with a quiet left, violet is central (contact sheets). So "bloom left" is a NOS Design cut pick per route, not a CSS value (gap G3).
5. Home hero on main (components/home/Hero.tsx) passes per-glyph contrast at 1280 and up and FAILS at 1024 and below: lede 2.04 (dark) and 3.52 (violet) at 1024, h1 1.03 and 1.28 and lede 1.33 and 1.54 at 768, h1 1.81 and 2.51 at 767, h1 1.36 and 1.52 at 390 (ink-pixel measure, section 5). That is HS-1's bokeh behind copy, measured. Orchid-dark at 2056: h1 4.45, 1440: 4.42.
6. The audit branch is on origin (`origin/fix/audit-2026-10-25`) and NOT merged; `gh pr list --state all --head fix/audit-2026-10-25` returns no PR (gap G1). It does not touch PageHero, Hero, globals.css or hero-source-widths.json; it does edit `scripts/generate-image-variants.mjs` and `lib/image-widths.json`.
7. `.next` bytes: a plain `next build` in the trial tree passed on main and on the prototype below.

## 3. Route list (every SAOC inner hero)

All render `components/ui/PageHero.tsx`. `goldens/crop-map.json` `heroRoutes` is the machine copy.

| route | page file | source (final pick) | position | note |
|---|---|---|---|---|
| /about | app/(marketing)/about/page.tsx | orchid-violet-about (violet 2300,1100 to 7327,4000) | 0% 63% | also the PhotoBand (purple-band) |
| /judging | app/(marketing)/judging/page.tsx | orchid-purple-flip | 0% 40% | also the PhotoBand |
| /societies | app/(marketing)/societies/page.tsx | orchid-purple-flip | 0% 20% | |
| /societies/[slug] | app/(marketing)/societies/[slug]/page.tsx | orchid-violet-society (violet 0,400 to 4112,2600) | 0% 50% | slug discovered from /societies |
| /events | app/(marketing)/events/page.tsx | orchid-purple-flip | 0% 60% | main also has the ShowBand and the redesign (#89); re-read |
| /sponsors | app/(marketing)/sponsors/page.tsx | orchid-dark-flip | 0% 100% | `actions` CTA; lede gate |
| /contact | app/(marketing)/contact/page.tsx | orchid-violet-contact (violet 0,1900 to 4112,3720) | 0% 80% | NOS Design G10 answer |
| /constitution, /privacy, /terms, /refunds, /members, /media-kit | pages and (shared) pages | none | none | typographic: no `image` prop; /members is hidden and conditional |
| /events/submit | none today | n/a | n/a | probed only if it renders `[data-page-hero]` |

Home (`/`, components/home/Hero.tsx): slides orchid-dark (`0,487 to 5184,2968 @62% 50%`) then orchid-purple-home; the home ShowBand (S3 derived cut orchid-dark-showband, served-width check and the stem-stub probe) and the PhotoBand on /about and /judging are served-width scope. `lib/data/home-hero-slides.ts` carries the slides.

## 4. Decisions and file plan (with source trace per visual decision)

D1 Markup contract (the gates read these selectors; the rest is the dev's): `section[data-page-hero]` > `[data-page-hero-media]` (holds the `img`, alt="" aria-hidden) + `[data-hero-scrim="copy"][aria-hidden]` + a copy column `[data-page-hero-copy]` with `[data-page-hero-eyebrow]`, `h1`, optional `[data-page-hero-lede]`, then `actions`. The typographic variant is `variant="type"` markup: `section[data-page-hero]` with `data-page-hero-variant="type"`, no media, no scrim, no img. `image` is optional; with no image the hero is typographic.
D1b `eyebrow` is OPTIONAL (SAOC polish F4): the pill and the h1 `mt-5` render only when set. A3 checks the prop, the conditional render and no unconditional `mt-5`; A10 asserts h1 margin-top 0 on any eyebrow-less hero. The mirror dev ports it if the polish PR has not merged, and the rebase must not drop it if it has.
D2 From 768 up the photograph is full bleed (judged against 100vw); copy is left-aligned in a column starting at 52%, every element at or right of 52%. Today's centring goes.
D3 Scrim local to the copy: one `[data-hero-scrim="copy"]`, 90deg, fully transparent through 44%, ramping to sage `rgb(34 40 31 / n)` by 52%. Sage only, no new colour; `--primary-800` is #22281f. Inline style in PageHero, not a globals.css block (section 7). A10 compares the left 44% with the photograph painted alone.
D4 Below 768 the hero stacks: a 2/1 band at the top, full width, copy under it on solid `--primary-800` (rgb 34,40,31), nothing over the band. Ruled for SAOC. 767@2 serves at least 1534, 390@3 at least 1170.
D5 Lede solid ivory (`text-ivory`, no opacity; PageHero's current ivory/85 goes). Per-glyph contrast on the lightest ink pixel: lede at least 4.5, eyebrow and h1 at least 3.
D6 Served width with no exception: `sizes` computed from the file aspect (max(100vw, boxH x aspect), see the SAOC QA finding above), `quality=88` for any source in `lib/hero-source-widths.json`; the loader supplies a candidate at or above box x DPR. Never `transform: scale`, never a narrower candidate. A source narrower than its box is a gate failure, not a flag.
D7 Per-route crop: `PageHero` takes optional `imagePosition` (default `50% 50%`); a page passes `image` and `imagePosition` only (A4 checks mechanically that a page diff is those attributes).
D8 Derived hero sources (replaces the sponsors cut). New manifest `lib/hero-derived-sources.json`, one entry per golden `derived` item: name, source file, rect, flip. `scripts/generate-image-variants.mjs` reads it, extracts the rect with sharp, applies `.flop()` when `flip` is true, and emits the variants named `<name>.jpg-<w>-q88.webp` (the loader's existing naming) plus the `lib/hero-source-widths.json` entry at the rect width. No cut JPEG is committed and there is no CSS flip. Entries: `orchid-purple-flip`, `orchid-dark-flip`, `orchid-purple-home`, `orchid-violet-contact`, `orchid-violet-about`, `orchid-violet-society`, `orchid-purple-band`, `orchid-dark-showband`. A8 verifies each built variant against a sharp cut of the original.
D9 HS-2: `components/home/Hero.tsx` `alt={slide.alt}` becomes `alt=""`; `slide.alt` stays for the group `aria-label` and the dot labels.
D10 Home carousel: slides orchid-dark then orchid-purple-home (violet retires). At 1023 and below the home hero stacks (2/1 band first, copy on solid sage); at 1024-1279 the 270deg scrim narrows to the copy block. If the dark slide fails per glyph at 1024-1279 the stack extends to 1279. A13 and A14 report the breakpoint; no mixed state is allowed across 1024-1279.
D11 PhotoBand gets `data-photo-band` on its figure, `quality={88}` and an optional `imagePosition` (object-position). /about takes `orchid-purple-band` (`700,750 to 5308,2050`, 4608x1300, 3.545:1) at `50% 45%`; /judging stays `orchid-dark.jpg` native. Home purple is NOT this cut: it is `orchid-purple-home` (`408,560 to 5308,2904`, 4900x2344, 2.09:1). ShowBand gets `data-show-band-image` on its image wrapper and the `orchid-dark-showband` derived cut (replaces orchid-yellow at ShowBand.tsx:110, `object-cover` at 50% 50%, `sizes` unchanged).

File plan (paths on the dev's fresh worktree; line numbers shift, re-read):

| file | change |
|---|---|
| components/ui/PageHero.tsx | rewrite per D1-D7; optional `image`, `imagePosition`, `eyebrow`; typographic variant; keep the `heroSourceWidths` import |
| components/nos/LegalHero.tsx (#76) | the SAOC branch passes no `image` (typographic); image lines only |
| app/(shared)/privacy, terms, refunds pages | drop `image`, if still passed (depends on #76; image lines only) |
| app/(marketing)/constitution, members, media-kit pages | drop `image` (typographic) |
| app/(marketing)/{about,judging,societies,events,sponsors,contact}/page.tsx, societies/[slug]/page.tsx | `image` / `imagePosition` lines only, to the golden |
| components/home/Hero.tsx, lib/data/home-hero-slides.ts | alt (D9), slides dark then purple-home, stack at the breakpoint the gate reports (D10) |
| components/ui/PhotoBand.tsx, the home ShowBand component | D11 |
| lib/hero-derived-sources.json | new, from the golden |
| scripts/generate-image-variants.mjs | read the manifest, `.extract`, `.flop`, emit `<name>.jpg-<w>-q88.webp`, widths entry; HERO_SOURCES no longer restricted to one entry |
| lib/hero-source-widths.json | derived names at their rect widths |
| docs/components.md, docs/saoc-pagehero-mirror.md | props, markup contract, rulings, gaps |

Removed from the earlier plan: `public/images/nos-hero-saoc-sponsors.jpg` and `check-cut.mjs` (replaced by `check-derived.mjs`).

## 5. The gates and how the nos-pagehero checks were re-synced

Run from the repo root of the dev's worktree; each gate starts its own `next start` (ports 3081+) on the A7 build with the wall up and `SHOW_PLACEHOLDER_PREVIEW=true`, and uses the host `saoc.localhost`.

| nos-pagehero check | here | change |
|---|---|---|
| `_lib.mjs` (server, launcher, collector, discovery) | `checks/_lib.mjs` | SAOC host and ports; SAOC golden; adds pixel helpers (mean abs diff, mean colour, ink-pixel contrast) |
| `build.sh` | `checks/build.sh` | CI env from the lead (project id 26yfbug4, dataset production) with the env-overridable defaults, instead of reading apphosting.yaml |
| `gate-served-width.mjs` (`currentSrc` through a bare `new Image()`) | `checks/gate-served-width.mjs` | SAOC routes and home slides; viewports 2056@2, 1440@2, 1280@2, 767@2, 390@3; NO native-cap exception, no flag path; type routes assert no img; bands and home slides included |
| `gate-hero-geometry.mjs` | `checks/gate-geometry.mjs` | different composition: full-bleed photo, copy from 52%, bloom side pixel-equal to the bare photograph, 2/1 band below 768 (NOS G2 re-used), object-position equals the golden |
| conditional routes (`NOT PROBED (stated reason)`, nos spec section 10.1) | `openHeroRoute` in _lib | /media-kit (gated), /members, /events/submit |
| `check-static.mjs`, `check-diff-scope.mjs` | `checks/check-static.mjs`, `checks/check-diff-scope.mjs` | SAOC rules; scope against the merge-base; no new custom property or colour |
| crop pixel check (mirror-pr-notes.md) | `checks/check-derived.mjs` | derived sources: manifest equals golden, rects in bounds, probe pixels (clip, stake, hardware) at most 40, built variant W x H, mean abs diff <= 4, PSNR >= 33, flip real |
| CI e2e step (A12 in nos) | A17 | unchanged |
| `gate-frame-log.mjs`, `gate-target-size.mjs` | not re-synced | SAOC heroes are server-rendered with no loader frame, and target size is the polish wave's (TG-1) |

New here: `gate-contrast.mjs`, `gate-home.mjs`, `check-derived.mjs`, `check-shots.mjs`, `check-crops-final.mjs`. Contrast viewports: 2056, 1440, 1280, 1279, 1152, 1024, 1023, 767, 390. Shots: 1280, 2056, 390.

Contrast method (A11-A13): for each glyph the gate takes the ink pixels (painted hero minus the same hero with every glyph transparent, so the pill fill, the scrim and the photograph are what the ink sits on), scores each ink pixel as glyph colour against the background pixel under it with the WCAG formula, and takes the 0.5th-percentile pixel as that glyph's worst case; the worst glyph per kind is gated. Whole line-boxes are not sampled (they are 107px tall at the home h1 and would score the photograph above and below the letters). Lede must also be painted at alpha 1 through every ancestor.

Proof status: before the final rulings, A9-A13 ran against a throwaway prototype and passed. The rewritten gate-geometry, gate-home, gate-served-width, check-derived, check-static and check-diff-scope have passed `node --check` only; the dev's first run proves them and may need small fixes to the checks (report them, do not weaken a threshold). check-derived thresholds were calibrated on orchid-dark-flip (webp q78 vs raw cut: mean abs diff 2.59, PSNR 36.8; q88: 1.72, 40.5).

## 6. Pending inputs (named, not guessed)

- Nothing is pending. G9 answered 2026-10-25: orchid-dark-showband derived cut. Measured box finding: ShowBand.tsx on main (identical on origin/main 962047dc) lays the image out as a grid column of 1fr against 1.1fr from 1100 CSS (47.6% of the viewport, min height 620) and as a full-width 3/2 block below 1100. NOS Design's about 1960x1240 was device px, so about 979x620 CSS at 2056. Derived by arithmetic from the source, not measured in a browser; A9 measures the real box at build.
- Contact sheets used for the picks: `.tmp/sandbox/saoc-carousel-contact-sheet/` and `.tmp/sandbox/saoc-inner-contact-sheet/` (manifests named in A16).

## 7. Overlaps with SAOC lanes (named, not resolved here)

- `components/ui/PageHero.tsx` is the file that renders the eyebrow (and F4 makes it optional, D1b): the polish wave's "sponsors eyebrow / 390 alignment" item lands in it or in sponsors/page.tsx. The mirror owns PageHero's body (D1-D5); the polish item must be sent to the mirror dev or rebased after it, and the sponsors `actions` CTA (page.tsx:70-79) stays.
- `app/(marketing)/sponsors/page.tsx`: the mirror edits the image line (:66); the polish wave's sponsors item and the /sponsors scrim/contrast gate are in the same file.
- `app/(marketing)/contact/page.tsx` and `societies/[slug]/page.tsx`: TG-1 target-size edits touch the same files; the mirror touches them only by `image`/`imagePosition` lines, and only if a pick differs from the default.
- `app/globals.css`: #83/#84 focus CSS lives there (`main:focus`, `[data-route-focus]`, :161-165). Put the scrim inline in PageHero to avoid a second edit; A4 forbids new custom properties.
- `scripts/generate-image-variants.mjs` and `lib/hero-source-widths.json`: the audit branch edits the generator and #76 also adds entries. The mirror now adds a manifest-driven step (D8), a larger edit than one line; rebase after both.
- `components/nos/LegalHero.tsx` and `app/(shared)/privacy|terms|refunds/page.tsx` (#76): the SAOC branch must render the typographic PageHero. The mirror edits image lines only; sequence after #76 or rebase.
- Since baseline, #86 (legal pages verbatim) and #89 (/events redesign: purple and ShowBand) have merged (main 962047dc); the dev re-reads constitution, privacy, terms and events.
- PhotoBand.tsx and the home ShowBand are shared with the SAOC polish wave only by `data-` hooks and the image source.
- Off limits and untouched: Header.tsx, nav, NewsletterSignup.tsx, YearbookStrip, events/submit, event detail except the one ShowBand split prop line, societies components (A4 fails any change).

## 8. Named gaps

G1 The audit branch is not merged and has no PR; A2 blocks the dev until it merges (the lead is re-checking at 98e6636c).
G2 HM-1's "/about pink and /judging dark serve 2048 vs 2850" does not reproduce on main (/about violet, /judging purple, both at or above the box). NOS Design to confirm which build was measured.
G7 A10 logs a 768-1023 h1 line count, it does not fail it.
G8 `gate-frame-log` and `gate-target-size` are not re-synced (SAOC heroes have no loader frame; target size is the polish wave's).
Closed: G10, G11 (NOS Design 2026-10-25: /contact @0% 80%, /media-kit typographic), C1 (y1 2560), G3 (inner picks made), G4 (no flags: /contact violet, /members typographic), G5 (the unflipped sponsors cut is rejected; the flip is gated by A8 and A11), G6 (2/1 band ruled for SAOC).
Assumptions: the typographic ground is `--primary-800` (the same sage as the stacked panel); "home PhotoBand" is the PhotoBand on /about and /judging.
G9 closed: ruled as the orchid-dark-showband derived cut. Residual: viewports wider than about 2520 CSS at DPR 2 (ShowBand column over 1200 CSS) would need a wider rect; not gated.

# SAOC inner heroes (mission saoc-inner-heroes, HM-1 to HM-4)

NOS Design rulings of 2026-10-26 applied to the SAOC route heroes and the home carousel. Contract and goldens: `.agent/memory/project/specs/saoc-inner-heroes/`.

## PageHero

`components/ui/PageHero.tsx` markup contract (the gates read these):

- `section[data-page-hero]` > `[data-page-hero-media]` (the `img`, `alt=""`) + `[data-hero-scrim="copy"][aria-hidden]` + `[data-page-hero-copy]` holding `[data-page-hero-eyebrow]` (optional), `h1`, `[data-page-hero-lede]` (optional), then `actions`.
- From 768px: full-bleed photograph, copy left-aligned from 52%, scrim clear through 44% and sage `rgb(34 40 31 / 0.8)` from 52%. Nothing paints over the bloom side.
- Below 768px: a 2/1 band, copy under it on solid `--primary-800`, no scrim.
- No `image`: the typographic hero (`data-page-hero-variant="type"`), solid sage, no media or scrim. `/members`, `/privacy`, `/terms`, `/refunds`, `/memorandum-of-incorporation`, `/media-kit` use it; legal pages pass no eyebrow.
- `sizes` is derived from the file aspect (`heroSourceAspect` in `lib/data/saoc-hero-photos.ts`): `max(100vw, 480px x aspect)` wide, `max(100vw, calc(50vw x aspect))` stacked. Never a bare `100vw`.

## Per-route crop

`lib/data/saoc-hero-photos.ts` is the one map (photograph, `objectPosition`, or `typographic: true`). `RouteHero` applies it; pages are not edited for crop. `/404`, `/events/[slug]` and `/events/submit` have no ruled crop and keep their photograph.

## Derived cuts

`lib/hero-derived-sources.json` lists each cut (rect of an original, optional flip). `scripts/generate-image-variants.mjs` extracts the rect with sharp, mirrors with `.flop()` when `flip` is true, and writes `public/images/_opt/<name>.jpg-<w>-q88.webp` (gitignored). `lib/hero-source-widths.json` lists `/images/<name>.jpg` at the rect width. There is no cut JPEG in git and no CSS flip. Adding a cut: manifest entry, widths entry, then reference `/images/<name>.jpg`.

## Home

Slides: orchid-dark then orchid-purple-home (derived), `alt=""`. At 1023px and below the hero stacks (2/1 band, copy on solid sage); from 1024px the scrim covers the copy column only. The slow drift animates `object-position` instead of `transform: scale`, because a scaled `img` outgrew the viewport (the "overscan") and the served-width gate measures the box.

## ShowBand

Uses the `orchid-dark-showband` cut. `split="event"` (event page only) gives the photo 42% from 1025px; the home page and `/events` keep 1fr/1.1fr.

## Known gaps

`/about` has no PhotoBand (removed by #109), so `orchid-purple-band` is built but unused. `/judging` PhotoBand now uses `orchid-dark.jpg`; its alt reads "Dark orchid on the show bench".

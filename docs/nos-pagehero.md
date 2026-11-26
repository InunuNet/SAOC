# NOS inner hero: split studio panel (PR-B)

Mission `nos-pagehero`, spec `.agent/memory/project/specs/nos-pagehero/` (NOS Design NH1-NH4, the WOSA-jump ruling, FQ7, PR-B inputs of 2026-10-24).

## What it does

- `NosHero` (inner) renders the split studio panel from 768px: copy on solid `#0B0A14` at the left, a photo panel 46% wide flush right at full hero height (hard edge, 16px bottom-left radius only, no scrim, no filter, no transform). Below 768px a full-width `aspect-ratio: 2 / 1` band leads and the copy follows on black. The hub (`titleSize="display"`) keeps its full-bleed hero.
- The copy column is top-anchored, never centred. The hero height is content-driven (PG-1): from 768px `min-height` is `clamp(320px, 22vw, 380px)` with `padding-block: clamp(48px, 4vw, 72px)`; below 768px there is no floor and the copy follows the band at `padding-block: 32px`. A longer lede grows the hero downward only, so the loader (the same `NosHero`) and the page put the h1 and the sub-nav in the same place. Root cause of the WOSA jump: `align-content: center` on `.nos-hero-inner`.
- Seven crops, cut from the original photographs to `public/images/nos-hero-<code>.jpg` (rects in `goldens/crop-map.json`), listed in `lib/hero-source-widths.json` and the `HERO_SOURCES` set of `scripts/generate-image-variants.mjs`, so they are served from the q88 set up to their native width. `components/nos/hero-photos.ts` maps each internal route to a crop code; `heroCropFor()` resolves by longest path prefix, so `/vendors/apply` inherits `/vendors` and `/tickets/<slug>`, `/tickets/confirmation` and `/tickets/cancelled` inherit `/tickets`. No crop is used twice within a menu group. A route with no crop gets the typographic hero (same min-height, top-anchored copy, no panel).
- `NosHero` takes an optional `eyebrow`, rendered first in the copy column (`data-nos-hero-eyebrow`) only where the page already has the string ("Legal" on privacy, terms, refunds and the newsletter unsubscribe page).
- `components/nos/LegalHero.tsx` renders the NOS hero on the NOS host and the SAOC `PageHero` on the SAOC host for the three shared legal pages.
- FQ7: the first block after the sub-nav (or after the hero where there is no sub-nav) has 64px of top padding from 1024px and up, 48px below 1024px. The sub-nav's bottom hairline is gone.
- `/symposium`: the Presenters `h2` is serif 32px / 300; the TBC pill became a quiet `※` legend line (`data-presenters-legend`), withheld in public mode exactly as the pill was.
- The `/tickets` fan masthead is unchanged. `/tickets/[slug]` no longer uses the compact buy hero (`nk-hero-compact`): it is the split hero with the S3a crop.

## One height per breakpoint (nos-hero-consistency, 25 Nov 2026)

Brad's ruling replaces the content-driven height and the 46% panel above. Spec and checks:
`.agent/memory/project/specs/nos-hero-consistency/`.

- `NosHero` (inner) splits its copy into a title block (`.nos-hero-head`: eyebrow, crumbs, h1) and a detail block
  (`.nos-hero-detail`: lede, facts, actions).
- From 1024px the hero is `max(420px, 29.3vw)` tall (the SAOC `PageHero` height) with `padding-block:
  clamp(32px, 2.5vw, 48px)`. The whole copy sits inside it; the lede fills the copy column (`max-width: none`,
  replacing R71's 46ch) and a three-fact row is one row.
- From 768px to 1023px the hero box is one 320px row with the title block over the photo. Below 768px a 2:1 photo
  band leads and the title block follows at a fixed height. In both, the detail block sits under the hero on the
  page ground, in ink with muted labels.
- Superseded on 26 Nov 2026 (Brad: "Where is the same system we use to fix the heroes on SAOC?"): the inner hero
  is the SAOC interior hero system, mirrored. From 768px the photograph is full bleed through PageHero's
  `HeroPicture` with aspect-driven `sizes`; nothing masks it. The copy column (left, ending at 48% of the width, or
  `axis + 570px` where that is wider) sits on an overlay scrim from `lib/interior-hero.ts` in the NOS ink: 0.8 over
  the copy, then the SAOC home hero's eased tail to clear over 22%, so the bloom side is the bare photograph and no
  seam or band shows. The box is locked (`height`, not `min-height`). The 768-1023 58/42 split panel is gone.
- The photographs are full-width 2:1 cuts of their originals at native resolution (S3a and D1 mirrored so the bloom
  sits right of the copy). A full-bleed box is wider than the old panel, so the flowers render 1.4-1.8x larger than
  on 25 Nov; a real zoom-out needs larger originals.
- Scope: photo heroes only. A typographic hero (404, `/tickets/recover`) keeps its content-fit height, and
  `/tickets` keeps its fan masthead, like the hub (lead rulings, 25 Nov 2026).
- The Contact hero has the shared facts strip: Dates and Venue from the show facts, and Email (a mailto link).
- `NosHeader`: a nav group with exactly one link (Vendors today) renders as a plain link to that page, labelled
  with the group heading, in the top row and the menu panel.

## Known measurement limits (preview mode only)

The geometry gate measures the first text element after the sub-nav. In preview mode the first block of several pages is a padded placeholder box or marker chip (for example `.nos-surface`, the AI-placeholder notice, `inline-flex` status chips), so the measured gap is 64px plus that box's own padding. The block itself starts at 64px.

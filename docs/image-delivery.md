# Image delivery

Firebase App Hosting's Next adapter forces `images.unoptimized = true` unless a custom loader is set, which leaves no
`/_next/image` route and no srcset. So `next.config.ts` sets `images.loader: 'custom'` with
`lib/image-loader.ts`, and `scripts/generate-image-variants.mjs` (run by `pnpm dev` and `pnpm build`) pre-generates
every WebP candidate the loader can return into `public/images/_opt` (gitignored build output).

## Widths

`lib/image-widths.json` holds `deviceSizes` and `imageSizes`. Every image is capped at 2048 px, except the five
full-bleed hero photographs in `lib/hero-source-widths.json` (orchid-dark, -pink, -violet, -purple, -yellow), which
are served at `quality={88}` up to their own native width and never upscaled.

`deviceSizes` above 2048 are `2560, 2880, 4160, 5120, 6144`. The first three exist so a hero never serves more than its
viewport needs (audit-fixes-2026-10-25):

| viewport | box x DPR | served candidate |
|---|---|---|
| 2056@2 | 4112 px | 4160 (native width where the photograph is narrower) |
| 1440@2 | 2880 px | 2880 |
| 1280@2 | 2560 px | 2560 |
| 390@3 | 1170 px | 1200 |

Served width at those four viewports is at least `min(box x DPR, native width)` for all five heroes (NOS Design gate,
Brad P0). That gate is never traded for bytes: `check-hero-bytes.mts viewports` reads the real pixel width from the file.

## Quality

The loader keeps the `-q88` file name for the hero set, so call sites that pass `quality={88}` are unchanged. The files
at or below 2048 px are encoded at WebP q72 (`HERO_WEBP_QUALITY`; the `-q88` name is the hero set's key, not its encoding quality). The files above 2048 px keep the name but are encoded at WebP q78
(`HERO_LARGE_WEBP_QUALITY` in the generator): a q88 encoding of the grainy purple photograph weighed 4.7 MB at its native
width and was larger than its JPEG source. q78 sits inside NOS Design's q75-82 band. The hero WebP up to 2048 px is q72 per goldens/lcp-measure.md call 3.
`bloom-crops.mts` keeps an 800x800 1:1 crop at 2056@2 of every hero under
`.agent/memory/project/specs/audit-fixes-2026-10-25/artifacts/bloom-crops/` for a banding and blocking review.

## Regenerating

The generator skips a variant whose file is newer than its source, so a quality change does not re-encode on its own.
After changing a quality constant, touch the source photographs (or delete the affected files in `public/images/_opt`)
and rerun `node scripts/generate-image-variants.mjs`.

## Checks

`contracts/checks/audit-fixes-2026-10-25/check-hero-bytes.mts budget|viewports`, `bloom-crops.mts write|check`,
`contracts/checks/launch-weekend/f5/check-f-config.mjs` (pins the allowed widths above 2048) and
`scripts/checks/hero-render-check.mjs` (naturalWidth at 2056@2 in a real browser).

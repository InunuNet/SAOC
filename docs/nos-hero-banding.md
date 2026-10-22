# NOS home hero banding (rHB)

Brad reported banding in the desktop home hero: stepped bands and stripes through the blurred photo and the scrim in the hero's bottom third. This change follows Codi's final ruling (relayed by the lead on 2026-10-22). Rules: [`docs/rules/no-invention.md`](rules/no-invention.md). Design source: `design/design_handoff_saoc/design_system_README.md` l.125 (the dark sage diagonal plus a bone-to-transparent pull at the bottom).

## What was found

- `components/home/Hero.tsx` takes its slides from Sanity `homePage.heroImages` whenever any exist. `lib/data/heroImages.ts` is only the static fallback. Sanity slides go through `lib/image-loader.ts`, which sends `q` from the Image `quality` prop (default 75) with `auto=format`.
- The next section, `components/home/MissionBlock.tsx:42`, is `bg-parchment`. `--parchment` is `#f4f3ec` (244 243 236), not `--bone` (`#e8e6dc`). The old pull ended on `--bone`, leaving a seam of 16-17 levels at the hero/MissionBlock boundary.
- The Sanity yellow orchid asset (`a620a97f`) is starved: about 0.5 bits per delivered pixel, so it contours whatever quality is requested. Pink is the closest kept slide to that line.

## What was built

### Hero quality

The hero slide `<Image>` alone passes `quality={88}` (`components/home/Hero.tsx`). On Sanity slides the loader sends `q=88` to the CDN. No other `quality` prop was added anywhere.

### Static fallback variants

The same three source files (violet, pink, dark) feed ten other surfaces through the same variant names, so re-encoding them in place at q88 would move every other image off 75. Instead:

- `lib/image-loader.ts` adds a `-q<quality>` suffix to the variant name when a quality other than `DEFAULT_QUALITY` (75) is requested. Requests without a quality prop map to the same file as before, byte-identical.
- `scripts/generate-image-variants.mjs` writes an extra `-q88` set for `HERO_SOURCES` (the fallback's three files) with `{ quality: 88, smartSubsample: true }`. Every other variant stays `{ quality: 75 }`.
- No 2560 hero variant was added. It was optional in the ruling, and widths stay capped at 2048 by `lib/image-widths.json`.

### Yellow out of the fallback

`orchid-yellow` is removed from the static fallback in `lib/data/heroImages.ts`, replaced by a comment that it returns when a high-quality original arrives. `public/images/orchid-yellow.jpg` stays because other pages use it. Violet, pink and dark keep their order. The Sanity asset `a620a97f` is removed from the live rotation in Sanity by the lead after this is live; shipped code never names it. Dots, slide labels and the autoplay modulus already read `slides.length`, so three slides need no code change.

### Scrim (`app/globals.css`)

- The veil eases out over five stops instead of one 0.84 to 0 ramp. At 768px and up these are Codi's exact stops: 0.62 at 74%, 0.34 at 86%, 0.12 at 94%, 0 at 100%.
- Below 768px the tail is derived, not invented: Codi's desktop tail mapped proportionally onto the mobile shoulder (70%, 0.86), position = 70 + 30 x (p - 62) / 38 and alpha = 0.86 x a / 0.84, rounded to whole percents and 2 decimals. The result is 0.63 at 79%, 0.35 at 89%, 0.12 at 95%, 0 at 100%.
- The bottom pull now ends on `var(--parchment)`, MissionBlock's ground, with Codi's stops (alpha 0.82, 0.5, 0.2, 0 at 16, 36, 56, 72px) written in parchment's own channels.
- The diagonal is unchanged. No dither, noise or filter layer was added.

## Verification

The rendered checks run against a local build with `checks/hero-filter.cjs` preloaded. That is test-only: it drops array elements naming `a620a97f` from `*.sanity.io` responses so the live dataset renders with three slides, as it will once yellow is removed in Sanity. It is never shipped.

Known open risk (Codi's call): the pull still starts at 72px with an alpha slope of 0.0125/px against 0.0139/px before, so a faint onset kink about 72 CSS px above the hero's bottom edge remains at about 90% of its previous strength.

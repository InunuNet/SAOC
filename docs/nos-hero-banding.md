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
- `scripts/generate-image-variants.mjs` writes an extra `-q88` set for `HERO_SOURCES` (the fallback's three files) with `{ quality: 72, smartSubsample: true }` (q78 above 2048 px; the `-q88` name is the set's key, not its quality). Every other variant stays `{ quality: 75 }`.
- No 2560 hero variant was added. It was optional in the ruling, and widths stay capped at 2048 by `lib/image-widths.json`.

### Yellow out of the fallback

`orchid-yellow` is removed from the static fallback in `lib/data/heroImages.ts`, replaced by a comment that it returns when a high-quality original arrives. `public/images/orchid-yellow.jpg` stays because other pages use it. Violet, pink and dark keep their order. The Sanity asset `a620a97f` is removed from the live rotation in Sanity by the lead after this is live; shipped code never names it. Dots, slide labels and the autoplay modulus already read `slides.length`, so three slides need no code change.

### Scrim (`app/globals.css`)

- The veil eases out over five stops instead of one 0.84 to 0 ramp. At 768px and up these are Codi's exact stops: 0.62 at 74%, 0.34 at 86%, 0.12 at 94%, 0 at 100%.
- Below 768px the tail is derived, not invented: Codi's desktop tail mapped proportionally onto the mobile shoulder (70%, 0.86), position = 70 + 30 x (p - 62) / 38 and alpha = 0.86 x a / 0.84, rounded to whole percents and 2 decimals. The result is 0.63 at 79%, 0.35 at 89%, 0.12 at 95%, 0 at 100%.
- The bottom pull now ends on `var(--parchment)`, MissionBlock's ground, with Codi's stops (alpha 0.82, 0.5, 0.2, 0 at 16, 36, 56, 72px) written in parchment's own channels.
- Codi's amendment eases the pull in at its top. Above 56px the alpha follows 0.2 (u/28)^2, where u is the distance up from 84px, quantised to whole 1/255 steps every 4px (0.1451 at 60px down to 0.0039 at 80px, 0 at 84px), so the top edge reads as no line. This replaces the faint onset kink of the original 72px stop.
- The diagonal is unchanged. No dither, noise or filter layer was added.

## Verification

The rendered checks run against a local build with `checks/hero-filter.cjs` preloaded. That is test-only: it drops array elements naming `a620a97f` from `*.sanity.io` responses so the live dataset renders with three slides, as it will once yellow is removed in Sanity. It is never shipped.

## rPL: longer parchment pull (2026-10-22)

Codi (P3 after rHB): on slide 3 the dark spotted orchid darkened and then lifted to parchment within about 60px, which read faintly as a fog bar. Every stop of the `[data-hero-scrim='bone']` pull in `app/globals.css` is now 1.5x rHB's (0.2 alpha at 84px, the 1/255 ease-in steps 6px apart, transparent at 126px), with the same alphas.

- A 2x trial (top at 168px) removed the fog bar too, but the haze reached the carousel pager and the dots fell from 3.11:1 to 2.30-2.46:1 against the hero behind them, under the 3:1 of WCAG 1.4.11. Codi accepted that drop as a guard failure and chose 1.5x.
- At 1.5x the dots measure 3.11:1 at 1280 and 3.06:1 at 390 (worst slide, worst dot), against 3.11:1 for rHB's pull.
- rHB's rendered metrics (band step, seam, copy contrast, slides and autoplay) pass unchanged on public and preview builds.
- The pull now runs past the hero section's 96px bottom padding, over the image; nothing interactive sits in that strip.
- Checks: `.agent/memory/project/specs/nos-hero-pull/` (contract A1-A5). Its nonreg baseline was re-captured on main 62dd9f63, so it no longer flags pages changed by r45, rFT, rFE and the newsletter.

## rHB2: smootherstep pull (2026-10-22)

Brad still saw banding after rHB and rPL: on slide 3 (and slide 4) at about 2000px wide, the bottom of the hero went violet, then a
flat grey-lilac stripe, then parchment.

- **Cause:** Mach bands at the pull's slope breaks, not a colour step. The pull's alpha slope changed abruptly at its stop joints and
  dropped straight to zero at the seam into MissionBlock. Rendered alone over flat violet, the pull reproduced both lines at full
  width: L* slope breaks of 0.41/px at the seam and 0.18/px at the 24px stop. Brad's capture measures 0.48 and 0.18 at the same rows.
  The photo, the veil and the diagonal measured 0.02 or less, and there was no 8-bit quantisation. Translucent parchment over
  saturated violet does pass near-neutral (chroma 0.042 to 0.005), but it only reads as grey because the two lines frame it.
- **Why the rHB check missed it:** it measured row-mean steps (C0) only, and a slope break has no step. It never checked the slope at
  the seam or the 24px joint, and no viewport went above 1920px.
- **Fix:** every stop of `[data-hero-scrim='bone']` follows a 24-segment smootherstep, alpha = 1 - (6p^5 - 15p^4 + 10p^3) with p the
  distance above the seam over 126px. It is sized as a `100% 126px` background tile anchored at the bottom, so the percentage stops
  scale with the tile. CSS interpolates linearly between stops, so this is a 24-segment piecewise-linear sample of the curve, not
  an exact C1 curve: the end segments are nearly flat (alpha moves 0.0007 over the first and last 5.25px), and adjacent slopes
  change by at most 12.9% of the peak, inside Codi's 20% limit. Every stop is `rgb(244 243 236 / a)`, so there is no new colour.
- **Why the height clamp was dropped:** Codi first asked for `clamp(126px, 9vw, 220px)`. The pager dots sit about 110-120px above
  the seam at every width, so any taller pull puts parchment behind them, and at 2000px and wider they fell to 1.0-1.9:1. Codi chose
  the fixed 126px.
- **Measured** (public and preview, 4 slides, 1280@1, 2056@2, 390@3, 2000@1, 2560@1): the full-width slope break is 0.10-0.25 L*/px
  (was 0.27-0.55), the seam slope is 0.022 or less (was 0.31-0.52), copy contrast stays at 5.57:1 or better, and the dots stay
  no worse than before (2.48-3.35:1). Some slides were already under 3:1 before this change; that is a separate ticket.
- Checks: `.agent/memory/project/specs/nos-hero-banding-2/` (contract A1-A7). `--guard` keeps the old pull failing on preview
  2056@2, and `brad.mjs` keeps Brad's own capture failing the metric.

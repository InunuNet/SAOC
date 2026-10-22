# rHB: home hero banding (nos-hero-banding F1)

Source: Codi's FINAL ruling with his re-ruling, relayed by the lead saoc-82 on 2026-10-22. Brad: "There is banding in the hero image
looks shit." The banding is in the desktop home hero's bottom third: stepped bands and stripes through the blurred photo and the scrim.
BASE is origin/main `1a7479f1` (r20 merged; the spec was first written on 7fb251a1, and r20 touched none of the five footprint files, so
every BASE line number below holds on both). Rules: docs/rules/no-invention.md. Design source: design/design_handoff_saoc/design_system_README.md
l.125 (the dark sage diagonal, plus a bone-to-transparent pull at the bottom).

## Facts (measured on BASE)

- `components/home/Hero.tsx` takes its slides from Sanity `homePage.heroImages` whenever any exist. `lib/data/heroImages.ts` is only
  the static fallback. Sanity slides go through `lib/image-loader.ts`, which sends `q` from the Image `quality` prop (else 75) with
  `auto=format`. Chrome receives AVIF.
- The next section is `components/home/MissionBlock.tsx:42`, `<section className="py-24 bg-parchment">`. **--parchment is #f4f3ec
  (244 243 236), not --bone (#e8e6dc).** BASE's pull ends on --bone, so the hero's last row is 12-16 levels off the "Our purpose" ground.
  That seam is measured at 16-17 levels (row mean, max channel) on every slide. Per the ruling the pull now ends on `var(--parchment)`,
  and its alpha stops use parchment's own value, rgb(244 243 236 / a).
- Dots, slide labels and the autoplay modulus already read `slides.length` (Hero.tsx:71, :88, :179-183). The dot labels are
  "Show slide n", the slide labels "n of N", and the autoplay interval is CAROUSEL_INTERVAL_MS. Item 4 of the ruling needs no edit, and
  f1-rendered R5 proves it with 3 slides.
- The same three source files (violet, pink, dark) feed ten other surfaces through the same variant names: NavCards, PageHeader images,
  NOS hero photos, ticket cards, not-found. Re-encoding them in place at q88 would move every other image off 75. So the hero's
  `quality={88}` selects a separate `-q88` variant set through the loader, and every request without a quality prop keeps BASE's file,
  byte-identical.

## Edits (exact, BASE numbering: goldens/f1-edits.json)

| file | change |
|---|---|
| components/home/Hero.tsx:101 | `quality={88}` on the slide `<Image>` only |
| lib/data/heroImages.ts:4 | the orchid-yellow entry becomes a comment that it returns with a high-quality original. Violet, pink, dark keep their order. public/images/orchid-yellow.jpg stays |
| lib/image-loader.ts:31 | a quality other than DEFAULT_QUALITY (75) maps `/images/x.jpg` to `x.jpg-<w>-q<quality>.webp`. The Sanity branch already sends `q` |
| scripts/generate-image-variants.mjs:12, 44, 45, 57 | HERO_SOURCES (the fallback's three files) also get a `-q88` set, written with `{ quality: 88, smartSubsample: true }`. Every other variant stays `{ quality: 75 }` |
| app/globals.css:356, 365, 374, 379 | the comment, the <768 veil tail, the >=768 veil tail (Codi's exact stops), the pull on --parchment with Codi's stops. The diagonal is unchanged. No dither, noise or filter layer |

**The <768 veil tail is derived, not invented.** Codi's desktop tail is mapped proportionally onto the mobile shoulder (70%, 0.86). A
stop's position becomes 70 + 30 x (p - 62) / 38, and its alpha becomes 0.86 x a / 0.84. Positions round to the whole percent and alphas
to 2 decimals:

| stop | position | alpha |
|---|---|---|
| 74% | 79.47 -> 79% | 0.62 -> 0.635 -> 0.63 |
| 86% | 88.95 -> 89% | 0.34 -> 0.348 -> 0.35 |
| 94% | 95.26 -> 95% | 0.12 -> 0.123 -> 0.12 |
| 100% | 100% | 0 |

**Not done, by the ruling:**
- The lead removes yellow from the live rotation in Sanity after rHB is live. Shipped code never names asset a620a97f (S7).
- No 2560 hero variant. It was optional, and widths stay capped at 2048 by lib/image-widths.json, so no LCP measurement was needed.
- No upscale, denoise or blur of any asset. No change to the slide order.

## Band metric (f1-rendered R2) and calibration (goldens/f1-calibration.json)

The region is the hero's bottom third through 8 CSS px into MissionBlock. The copy is hidden for the capture (visibility only), and every
slide is made active by its dot. Viewports are 1440 and 1920 at DPR 1 and 2, in both the public and preview builds.

- **R2a step.** The maximum jump of the per-row mean colour (any channel, 0-255) between adjacent device rows must be at most **6**. A
  horizontally coherent band edge, stripe or seam moves the whole row mean. Photo texture and Chrome's ±1 ordered gradient dither average
  out. That dither is why the "identical-row run" form was rejected: Chrome dithers every gradient, and the mean run is 1.1 px everywhere.
- **R2b starvation.** Source bytes x 8 / delivered pixels must be at least **1.0**. A source with fewer bits than the pixels it is
  stretched over contours (rings) in smooth areas whatever q is requested. This is the measure that singles out yellow. Rendered pixel
  metrics did not single it out: row runs, isolated plateau steps, tile posterization and faint-line density were all tried, and photo
  texture swamps the contour signal.

| measure | BASE (yellow kept) | golden fix simulated on BASE |
|---|---|---|
| R2a step | 16.0-17.0 on every slide (at the hero/MissionBlock boundary) | 2.48-4.32 (the steepest part of the pull) |
| R2b bpp | yellow 0.46-0.53 FAIL; pink 1.38-1.57 (lowest kept); dark 4.30-4.89; violet 5.64-6.41 | unchanged (the source) |
| R3 seam | 16-17 | 0-1 |
| R4 min contrast | 5.57:1 (dark, the h1 em) | 5.57:1 |

Pink is the closest kept slide to the starvation line (1.38 at 2048 wide). The simulation injected the golden stops and moved the slide
srcset to q=88 on BASE's page, so it is exactly what the thresholds were set against.

**Open risk, for the lead and Codi.** Codi's pull still starts at 72px with alpha slope 0.0125/px (0 -> 0.2 over 16px). BASE's starts
with 1/72 = 0.0139/px. The onset kink, a faint horizontal line about 72 CSS px above the hero's bottom edge, is therefore about 90% as
strong as on BASE. Pixel samples on pink at x=200 are identical in BASE and the simulated fix down to 660px. R2a passes because the
line is a kink, not a step. Softening it needs a gentler first stop, which is Codi's call, not this spec's.

## Rendered harness (test only)

`checks/hero-filter.cjs` is preloaded through NODE_OPTIONS `--require ./<relative path>` into `next build` and `next start`. A relative
path is used because an absolute one carries the checkout's spaces. The preload drops every array element naming a620a97f from
*.sanity.io responses, so the live dataset renders with 3 slides. `{ yellow: true }` (calibration only) builds without it. The
beta-wall credentials go to the local origin only, through `authorize()`. As a context-wide header they also reached cdn.sanity.io,
which then refused every preview slide. Ports are 3010-3019, never 3002, 3013 or 3016.

Run the checks from the worktree, on the installed Chrome:
`pnpm --dir .tmp/sandbox/critique-rhb exec env "NODE_OPTIONS=--require ../r19-chrome/use-chrome.cjs" node .agent/memory/project/specs/nos-hero-banding/checks/<check>.mjs`

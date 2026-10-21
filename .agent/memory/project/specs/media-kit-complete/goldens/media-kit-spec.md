# media-kit-complete — specification golden (amended 2026-10-22 for Codi's ruling)

Brad, 2026-10-22, verbatim: "Now the media kit is incomplete. It doesn't have all the approved lockups and all the different color variations. Light and dark, dark and light, horizontal, vertical, duotone, black and white, so on, so on. Make the media kit complete."

Authoritative inventory: `goldens/inventory.json` (75 downloads, 6 zips, 4 usage illustrations). Allowed wording, section order and usage copy: `goldens/labels.json`. Both are independent of the generator; the generator and page conform to them.

## Codi's ruling (final)

1. ONE wordmark: "South African Orchid Council". No "SA Orchid Council" file, label or zip anywhere. Geometry from the presentation (PDF p.10, printed "08 Wordmark specification") still applies: horizontal wordmark max(19px, h x 0.48), tagline max(9.5px, h x 0.195), 14px gap, vertically centred; vertical emblem width = the wordmark's rendered width, 16px gap, tagline 8px below; Crimson Pro 600 (tracking 0.002em / 0.005em, leading 1.02), JetBrains Mono 400 tagline 0.22em uppercase "MAKING A DIFFERENCE SINCE 1968"; on dark wordmark parchment, tagline 65% parchment.
2. Ground tints CONFIRMED, sampled from the presentation's own page 7 swatch bars (PDF p.7, light half of each bar, rendered 144dpi; the dark halves of the same bars sampled within 1 of the stated inks): 01 Indigo #232A5E / #ECEDF4, 02 Prussian #1D3557 / #E9F0F4, 03 Viridian #14503F / #E8F1EC, 04 Violet #3A2560 / #F0ECF5, 05 Teal #123F4A / #E7F0F1, 06 Plum #4A1F45 / #F1ECF1. Duotone = the approved mapping with lo = ink, hi = tint.
3. Reversed greyscale on sage CONFIRMED, sampled from the presentation's sage greyscale marks (PDF p.3-4; 1st/99th luminance percentile means at 288dpi): on-light greyscale lo #212121, hi #E3E2DF; on-sage reversed greyscale lo #4A4C47, hi #F5F5F5. Use these as the lo/hi of the greyscale maps (same luminance weights and 1.35/-0.2 stretch). A3 asserts the sampled tones within 24/channel.
4. National Show 2027: PNG only, no JPG. 16 approved PNGs byte-copied from `branding/National Show 2027/Logo/`, plus `Disa graminifolia.svg`/`.png` byte-copied as `nos-disa-graminifolia-emblem.*`, plus one generated `nos-all-logos.zip` of the 16 PNGs. Logo.zip and the 40MB+ Disa PNGs stay out.

## Sources and reuse

- Emblem: `branding/SA Orchid Council/emblem/Eulophia-speciosa-emblem.png` is untracked in git; `public/images/Eulophia-speciosa-emblem.png` is byte-identical (cmp rc=0, 2026-10-22). The generator reads the public/images copy; A7 keeps them in step while the branding file exists. `branding/` is read-only.
- Reuse `scripts/generate-saoc-emblem-web-assets.py` (`apply_lapis_monotone` math, `_max_pool_alpha`, `resized`) and the harness' trimmed-emblem approach. `scripts/lockup-export-harness/app.js` is NOT the presentation's system (Lora, palettes P1-P5, no six inks) and is never edited; reuse its recolour maths only.

## Deliverables

Entry point `python3 scripts/generate-saoc-media-kit.py [--out DIR]` (default `public/downloads/media-kit`); may shell out to Playwright/Node for lockup text. Deterministic: sorted traversal, fixed zip timestamps (1980-01-01), ZIP_STORED, no PNG metadata. Writes `lib/data/media-kit-manifest.json` and `public/images/media-kit/usage-*.png`. Manifest entry fields: `path`, `href` (/downloads/media-kit/ + path), `format`, `width`, `height` (null for zip/svg), `bytes`, `section`, `label`, `bundle_for` (zips), plus any of `rendition_label`, `ink_label`, `lockup_label`, `wordmark_label`, `mark_label`, `variant_label`, `orientation_label`, `bundle_label`.

| set | count | spec |
|---|---|---|
| marks, transparent | 9 | 1254x1254; `colour` byte copy of the source; greyscale, greyscale-reversed, 6 duotone recolours, alpha preserved |
| chips | 16 | 512x512 ground-filled: light chip parchment #F4F3EC (colour, greyscale, 6 duotone); dark chip sage #384138 (colour, greyscale-reversed, 6 duotone); mark trimmed, width 512/1.5 |
| lockups | 32 | {horizontal, vertical} x {colour, greyscale, 6 duotone} x {on-light dark type, on-dark light type}; transparent; dimensions identical per orientation; clear space NOT baked in: the PNG is trimmed so opaque content touches all four edges (A1 asserts this); vertical height/width is spec-derived, about 0.80 with the full-name wordmark, bound [0.70, 1.0]; on-dark greyscale uses the reversed grey |
| National Show | 18 | 16 PNG + emblem svg + png |
| zips | 6 | `saoc-everything` (all 57 SAOC files, NOT National Show), `saoc-full-colour` (4), `saoc-greyscale` (4), `saoc-duotone` (24, all six inks), `saoc-mark-only` (25: 9 marks + 16 chips), `nos-all-logos` (16) |
| usage illustrations | 4 | `public/images/media-kit/usage-{do,dont}-{horizontal,vertical}.png`, not downloads; reproduce the presentation's p.11-12 pairs (horizontal duotone Indigo; vertical duotone Viridian); each Don't breaks the stated rule (letter-spaced wordmark / shrunk emblem floated above the name), magnitudes measured from the PDF, not invented |

Downloads 75 + zips 6 = 81 files; the directory also keeps the legacy `saoc-emblem.png` (82).

## Page layout (pinned by Codi)

Section order, ids in `labels.json`: Quick start (#quick-start) -> Full colour -> Greyscale -> Duotone -> Mark only -> Clear space and minimum size + Do/Don't (#usage) -> National Show 2027. No tabs.
- Quick start: one card showing Duotone Indigo horizontal, dark type on light, plus "Download everything (zip)".
- Full colour and Greyscale: each one 2x2 grid, horizontal/vertical x light/dark. Previews sit on their real ground (parchment rgb(244,243,236) / sage rgb(56,65,56)), labelled with the presentation's wording ("Horizontal — dark type on light" etc.), showing format and size, with a real `<a download>` per format.
- Duotone: ink picker = radio group of 6 named swatches with hex, keyboardable (arrows), visible focus ring, selection reflected in the URL hash as `#duotone-<ink>` and restored from it on load. At 1280px exactly 4 cards (that ink's 2x2) are visible.
- Mark only: one row of chips (colour, greyscale and the 6 inks, x light/dark = 16).
- Sticky "On this page": reuse the r23 pattern (`components/show/ExhibitorJumpNav.tsx` / `ShowJumpChips`): `<details>` disclosure at <=699px, plain anchor nav above.
- Every section has "Download this section (zip)" (full-colour, greyscale, duotone, mark-only, national-show).
- Usage copy reproduced verbatim from the presentation (labels.json `usage_copy_verbatim`), with DO / DON'T markers and the four illustrations.
- At 390px cards stack one per row, no horizontal overflow.
- Test hooks: `data-kit-card` on every card, `data-ground` on lockup/chip cards, `data-kit-preview` on the preview box.
- Heavy NOS PNGs (3-4MB) must not load as eager previews. Keep the SAOC "Vector masters (SVG/EPS) are not yet available" note scoped to SAOC; "Last updated" stays truthful (October 2026).

## Open for the record
"Download everything (zip)" is read as everything SAOC (57 files); the 40MB National Show zip is separate. Flag if Codi meant to include NOS.

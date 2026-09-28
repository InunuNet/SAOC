# R12 build answers from Codi (NOS design), 2026-09-28 — relayed via saoc-nos-design-f1

Target design ("their artifact"): https://claude.ai/artifact/SjeY6NP8tXqRRv8ZgpV3uJ
(= d068d657, v4, "National Show Home, Restyled" — it IS /national-show; CSS header
"NOS 2027 — /national-show, restyled"). Adjuster SSD4vVap… is a placement tool only.

Hero reference = artifact hero: lockup, scrim, faces, eyebrows, meta, countdown, buttons.
- R14: display Fraunces, body Karla. Cormorant/Jost only inside logo artwork; do not load Cormorant.
- R15+R10 scrim: linear-gradient(90deg, rgba(11,10,20,.94) 0%, .80 30%, .44 52%, .18 75%, .04 100%). No vertical plate.
- Sections below hero: approved design too, but in-scope for this pass is Brad's call.

Desktop (Brad, adjuster placements/hero, 16:33Z, 1714 viewport / 1216 column):
- File NOS-2027-logo-full-colour-reversed-horizontal.png (transparent, as supplied, R22).
- Image box 1140px wide (h 280). Scale ~93.75% of column below 1216.
- Box left edge 32px outside column left edge (ink 21px inside).
- Box top 46px below hero top (ink 99px below). ~58px ink-bottom to next text.

Mobile ≤620px (Brad, 16:42Z, 390 viewport, 20px gutter; design commit 1f3e0ed):
- File NOS-2027-logo-full-colour-reversed-VERTICAL.png (as supplied).
- Image 365px wide (h 321), normal flow, first child of hero column.
- margin-left: -18px (ink 8px inside column edge).
- hero column padding-top: 3px above image box (ink 28px below hero top).
- margin-bottom: 8px (37px ink to THE FLAGSHIP).
- Ink 312px in 350px column; narrower phones scale ~104% of column width, negative margin keeps ink ~8px in.

Keep: THE FLAGSHIP + EDITION XIX eyebrows (after lockup), lede, meta, buttons, countdown.
Remove: band above hero (R23 hand-built lockup), EmblemBadge brandMark, typeset h1 text.
h1 content = lockup <img alt="National Orchid Show, Western Cape 2027">.
Open (Brad via Codi): lede opens "The South African National Orchid Show —" duplicating the mark. Do NOT rewrite (R7).

## SUPERSEDES the mobile horizontal inset above — Brad, via Codi, design commit beeea00
Mobile ≤620px: CENTRE the image box in the hero column: margin-left: calc(50% - 182.5px) at
width 365px; general form margin-left: calc(50% - <width>/2) (margin-inline:auto fails: box is
15px wider than column). Ink ~18px from each column edge. Unchanged: vertical file, 365px,
padding-top 3px, margin-bottom 8px. Only the mark is centred; FLAGSHIP, lede, meta, buttons stay left.

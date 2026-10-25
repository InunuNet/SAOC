# NOS Design rulings, polish wave 2 (2026-10-25, final)

F4: option (b) — "Refunds" and "Privacy" (footer labels; same destination, same name site-wide, critique H4; fits one line at 390).
- One line directly under Buy: "Refunds · Privacy", each link underlined.
- Contrast ≥4.5:1 on the card ground; hit target ≥24px tall (WCAG 2.5.8).
- .nk-policy from .nk-hint tokens. H1s stay on destination pages. No new copy.

F3: left-aligned on the hero axis (R71 one axis): body into [data-nos-wrap], 560px form column starting at the hero's x. <1024: column full width inside the same gutter.
- Gate: h1 left edge == form column left edge (±1px) at 1280 and 2056.

F8: DuotonePicker pattern for "Mark only" and "National Show 2027"; text-only options OK (preview is the swatch). Conditions:
- Real radiogroup, colourway name as each label.
- Preview and every download button update on selection; button names the selected file and format.
- Selected state visible without colour alone (check or bold weight, plus a ring).
- Focus order radios → preview → downloads.
- ≤9,000px at 390; report measured height in shots.

Buy enabled at qty 0 per r45b: agreed (no change).

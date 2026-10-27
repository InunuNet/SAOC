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

## Round 2 (NOS Design, 2026-10-25, after by-eye judging of shots)
F3: PASS (h1, ticket card, form column all start x32 at 1280; card and form 560 wide; 390 gutters intact).
F4: labels/underline/contrast/one-line PASS. Fix: links sit ~50px below "Continue to payment" — tighten to 12–16px under the CTA (Gestalt proximity). buy-fixture-390 missing page gutter treated as fixture artefact (confirm).
F8 ruling (b), "Lockups picker":
- Merge Full colour and Greyscale into one "Lockups" section: segmented toggle (Full colour | Greyscale) + the 4 variants as radios (Horizontal dark on light, Horizontal light on dark, Vertical dark on light, Vertical light on dark). DuotonePicker anatomy: one preview, downloads follow selection and name the file, selected state not by colour alone.
- Keep both "Download this section (zip)" links inside the section, labelled with their family. "On this page" anchors for Full colour and Greyscale deep-link to the picker with that family preselected.
- Duotone stays its own picker. Usage untouched in this PR.
- Revised target: ≤ ~10,500px at 390 (9,000 withdrawn). Report measured height.
- Before sign-off: one eager-loaded (or scroll-then-shoot) capture proving Mark-only preview, 512 Full colour card, the four Do/Don't illustrations, National Show picker preview and Disa emblem render.

## Round 3 (NOS Design, 2026-10-25, via lead)
F8: the merged section's h2 is "Full colour · Greyscale" (built from the two existing headings); the toggle uses the same two family names; variants are the verbatim lockup_label values; "Lockups" is dropped. #full-colour and #greyscale preselect the family.

## Round 4 (NOS Design, 2026-10-25, via lead; WCAG 2.4.4)
F8 (a): the "Full colour · Greyscale" section had two identical "Download this section (zip)" links. Ruling: ONE zip link that follows the family toggle, the selected family in its accessible name, visible text unchanged.

## Round 5 (NOS Design, 2026-10-25, via lead)
F8: the lockup variant radiogroup is named via aria-labelledby pointing at the selected family chip's label ("Full colour" or "Greyscale"); the family group keeps aria-label "Full colour · Greyscale". The two groups never share a name. Implemented at f8c63b28.

# Footer touch-ups + serif weight (NOS Design, 2026-10-23, from Brad's screenshots)

> Relayed verbatim by SAOC from NOS Design. Both apply to both sites. Same batch as hero-cards-ruling.md.

## 1. FOOTER TOUCH-UPS
Brad: "alignment is a problem, spacing … no symmetry, it doesn't flow, everything's falling off to the right." Heuristics: impeccable critique (aesthetic and minimalist design, consistency), craft-floor (legibility, rhythm).

Measured on beta at 2056:
- The grid is 4 equal 280px tracks with a 32px gap, but the content in them is 267, 112, 279 and 280px wide.
- So the visible gaps are 39px, 200px and 37px. That hole after Explore is the lopsidedness.
- There are three different label styles, and WOSA appears twice.

FT1. Equal gaps by construction. Use `grid-template-columns: auto auto auto 300px; justify-content: space-between` at ≥1280. The outer edges still sit on the container (413 to 1629 at 2056), and the three gaps come out equal (about 93px at 1280+). Keep the 2-col layout at 768–1279 (brand and Explore, then Partners and Stay in touch) and 1-col below.
FT2. One left axis. The brand block's left edge aligns with the © line below it. Keep the lockup stack centred within itself, but make the block hug its content (auto track) so it no longer floats in a wide column.
FT3. One rhythm.
- Every column starts at the same top line: the 10.5px heading, or the top of the logo in the brand column.
- The first item is 16px under the heading, and every row is 44px.
- The "Stay in touch" blurb starts on the same top line as "About" and "Wild Orchids…".
FT4. One label style.
- "Email address" becomes sr-only. Keep it as the real `<label>`, but don't show a second heading under "STAY IN TOUCH".
- Delete the "Looking for wild orchids?" block. WOSA is already the first Partner. That Partners row becomes the link instead, using the existing FOOTER_WOSA href, with ↗ and an sr-only new-tab cue.
- The column then ends with the form, so every column ends near the same line.
FT5. Partner rows are links (the hrefs come from the partners data the home section already uses), at 14px with the 44px rhythm, ↗ and the new-tab cue.
FT6. The tagline "MAKING A DIFFERENCE SINCE 1968" goes from 9px to 11px (craft-floor minimum), keeping the same mono, tracking and colour.
FT7. The bottom bar is fine: © at the left edge and legal links ending on the right edge. The floating ADMIN pill (admin only) collides with it at the bottom right. When the footer bar is in view, raise the pill above it (bottom offset = bar height + 16px). P2, admin only.
FT8. The NOS footer shares FOOTER_LAYOUT, so it gets FT1–FT6 too. Its columns are the brand lockup, Explore, the SAOC credit and Stay in touch.

## 2. SERIF WEIGHT (site-wide, SAOC)
Brad, on the home "In collaboration with" partner names: "Look how heavy the font is … Orchids are elegant. Little bit delicate. But they are still in your face." Today it's Crimson Pro 500 at up to 36px (`--serif-weight: 500`, per the handoff). Brad's word licenses the change. Heuristics: impeccable critique (aesthetic) and craft-floor (type scale and weight).

T1. In app/layout.tsx, load Crimson Pro 300 as well, as `weight: ['300','400','500','600']`. Drop 700 unless something uses it (check with grep). Keep the italics for each weight used.
T2. A weight scale by size, so it's delicate but still strong:
- ≥32px (hero h1, section h2, partner names, card titles at display size): **300**, with letter-spacing −0.015em.
- 20–31px: **400**.
- ≤19px: 500, so thin strokes don't break up at small sizes.
- The lockup wordmark stays 600. It's the logo, so don't touch it.
- The italic accent words follow the same weight as their line.
T3. Make up for the lighter weight with size, not colour. Partner names go to clamp(28px, 3.2vw, 42px) at line-height 1.12, and the h1 follows the handoff clamp. The colour stays --primary (about 10:1 on parchment, so thin strokes stay well clear of AA).
T4. `--serif-weight` becomes 400, and the display classes set 300. Before handing over, check that no `font-medium` or `font-semibold` overrides are left on serif headings.
T5. The NOS display serif (Fraunces) already reads light and elegant in the hero. Check its section heads and card titles against T2 so the two sites match: 300–400 at display sizes.
T6. Render gate at 2056@2 and 390: the stroke contrast holds, there's no faux-weight synthesis (300 actually loaded), and line breaks are unchanged or better.

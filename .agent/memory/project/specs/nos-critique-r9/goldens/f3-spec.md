# nos-critique-r9 F3 - no fractional-width gap in the chip media steps (interim QA P3)

BASE = r8 tip 812dbaa2 (restacked on main 81490e7a; was 6bffbe7c). Footprint: goldens/f3-footprint.json (StatusMarker.tsx, ShowStatusLine.tsx, VisitDisclosure.tsx) + docs/nos-critique-r9.md.

Bug: r8 writes the steps as integer complements - (max-width:419px) against (min-width:420px), (max-width:374px), (max-width:359px). A viewport of 419.5 or 374.5 CSS px (browser zoom, fractional DPR) matches neither side: tracking falls back to 0.14em, and at 359.5 the full label shows although the short tag is ruled for everything below 360.

RULING (unchanged r8 values, now with no gaps): tracking 0 for width < 375, 0.02em for 375 <= width < 420, 0.06em for 420 <= width <= 700, default above 700; the short tag "To be confirmed" for width < 360, the full label from 360.

Design: use media range syntax so each boundary is one strict comparison: `[@media(width<360px)]` (StatusMarker, on BOTH spans, so the pair flips together), `[@media(width<375px)]` (0 tracking), `[@media(width<420px)]` (0.02em), and keep the 700 step inclusive (`[@media(width<=700px)]` or max-width:700px). The 0.06em step may simply be the <=700 step with the narrower steps overriding it by order and the existing :not([hidden]) specificity trick, so no min-width:420 band is needed. Keep every value, the 12px size and the 10px padding. If the CSS minifier lowers range syntax to a decimal max-width, the rendered check tolerates a 0.05px gap and flags anything wider.

Proof: f3-static forbids the integer complements and requires the range steps; f3-rendered measures the computed values at 359, 360, 374, 375, 419, 420, 700, 701 and evaluates the production CSS media conditions on a 0.05px grid from 300 to 701 (headless Chrome cannot render a fractional viewport).

# Golden: the ※ status mark (NOS Design ruling 2026-10-28)

Replaces the text glyph U+203B in components/show/_shared/StatusMarker.tsx (no shipped face has it, so it fell back to a system font).
Inline SVG, `data-glyph="status-mark"`, aria-hidden, currentColor. NOT a 1em box: its outer extent (dot edge to dot edge) is the measured T cap height plus 4% overshoot top and bottom (the arrow keeps the 1em rule). StatusMarker renders on the SAOC host too (PlaceholderMarker, Home NavCards and ShowBand), so the DOM checks run on SAOC Home at 1440 and 390.

Geometry, measured in the badge label's computed font (A27, check-status-mark-geometry.mjs):
- Stroke = the label's T stem width, about 0.1em (asserted 0.08-0.12em), round caps (`stroke-linecap: round`).
- Dot diameter = 1.5x the stroke (asserted +-15%); dots are `<circle>`, strokes are `<line>`/`<path>`.
- Height = the label's cap height, centred on the cap height: T ascent = canvas `measureText('T').actualBoundingBoxAscent`; overshoot = 4% of it; mark top = T top - overshoot and mark bottom = baseline + overshoot, each +-0.5px.
- Measured at 1440 and 390 on the Home "To be confirmed" badge (any StatusMarker present). Weight is ruled GO, so stroke and dot are structural checks only.
Source rule (A23): when no shipped face has U+203B, StatusMarker.tsx holds the svg and no text mark.
Before/after crops: goldens/glyph-crops-before holds the arrow sites only (dev server has no Home); Home badge crops need a production build (DC_PROD=1 capture-glyph-crops.mjs <dir>).

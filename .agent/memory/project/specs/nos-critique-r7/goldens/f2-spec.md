# nos-critique-r7 F2 - text-wrap: pretty on the NosHero lede (Codi P3)

BASE = 1f8ad3de. Footprint: goldens/f2-footprint.json (nos-theme.css only).

Add exactly one line, `text-wrap: pretty;`, inside the existing `.nos-theme .nos-hero-lede {` rule (nos-theme.css, about line 491). Nothing removed, NosHero.tsx untouched (the lede <p> already carries data-nos-hero-lede and class nos-hero-lede).

Rendered: on every route that renders a lede (exhibitors mandatory; hub, plan-your-visit, what-to-expect, about, programme measured only where a lede exists), in public and preview, at 390 and 1280, the lede computes text-wrap pretty; at 390 no lede with 2+ lines ends on a single word (words-per-line from text-node ranges, lines clustered at half a line-height). The exhibitors public lede is the named case.

If Chromium does not honour pretty on a given lede and a one-word last line remains, report it; do not add copy or width hacks beyond the footprint.

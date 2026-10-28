# Golden: the -> arrow SVG (NOS Design ruling 2026-10-28)

Replaces the text glyph U+2192 where the shipped faces lack it. Inline `svg[data-glyph="arrow"]`, aria-hidden, currentColor. NOT 1em. Gate: A23 (A26 deployed), guard A29 (A30 deployed).
- Box width = 1.25em of the label font, +-0.5px.
- Gap from the end of the label text (advance, trailing letter-spacing excluded) to the svg box = 0.5em (margin-inline-start) + the label's letter-spacing, +-0.5px. No literal space before the svg.
- Shaft (`[data-part="shaft"]`) centre y = cap-height midline: baseline - canvas measureText('T').actualBoundingBoxAscent / 2, +-0.5px.
- Head (`[data-part="head"]`) = open chevron, 45 degrees, 0.4em arms (path length 0.8em +-0.04em; bbox height = 2 x width +-10%), fill none.
- Stroke ~0.1em (0.08-0.12em) on shaft and head, round caps and joins, currentColor (structural checks).
- CORNER variant (svg inside an element marked `data-variant="corner"`: the 21 society cards and the Home WOSA link): 1em wide +-0.5px, no margin, no label-gap assertion; head, stroke and cap-midline rules as above (cap midline measured on the title's first line); top aligned to the title's first line as at F1d. The 1.25em / 0.5em gap / no-space rules apply only to arrows without the marker.
- Guard A29: the 24 arrow links (/societies 21, /judging 1, Home 2) at 1440, 390 and 2056 keep link height and label text-top identical, and no title gains a line (title line counts equal), to the F1d build 7ee06e9a (goldens/arrow-links-f1d-7ee06e9a.json, 72 rows = 24 x 3 widths, measured with checks/measure-arrow-links.mjs from wt-sdc-f1d's existing production build).

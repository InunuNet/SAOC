# Golden: the -> arrow SVG (NOS Design ruling 2026-10-28)

Replaces the text glyph U+2192 where the shipped faces lack it. Inline `svg[data-glyph="arrow"]`, aria-hidden, currentColor. NOT 1em. Gate: A23 (A26 deployed), guard A29 (A30 deployed).
- Box width = 1.25em of the label font, +-0.5px.
- Gap from the end of the label text (advance, trailing letter-spacing excluded) to the svg box = 0.5em (margin-inline-start) + the label's letter-spacing, +-0.5px. No literal space before the svg.
- Shaft (`[data-part="shaft"]`) centre y = cap-height midline: baseline - canvas measureText('T').actualBoundingBoxAscent / 2, +-0.5px.
- Head (`[data-part="head"]`) = open chevron, 45 degrees, 0.4em arms (path length 0.8em +-0.04em; bbox height = 2 x width +-10%), fill none.
- Stroke ~0.1em (0.08-0.12em) on shaft and head, round caps and joins, currentColor (structural checks).
- CORNER variant (svg inside an element marked `data-variant="corner"`: the 21 society cards and the Home WOSA link): 1em wide +-0.5px, no margin, no label-gap assertion; head, stroke and cap-midline rules as above (cap midline measured on the title's first line: the marked element's `[data-corner-title]` if present, else its first h1-h6, else its first text; `em` is the arrow's own font size); top aligned to the title's first line as at F1d. The 1.25em / 0.5em gap / no-space rules apply only to arrows without the marker.
- Guard A29: the 24 arrow links (/societies 21, /judging 1, Home 2) at 1440, 390 and 2056 keep link height and label text-top identical, and no title gains a line (title line counts equal), to the F1d build 7ee06e9a (goldens/arrow-links-f1d-7ee06e9a.json, 75 rows = 25 links x 3 widths, measured with checks/measure-arrow-links.mjs from wt-sdc-f1d's existing production build).

Baseline for the cap midline is the label's own text, never an inserted probe: the first client rect of the text node (last rect for a label-following arrow) plus the canvas fontBoundingBoxAscent of that text's computed font. An inserted probe becomes a flex item in `inline-flex` links and reads the link's centre instead.

## Guard coverage (A29/A30), baseline from the F1d build 7ee06e9a, read-only from wt-sdc-f1d's production build
Rows (x3 widths 1440/390/2056): /societies 21 cards, /judging 1, Home 2 (Full calendar, WOSA), a society page (/societies/[first]) 1 = 25 links, 75 rows. Title lines are counted from text nodes only (the svg rect and the arrow glyph never count; new <= baseline).
KNOWN GAPS (callers that cannot be guarded on the fixture build):
- /events and /events/[slug] + EventCard/EventRow: /events renders (200) but the fixtures carry no events, so there is no arrow link and no event page link to follow.
- Search overlay: opens at 1440 and 2056 but lists no results (it calls /api/societies/search, live Sanity); at 390 it could not be opened from the header.
- NOS /tickets renders with no arrow link; /tickets/[slug] has no link to follow; /national-show/tickets and /national-show/vendors return ERR_EMPTY_RESPONSE on the fixture production build (nos.localhost).
- /sponsors renders with no arrow link at F1d.
These are listed by check-arrow-links-delta.mjs as KNOWN GAP / NOT GUARDED on every run. Verification outside fixtures needs the deployed run (A30).

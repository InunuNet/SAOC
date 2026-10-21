# nos-critique-r12 F6 [P2]: one section gap after a status disclosure

Source: lead task 2026-10-18. What-to-expect shows 230px at 1280 (y1095→1325). Workshops shows the same gap above "Programme" at 390. Target: ONE section gap, ≤96px at 1280 and ≤64px at 390, with no other site-wide change. BASE main 26fde668.

## Cause (architect measurement, 26fde668, public mode)

A NOS section ends in a status disclosure (`[data-status-disclosure]`, the gold ShowStatusLine surface), and a second full section follows it on the same ground. Each section carries the shared rhythm `padding-block: clamp(72px, 9vw, 120px)` (nos-structure.css `.nos-section` and `.nk-section`), so the eye sees two stacked units.

| route | width | leader → follower | gap from disclosure bottom to next content |
|---|---|---|---|
| /national-show/what-to-expect | 1280 | NosSection (dates plus ShowHoldingNote; the rest is held back in public mode) → NosSection (LongFormPage) | 230.4 (115.2 + 115.2) |
| | 390 | same | 144 (72 + 72) |
| /national-show/workshops | 1280 | NosSection (nk-sessions-note, the disclosure only) → TicketSection `nk-section` "Programme" | 230.4 |
| | 390 | same | 144 |

**Sweep.** Every F24 NOS route and every /tickets/* page were checked at 390 and 1280. These two are the only routes with a section that ends in a disclosure. Exhibitors has a disclosure mid-section; it is not affected.

**One rhythm unit is not enough.** F17's existing `nos-section-joined` (follower `padding-top: 0`) leaves ONE unit, which is 115.2px at 1280 and 72px at 390. That is above the lead's ≤96 and ≤64. Meeting the target means the follower reads as a continuation of the disclosure's section: its top padding goes, and the gap is an intra-section step, not a full unit. See the decision below.

## Decision

- **Outcome, not mechanism.** The dev picks the mechanism inside goldens/f6-footprint.json: the two pages, nos-structure.css (additions only), and TicketSection.tsx if the follower needs a class.
- **The gap (lead ruling 2026-10-18): 40px ±2 at 375, 390, 768 and 1280.**
  - 40px is the `space-y-10` step these sections already use between blocks, so it adds no new value.
  - It sits inside Codi's FINAL caps (≤96 at 1280, ≤64 at 390).
  - One rhythm unit (115.2/72) breaks those caps and is excluded.
- **Locked:**
  - The shared `.nos-section`, `.nk-section` and `.nos-section-joined` rules stay byte-identical.
  - Every BASE line of nos-structure.css stays, in order (f6-static S1).
  - A fix must be scoped to a section that ends in a disclosure, never to the rhythm itself.

**Prototype (architect scratch, proof only, not prescriptive).** It is two additive rules in nos-structure.css:
- `.nos-section:has([data-status-disclosure]):has(+ :is(.nos-section, .nk-section)) { padding-bottom: 40px }`
- `.nos-section:has([data-status-disclosure]) + :is(.nos-section, .nk-section) { padding-top: 0 }`

If the dev ships a CSS route, it should tie the selector to the disclosure being the section's LAST content, so a mid-section disclosure never matches.

## Proof
- f6-static:
  - S1: nos-structure.css only gains lines, and the shared rhythm rules are unchanged.
  - S2: the docs record F6.
- f6-rendered, public mode, at 375, 390, 768 and 1280:
  - What-to-expect (follower `.nos-longform`) and workshops (follower `#programme .nk-head`): the gap from the bottom of the last disclosure above the follower to the follower's top must be 40px ±2.
  - On those two routes, the disclosure box, follower height, hero box and <main> text must equal goldens/f6-baseline.json.
  - Non-regression on /national-show (same-ground joins), /national-show/tickets (stacked nk-sections, deliberately NOT changed), /national-show/plan-your-visit and /national-show/exhibitors (mid-section disclosure): every top-level block's top and height, and the document height, must equal the baseline (±1px).
- Negative at 26fde668: FAIL. Four gap failures (144 and 230.4), and S2 fails because the docs are missing. KEEP geometry is stable run to run.
- Positive on the prototype: PASS.

## Notes
- /national-show/tickets stacks nk-section → nk-section at 230.4 (1280) and 144 (390), with no disclosure. The lead sent this to Codi as an observation. f6-rendered pins it unchanged.
- Results:
  - negative at 26fde668: FAIL on all 8 target rows (144 at 375, 390 and 768; 230.4 at 1280);
  - positive at the dev's tip a097ce43: PASS.
- The hub hero (/national-show) holds a live countdown and a CMS price line, so its height varies with time and content: 1236.7 vs 1097.9 at 768, identical on 26fde668 and on the tip (dev, 2026-10-18). f6-rendered therefore leaves the hero's own height out of the KEEP comparison. Every later block may shift by exactly that difference, and nothing else may move or resize.

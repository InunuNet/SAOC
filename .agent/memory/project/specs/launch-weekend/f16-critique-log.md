# F16 critique log (tickets hub R31-A2)

Method: impeccable critique (critique.md heuristics, craft-floor.md, audit.md, polish.md) plus frontend-design,
web-design-guidelines and accessibility, read from the shots in `.tmp/sandbox/lw-f16/after/` (390, 1280, 1920,
chip and row-action hover and keyboard focus, /national-show/conferences at 390 and 1280).

## Pass 1
Build of the reference prototype adapted to the F12 base. Findings:
- P0: 0
- P1: 0
- P2: 2
  - 1280/1920: a dead band of about 160px under the rows (two NosSections stack 120px + 120px padding between the visit group and the exhibit cards). Fix: one NosSection, the visit group a `role="group"` div inside it, groups spaced `space-y-16`.
  - 390/1280/1920: the h2 "I'm coming to visit" sits about 45px above its sentence while the badge sits 20px above it (inherited h2 bottom margin). Fix: zero the heading margin inside the visit group.
- P3 (no source, reported): the hero band is tall with empty right half at 1280 and 1920 (the NosHero is out of scope and shared).
Score: 33/40
Notes: 390 index shows a 2x2 grid above the fold; hover and focus shots show 150ms background change and the 2px ring; reduced motion: chips and actions use only background-color transitions, no transform.

## Pass 2
Re-shot after the section merge and heading margin fix. Checked 390, 1280 and 1920 hubs, the 390 index, chip and row-action hover and focus at 1280, and /national-show/conferences at 390 and 1280.
- P0: 0
- P1: 0
- P2: 0
Score: 37/40
Notes: left axis holds (hero text, chips, rows, cards share x); one dominant price per row, caption after it, second price muted on the same column; one equal-weight action per row, full width stacked at 390; no photographs, cards typographic; prefers-reduced-motion leaves no transform; focus ring 2px on chips and actions; remaining P3 is the shared hero height.

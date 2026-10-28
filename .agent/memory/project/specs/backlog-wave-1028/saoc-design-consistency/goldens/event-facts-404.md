# F1c amendment: event facts and /404 footer gap (NOS Design beta check)

## A12 /events/[slug] facts (factsAlign=start)
Defect on beta: "Western Cape" breaks "Wester/n Cape"; cells 145/228/86px in a 539px row; dd weight 300 at 31px; dd has overflow-wrap:anywhere.
Ruled fix: overflow-wrap normal; cell min-width min-content; dd text-wrap balance, at most 3 lines, breaks at spaces only; flex-wrap onto a second row that starts at h1.left; F1c levers (gap 24 at 768-1279, weight 400 below 32px).
Gate widths 1024, 1200, 1280, 1440, 2056. Per word in each dd/dt: exactly 1 client rect. No horizontal overflow of facts or cells. dt.left = dd.left +-1 in each cell. A wrapped row starts at h1.left +-1.
Route: 19th national show event (/events/19th-south-african-national-orchid-show on beta), else first event; KNOWN GAP when none renders (local fixtures have no events, so the proof is phase 5 on beta).
Measured on beta/main: 4 mid-word breaks, plus overflow-wrap, min-width and text-wrap lever failures at every width.

## A13 /404
Defect: band runs straight into the dark footer. Gate: parchment gap >= 64px between the band's bottom (lowest content in main) and the footer top at 390, 1440, 2056.
Measured on main: gap 0px at all three widths.

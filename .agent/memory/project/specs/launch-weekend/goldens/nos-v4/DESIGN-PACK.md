# NOS design pack — Codi (design authority), 2026-10-17
Path: /Users/vetus/ai/SAOC NOS Design/.tmp/sandbox/nos-goldens-v4/  (read-only for builders)
Source: artifact https://claude.ai/artifact/2xfPi1KL6fwiBu3vLFNUHE (NOS chrome v4, Brad-approved 2026-10-15) + tickets v13 MShGgcxjdSyqznzzaRsC6K.
Build every surface FROM these files. Do not re-derive a design that already exists here.

| Surface | Golden | Notes / later rulings that override |
|---|---|---|
| NOS header, mega-menu, menu panel, footer | handoff/HANDOFF.md + handoff/chrome.css | Overrides: hub h1 "National Orchid Show" (Brad), Members hidden (Brad), body 16/1.55 (R65) |
| Hub /national-show | index.html | Overrides: hero CTAs Tickets, Plan your visit (R67); no hub index (R74 #2) |
| Plan your visit | plan-your-visit.html | ihero, Getting there + venue card aside, "In an emergency" numerals (dl.numbers, tel: links per R33), Be the first to know |
| Symposium + presenters | symposium.html (pc-card) + artifacts CTBp6vRiXr6xSCrHm9fdmC / KzuKQeqQbLBCbavB3TbSzX | Override: h1 "National Orchid Show Symposium" (Brad) |
| Tickets | v13 (goldens/f18b in SAOC) | R83/R84 |

Brad's approved chrome decisions still binding (HANDOFF "Approved decisions"):
2. Search and the SAOC utility bar are left off NOS pages, at every width.
6. Phone header: two rows, not sticky, lockup 390px wide (6.27px cap) so the logo stays legible.
1/4/5. Tickets CTA takes Contact's slot; rail = Day Visitor + Weekend Pass text links to their ticket cards; no second Tickets button in the menu panel.

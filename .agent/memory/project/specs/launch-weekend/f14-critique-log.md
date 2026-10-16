# F14 self-critique log

Method: impeccable critique (10 heuristics x 0-4), craft-floor and audit passes, read directly (launcher unavailable), plus frontend-design, web-design-guidelines and accessibility. Every PNG in `.tmp/sandbox/lw-f14/after/` was opened and looked at: four sections at 390, 1280 and 1920, the four hover shots, and the nav-cards keyboard focus shot. Reduced motion is covered by check A2 and A12 (no transform on hover or focus; colour, underline, border and outline survive), not by a screenshot.

## Pass 1

Build: reference prototype applied to origin/main, production build, checks A1-A12 green, 17 shots taken.

- P0: 0
- P1: 0
- P2: 2
- P3: 3

Findings
- P2 YearbookStrip h2, 390 and 1280: the line break left a stray middot at the start of line 2 ("· 2025 yearbook"), pulling the first word off the heading axis.
- P2 YearbookStrip h2, 1920: `text-balance` split the publication name across lines ("Orchids South / Africa · 2025 yearbook"), so the italic title reads as two fragments.
- P3 YearbookStrip 1280: the ~245px gap between the prose and the facts hairline. Judged against the lead's ruling: the rule starts the lower group, the gap is anchored to both photo edges and reads as deliberate negative space. 5/6 would only recover about 27px, so it does not change the judgment; the aspect ratio is left at the handoff's 4/5.
- P3 PartnersSection: rules and wash hang 12px outside the page axis (rules 52-1228 against the eyebrow at 64). Mandated by spec section 4c and asserted by A12 (the row's own background carries the wash, so the row must be wider than the text). Recorded for the lead, not fixable inside the check.
- P3 PartnersSection: SANBI and Kirstenbosch NBG trace only to the design mock, only WOSA is a confirmed partner. Content stays as-is, logged for Lee-Ann.

Score: 33/40

## Pass 2

Fixes applied in one batch: `<em>` set to `whitespace-nowrap`, and the middot bound to the title with a non-breaking space, so the dot trails line 1 and the name never splits. Text is unchanged (A8). Rebuilt, re-shot all 17 PNGs, re-looked at 390, 1280 and 1920 yearbook plus the rest.

- P0: 0
- P1: 0
- P2: 0
- P3: 3 (carried from Pass 1, reasons unchanged)

Checked
- 390: single-column cards, band stacked with full-width Book tickets, partners as a ruled stack, no overflow, no orphan words in headings.
- 1280: cards lift, brass border, underline and shadow on hover; focus shows the 2px ring over the same state; band photo flush left, countdown spans the facts block; yearbook copy column starts and ends on the photo edges; partner wash and brass underline on hover.
- 1920: band content capped at 720 with the photo still flush; yearbook and partners keep the 1280 container.
- Hover and focus: 150ms, one transform per element, brass never the only signal on parchment.
- Reduced motion: no translation or scale, state colours remain (A2, A12 green).

Heuristics: visibility of status 4, match with the handoff 4, user control 3, consistency 4, error prevention 3, recognition 4, flexibility 3, minimalist design 4, error recovery 3 (n/a, scored neutral), help and documentation 3 (n/a, scored neutral).

Score: 37/40

# F17 self-critique log

Method: impeccable (critique.md Nielsen heuristics 0-4 x 10, craft-floor.md, polish.md, audit.md), frontend-design, web-design-guidelines and accessibility, applied to production-build screenshots at 390, 1280 and 1920 (`.tmp/sandbox/lw-f17/after/`). Tokens and rulings only; no new colour, font or motion.

## Pass 1

Evidence: the first full build (computed-style checks at 390, 1280 and 1920 plus the first screenshot set).

- P0: 0
- P1: 1
- P2: 0
- Score: 33/40

Findings:
- P1 (fixed): the Explore index mounted on tickets, workshops and conferences marked the current item in the NOS violet; F3-T forbids violet on every ticket surface (measured: 6 violet hits at 390 and 1280). Fix: `currentTone="ink"` on those three routes, current item in ink with a 2px underline (nos-structure.css F17 block); every other route keeps the violet marker.
- Evidence gap (fixed): the first mega shot was taken while the page was scrolled and showed the footer, not the open menu; reshot with a real click.
- Hub rhythm after the join reads as one unit at 1280 (planning rows flow into the judging groups, the exhibitor band flows into the closing line); sponsors panel sits on the axis at 390; symposium ends cleanly after the theme and presenters.

## Pass 2

Shots re-taken after the final code change: hub 390/1280/1920, sponsors 390/1280/1920, symposium 390/1280, tickets 390/1280/1920, footer 390/1280, open mega 1280 (real click), open mobile menu 390, plus FAQ and Exhibitors inner pages at 1280 and 390 showing the Explore index and the key dates.

- P0: 0
- P1: 0
- P2: 0
- Score: 37/40

Heuristics: status visibility 4, real-world match 4, user control 4, consistency 4 (ticket rows share one caption style and one price style, sentence case reads as one family with the chrome), error prevention 3 (sold-out action is a non-link with aria-disabled), recognition 4 (every price has its own named action), flexibility 3, aesthetic and minimal 4 (symposium gap gone, joined sections, one-line key-dates caption), error recovery 3, help 4.

P3 (not fixable inside the NOS tokens and rulings, reported to the lead):
- Sponsors page shows two "To be confirmed by the show committee" markers (the page-level notice and the panel badge); both pre-exist and the panel badge is part of the spec'd panel.
- Symposium keeps a generous gap between the theme and the presenters block (two rhythm units, by the section system).
- Exhibitors page is very long; key-dates caption verified by A20 at 1280/1920 rather than by eye at full-page scale.

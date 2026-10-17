# F19 self-critique log

Method: impeccable (critique heuristics 0-4 x 10, craft-floor, polish), frontend-design, web-design-guidelines and accessibility, applied to production-build screenshots at 390, 1280 and 1920 on the beta build (`.tmp/sandbox/lw-f19/after/`, `capture-shots.mjs` plus a 1920 set). Routes: home, judging, societies, events, about, contact, sponsors, members, plus the four home hero slides (scrim review) at 390 and 1280.

## Pass 1

Evidence: the first full beta build, screenshots at 390, 1280 and 1920 and the computed-style checks.

- P0: 0
- P1: 2
- P2: 3
- Score: 35/40

Findings:
- P1 (fixed): the hero scrim was checked on the carousel slides one by one; slide 2 (dark phalaenopsis) read fine but the first build used `to bottom right`, which the browser serialises as `to right bottom`, so the README diagonal could not be verified. Now `135deg`; the veil, diagonal and bone pull all measure at 4.5:1 or better on all four slides at 390 and 1280.
- P1 (fixed): /judging prose, award ladder and judges directory were 15px; every SAOC prose block is now 16px at 1.55.
- P2 (fixed): the /judging stats strip put its "Not confirmed by SAOC" marker across the full width of the row (stretched flex item); it now sits left, hugging its text.
- P2 (fixed): on /contact the marker sat inline against the email address; it now stacks under the mailbox.
- P2 (fixed): the About closing band (CTA) showed its body on beta without a marker; it is now marked, and withheld on public.

## Pass 2

Shots re-taken after the final code change: home 390/1280/1920, judging, societies, events, about, contact, sponsors and members at 390, 1280 and 1920, and hero slides 1-4 at 390 and 1280.

- P0: 0
- P1: 0
- P2: 0
- Score: 39/40

Heuristics: status visibility 4 (every unconfirmed fact on the beta preview carries one chip), real-world match 4, user control 4, consistency 4 (one `.saoc-container` axis, one 16/1.55 prose rule, one marker treatment), error prevention 4, recognition 4, flexibility 3 (no change in scope), aesthetic and minimal 4, error recovery 4 (form errors tied by aria-describedby), help 4.

P3 (not fixable inside the rulings, reported to the lead):
- The marker chip sits close under the prose it marks (4px); a larger gap would need a design token.
- /about is a long single prose column at 1280 by the Council's own copy; the shot reads calm, not cramped.

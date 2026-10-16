# F12 critique log (impeccable fallback: craft-floor + polish read, screenshots inspected by the dev)

Screenshots: `.tmp/sandbox/wt-lw-f12/.tmp/sandbox/f12-shots/` (hub, symposium, tickets, programme,
international-guests at 390, 1280, 1920, fold and full page; utility bar at 390 and 479).

## Pass 1 (production build, SITE_PUBLIC_LAUNCH=true)

| route | width | finding | severity | action |
|---|---|---|---|---|
| hub | 1280, 1920 | h1 on one line, CTAs and countdown on one row bottom-aligned, four facts on one row, header, h1, lede and index share one left edge | none | |
| hub | 390 | stack is CTAs, price, countdown, facts; mail collapses to its icon beside the saoc.co.za and Join pills | none | |
| hub | 1280 | "Triennial" fact sits at the flower's edge; text stays legible on the dark ramp | P3 | accepted, spec-defined 760px body |
| symposium | 1280 | theme line in italic serif under a one-line h1, no quotes; body "Symposium theme" h2 left, copy right | none | |
| programme | 1280 | withheld-content block has an empty heading column (notice sits in column 2 by spec) | P3 | accepted, spec-defined |
| tickets | 1280 | cards on the axis; the full-bleed Ozow test-mode banner sits at x=0 | P3 | pre-existing, belongs to components/tickets, not F12 |
| utility bar | 390, 479 | one row, pill visible, email icon only below 480 | none | |

Result: 0 P0, 0 P1, 0 P2 after pass 1. One defect found by the checks, not by eye, and fixed before
pass 2: Tailwind `max-[479px]` compiles to `width < 479px`, so the email text still showed at exactly
479px; the tokens became `max-[480px]` (`width < 480px`).

## Pass 2 (rebuild after the fix)

Re-measured the utility bar at 360, 390, 479 and 480: email text gone below 480, shown from 480 up.
No P0/P1/P2.

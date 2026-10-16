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

## Pass 3 (rebuilt code at 36d1661e; shots prefixed `p3-` in the same folder)

Opened: utility bar at 479 and 480, international-guests 1280, symposium 1920 fold and 390 full page,
tickets 1920 fold and 390 fold.

| route | width | finding | severity |
|---|---|---|---|
| utility bar | 479 | email collapses to its icon; saoc.co.za and Join pills on one row | none |
| utility bar | 480 | email text returns; one row | none |
| international-guests | 1280 | h1 on one line, lede at 46ch, sub-nav, then the ruled withheld-content block with the notice in column 2 | none |
| symposium | 1920 | h1 on one line on the axis, italic theme line below, "Symposium theme" h2 left with the council sentence right | none |
| symposium | 390 | stacked, theme heading then copy; sub-nav scrolls sideways by design | none |
| tickets | 1920, 390 | cards on the axis; TEST MODE strip is full-bleed (F16/components/tickets); empty band between hero and strip is F16's | P3, not F12 |

Result: 0 P0, 0 P1, 0 P2.

## Codex review (execution/codex_qa.sh on the src diff): two P1s, both rejected as spec-defined (lead ruling 2026-10-16)

1. "CTA/countdown row applies below 1024 and stacks only below 640": A3 asserts the flex row
   (flex-end, space-between, gap 48, wrap) at 1023 and 1024 and stacks it under 640 only.
2. "Conferences and workshops keep max-w-[720px]": the wrap is the axis container for both (A7);
   the inner ticket-form column cap is left to the dev by the spec, so CategoryTicketsPage is unchanged.

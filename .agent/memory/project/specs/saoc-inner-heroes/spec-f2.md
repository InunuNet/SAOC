# saoc-inner-heroes F2: NOS Design rulings of 2026-10-26 (#116 beta pass follow-ups)

Base: origin/main 9b8a1e63 (#116, contract-f1 merged). Source: comms.md "[NOS Design -> SAOC] 2026-10-26 - #116 (9b8a1e63) beta pass". These are NOS Design rulings and final. f1's gates are reused where they still hold; the f2 gates (checks/f2-*.mjs) read goldens/f2.json merged over goldens/crop-map.json through checks/f2-lib.mjs.

## Rulings implemented
- HM-5 [P2] eased scrim: same end, stops 0@34%, .06@38%, .16@42%, .32@45%, .52@48%, .70@50.5%, .80@52% (sage only, display:none below 768 unchanged). Gates: computed gradient equals the stops (f2-gate-scrim-stops), worst-pixel copy contrast >= 4.5 re-measured (f2-gate-contrast; eyebrow and h1 also 4.5, as in f1), alpha <= .1 over the focal centre on /sponsors and /about (f2-gate-scrim-focal), the left 34% is the bare photograph (f2-gate-geometry, clean zone moved from 44% to 34%), and f1's mean alpha over the left 44% stays <= .1.
- HM-7 [P2]: /404 and /events/submit become typographic PageHero. /events/[slug] keeps orchid-dark @72% 42% for now; its facts values are left-aligned to the h1's edge (f2-gate-facts-align).
- HM-8 [P2]: the typographic band sizes to its content at >= 1024 (padding-block clamp(64px, 6vw, 96px), no min-height); band <= content + 192 at 1440 and 2056; < 768 unchanged; LG-RF stays green (f1 gate-lgrf on both hosts).
- P3 /members: the "Not yet available" note takes the legal draft-notice treatment (f2-gate-members-note). Source cited: the draft notice in app/(shared)/refunds/page.tsx:82-88 and the 10-25 LG-RF ruling (comms.md): "sans 15px, muted ink, the bold lead-in kept, and a 1px rule below it. No border, no fill, no box."

## Rulings NOT implemented (deliverable: candidate sheets, f2-check-sheets)
- HM-6 /societies/[slug] re-cut: candidates (a) the violet top-right bloom flipped into the left 44%, window >= 4082 wide, not /about's or /contact's bloom; (b) typographic. The withdrawn violet-society cut stays until NOS Design picks.
- /events/[slug] cut: one candidate distinct from home's dark and /sponsors' dark-flip.
- Each candidate: an in-situ sheet (scrim, h1, chip) at 1440@2 and the 1:1 left-44% crop at 1440@2 showing petal veining, in .tmp/sandbox/heroes2-sheets/ with manifest.json.

## Open questions for NOS Design (nothing invented)
1. HM-5 "focal centre (lip/column)": no coordinates were given. The gate reads it as the left 0-39% of the hero (where the ruled stops stay at or under .1); route coverage /sponsors and /about.
2. P3 conflict inside the sources: the refunds draft notice in code is 14px muted with no rule; the 10-25 ruling says 15px with a 1px rule below. The gate asserts the structure (plain p, bold lead-in, border 0 on three sides, 1px solid rule below, transparent, no wrapper box, verbatim text) and does not assert the font size.
3. HM-6 (a) "top-right bloom": the sheet check reads it as a window whose centre lies in the source's top-right quadrant (violet 7327x4885). Confirm.
4. HM-7 labels: only the facts values are ruled; label (dt) alignment is measured and logged, not gated.

## Harness note
The recorded Sanity fixture (nos-content-standard/fixtures/sanity, 85 files) has no entry for the current societyEvent slugs query, so a replay BUILD fails on 9b8a1e63. checks/f2-build.sh builds without the fixture (GET only); Fixture refresh is the fixture owner's call.

Runtime (10-27, architect): the gates no longer serve under replay either. The societyEvent queries take `$todayStart` (lib/sast-date.ts, SAST start of day), so every recorded entry is keyed to its recording day; after the next SAST midnight home, /events and /societies/[slug] return 500 (SanityFixtureMiss) and each probe sat out its 20 s image timeout, which is why f2-gate-served-width ran past 11 minutes. checks/_lib.mjs startServer now reads Sanity live (GET only, public dataset) unless SAOC_GATE_SANITY_REPLAY=1; served-width also fails a non-200 page at once instead of waiting. Measured 200 s on the main build (was 11+ min, killed). Viewports and routes are unchanged.

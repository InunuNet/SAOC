# saoc-inner-heroes F2: proof on main (9b8a1e63 build)

Amended 2026-10-27 for the NOS Design 2026-10-27 rulings (shared 15px DraftNotice on /members and /refunds; /societies/[slug] typographic; dt and dd left-aligned; HM-6 sheet dropped). Rows A3, A4, A14, A15, A16, A17, A19, A21 re-run on main after the amendment; A9, A10, A12 re-run and unchanged.

Run 2026-10-27 against the production build of 9b8a1e63 (worktree wt-heroes2, `.next` from the main source; the branch adds spec files only).
Raw logs: `.tmp/sandbox/proof-*.log` (gitignored, kept locally). Python for `contract.py validate --strict`: `/opt/homebrew/opt/python@3.14/bin/python3.14` (python3 is 3.15, no yaml) -> "Contract valid: 22 assertions (22 binary/0 agent_review, 100% machine-verifiable)".

Reading: FAIL-ON-MAIN means the assertion fails on 9b8a1e63 for the reason the ruling names, so it proves a fix. GUARD means it passes on main and holds the line after the fix.

## Why f2-gate-served-width ran 11+ minutes (found and fixed)
- The runtime server ran under `SANITY_FIXTURE_MODE=replay`. The societyEvent queries take `$todayStart` (lib/sast-date.ts), so each recorded entry is keyed to the recording day. After SAST midnight, `/`, `/events` and `/societies/[slug]` returned 500 (`SanityFixtureMiss`, next-start log); the 2056 and 1440 viewports ran before midnight, 1280 onward after (proof log of the killed run).
- Every band/slide probe then waited out `loaded()`'s 20 s timeout on a 500 page, across 9 viewports.
- Fix (spec checks only): `checks/_lib.mjs` `startServer` reads Sanity live, GET only, as `f2-build.sh` already does at build time (`SAOC_GATE_SANITY_REPLAY=1` restores replay); `f2-gate-served-width.mjs` fails a non-200 band/home page at once. Viewports, routes and the cover formula are untouched, nothing weakened.
- Result: 200 s wall time; every remaining failure is the HM-7 typographic assertion. This also repairs the f1-reused gates (A11, A18) on any day after the fixture was recorded.

## Assertions on main
| id | what | on main | status |
|---|---|---|---|
| A1 | frozen f2 checks unmodified | pass after regeneration (checks.sha256 14, checks-f2.sha256 13, `_lib.mjs` added) | GUARD |
| A2 | f2 golden carries the 7 ruled stops | pass | GUARD |
| A3 | static rules from source | FAIL: old 44-52% ramp present, no band padding clamp, /404, /events/submit and /societies/[slug] not typographic, no components/ui/DraftNotice.tsx, neither page imports it, .hero-facts centred | FAIL-ON-MAIN |
| A4 | diff scope | pass (19 spec-only paths) | GUARD |
| A5 | type-check | pass (exit 0) | GUARD |
| A6 | eslint | pass (0 errors, 7 warnings) | GUARD |
| A7 | build via f2-build.sh | pass (compiled, 92/92 static pages) | GUARD |
| A8 | derived sources match f1 golden | pass | GUARD |
| A9 | scrim stops equal ruled stops | FAIL: found 2 stops (0@44, 0.8@52) on every photographic hero | FAIL-ON-MAIN |
| A10 | alpha <= .1 over left 0-39% /sponsors, /about | pass | GUARD |
| A11 | f1 mean alpha left 44% <= .1 | pass (60 s) | GUARD |
| A12 | copy contrast >= 4.5, all inner heroes | pass (88 s; worst h1 7.09, lowest cta 5.40) | GUARD |
| A13 | /sponsors lede contrast | pass (lede 7.1-7.3) | GUARD |
| A14 | geometry, HM-8 | FAIL: typographic band 480 vs content+192 (e.g. 151 -> 480), min-height 480 on every typographic probe, /404, /events/submit and /societies/[slug] still photographic (47 /societies/[slug] failures) | FAIL-ON-MAIN |
| A15 | served width | FAIL only on /404, /events/submit and /societies/[slug] "carries no photograph" at all 9 viewports; every other hero, band and slide passes | FAIL-ON-MAIN |
| A16 | /events/[slug] dt.left = dd.left = h1.left +-1 at 2056, 1440 | FAIL: dd centred; at 2056 dd starts 79-411 px and dt 205-618 px right of the h1 (h1 1061.3); at 1440 dd 0-240 px and dt 286-305 px right of the h1 (h1 741.0); row also off at 390 | FAIL-ON-MAIN |
| A17 | draft notice on /members and /refunds: 15px, 1px rule, shared | FAIL: /members font-size 16px, rule 0px, bordered `DIV[data-placeholder]` wrapper; /refunds font-size 14px, rule 0px | FAIL-ON-MAIN |
| A18 | LG-RF both hosts (f1 gate) | pass | GUARD |
| A19 | /events/[slug] candidate sheet and manifest | FAIL: manifest missing | FAIL-ON-MAIN |
| A20 | CI e2e | NOT RUN on main (needs the CI harness; covered by the post-implementation gate) | UNPROVEN |
| A21 | spec records the NOS Design 2026-10-27 rulings | pass | GUARD |
| A22 | home and NosHero untouched | pass | GUARD |

Count: FAIL-ON-MAIN 7 (A3, A9, A14, A15, A16, A17, A19); GUARD 14 (A1, A2, A4, A5, A6, A7, A8, A10, A11, A12, A13, A18, A21, A22); UNPROVEN 1 (A20).

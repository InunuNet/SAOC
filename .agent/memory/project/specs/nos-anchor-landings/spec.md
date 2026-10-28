# nos-anchor-landings (F1) - spec

Branch `fix/nos-anchor-landings`, base `origin/main` d52d3eb6. Source: NOS Design, root comms.md:5131 "A13 sweep: rulings (build to NOS Site)", and the sponsor-card ruling at comms.md:5103.

## Ruling (quoted)
- "One landing rule for every NOS hash target: 24 below the pinned chrome, the same as the card."
- "768-779: yes, switch both --doc-scroll-margin and --doc-index-top at 768, the measured pin edge, and correct the :2740 comment. Values per band = pinned-chrome bottom + 24. Derive them from the header height token (plus any pinned sub-nav), not new literals."
- ">=1024: not accepted at 15 ... --doc-scroll-margin becomes pinned-chrome bottom + 24 (121 under the 97 header alone)."
- Gate: every faq, pyv and sponsor target 24 +/-2 below the pinned chrome at 390, 767, 768, 779, 780, 1024, 1440, 2056; "the doc index's sticky top sits under the chrome at every band with no overlap". Legal and presenters have no hash targets.

## Cause, measured (main d52d3eb6, replay build, `next start`; goldens/red-main-*.txt)
Header: `.nh` (components/nos-chrome/nos-chrome.css:24) is `position: sticky` from 768 and `position: relative` below (nos-chrome.css:83). Rendered height 96.9px at every width 768-2056 (bar padding 13+13, brand image 70, 1px border); the brand art sets it, no CSS declares it. At 390 it is 146.8 (767: 154.9) and scrolls away, so pinned chrome is 0 there. There is no header-height token anywhere; globals.css:154 and nos-structure.css repeat 97 as a literal.

| width | what pins | where a doc h2 lands on main | gap to pinned chrome (script) | cause |
|---|---|---|---|---|
| 390, 767 | 48px index bar at top 0 | 64 | 16 | globals.css:863 `+ 64` (16 air), not 24; `--doc-scroll-margin` 80 unused in this band |
| 768-779 | header 97, and the index bar at top 0 UNDER it (z 20 vs 60) | 64 | -33 (heading hidden behind the header) | `--doc-index-top` still 0 because the switch is at 780 (nos-structure.css:2749 `min-width: 780px`); the :2740 comment ("not sticky under 780") is wrong, the header pins from 768 |
| 780-1023 | header 97 + bar 97-145 | 161 | 64 to the header, 16 to the bar | same `+ 64` rule |
| 1024-2056 | header 97 | 112 | 15 | `--doc-scroll-margin: 112px` (nos-structure.css:2753); the rule `.doc-h2[id]` subtracts the html scroll-padding (104 on main, 0 after SAOC's fix) so the total is the variable |
| all, non-doc `#pyv-emergency-h` | header | 216 on main (112 + 104 scroll-padding), 112 once scroll-padding is 0 | 119 / 15 | `.nos-theme [id]` and `[data-nos-group]` 112px (nos-structure.css:592/597/602/607) written for a zeroed padding |
| 390-2056, `#enquire` | | 68 / 121 on main | 68-128 | SAOC's rule, fixed by their queued card fix |

Gate on main with the wrapper: 176 of 176 asserted landings fail; the chrome probe fails at 768-2056 (no token, scroll-padding 104).

## Decision
Three tokens, each defined once; every band's value is `pinned-chrome bottom + --nos-landing-air`.

| token | value | lives in | why there |
|---|---|---|---|
| `--nos-header-h` | `97px` | `:root` block of components/nos-chrome/nos-chrome.css (after `--nc-ease`) | next to `.nh`, which it describes; the `:root` there is already the NOS chrome token home |
| `--nos-landing-air` | `24px` | same `:root` | the ruling's 24, named once |
| `--doc-index-bar-h` | `48px` | `html {}` block of app/globals.css next to `--scroll-padding-top`; the index bar `height: 48px` becomes `var(--doc-index-bar-h, 48px)` | the bar is shared CSS; the fallback keeps SAOC byte-identical |

The token NOS Design asked for is **`--nos-header-h`** (name goes to NOS Design). 97 is not CSS-derivable (the brand image sets the height), so the token is a measured constant declared once, and the gate proves it: `checks/probe-chrome.mjs` fails if the header renders more than 1px from `var(--nos-header-h)` at any width >= 768. Consumers derive from the token and never retype 97.

## Exact edits (target text in goldens/expected-nos-structure-blocks.css)
1. `components/nos-chrome/nos-chrome.css` `:root`: add `--nos-header-h: 97px;` and `--nos-landing-air: 24px;` (with one-line comments).
2. `app/globals.css`: add `--doc-index-bar-h: 48px;` in the `html` block (:155); `height: 48px` -> `height: var(--doc-index-bar-h, 48px)` in `.doc-aside[data-doc-aside-kind='index']` (:869). Leave the `+ 64px` index-band rule alone (SAOC's fallback band).
3. `app/(nos)/national-show/nos-structure.css`, doc-variable block (:2737-2755), replace with:
   - corrected comment (header pins from 768, bottom 97 = `--nos-header-h`; bar 48 under 1024; side card from 1024);
   - base: `--doc-index-top: env(safe-area-inset-top, 0px)`, `--doc-scroll-margin: calc(var(--doc-index-top) + var(--doc-index-bar-h) + var(--nos-landing-air))` (390/767: 72);
   - `@media (min-width: 768px)`: `--doc-index-top: calc(env(safe-area-inset-top, 0px) + var(--nos-header-h))` (768-1023: 169);
   - `@media (min-width: 1024px)`: `--doc-scroll-margin: calc(var(--doc-index-top) + var(--nos-landing-air))` (121);
   - `@media (max-width: 1023.98px)`: `.nos-theme .doc-layout--index [data-doc-main] .doc-h2[id] { scroll-margin-top: calc(var(--doc-scroll-margin) - var(--scroll-padding-top, 0px)); }` (specificity 0,5,0 beats globals.css:863's 0,4,0 so the shared `+64` stays for SAOC).
4. Same file, hash-target rules (:591-609): `[data-nos-group]` and `[id]` become `var(--nos-landing-air)`, with a `min-width: 768px` block of `calc(var(--nos-header-h) + var(--nos-landing-air))`; ticketing-bar variants `calc(var(--nos-landing-air) + 44px)` (>=700) and `calc(var(--nos-header-h) + var(--nos-landing-air) + 48px)` (>=768). The 44/48 testing-bar heights are existing literals and stay.
4b. Same file, the sponsor card's `scroll-margin-top` rules (scope add from SAOC 2026-10-28; `[data-sponsor-enquiry='nos']`, about :4612-4625 on main, whatever shape SAOC's card fix leaves): base `var(--nos-landing-air)`, one `min-width: 768px` rule `calc(var(--nos-header-h) + var(--nos-landing-air))`, no 700px block, no literal. Only the card's own rule block may change (hunk-level diff-scope guard); pinned by `check-static.mjs sponsor-card`. Resolved: 390 -> 24, 768 -> 121, 1440 -> 121.
5. `docs/nos-anchor-landings.md` (@docs): tokens, the per-band table, the 768 switch, how to run the gate.

Order of work: SAOC's card fix first (it sets `--scroll-padding-top: 0` and `scroll-padding-top: 0` on the NOS host at all widths, and the card margin 121 / 24). The doc-heading margins are scroll-padding-independent (the calc subtracts it); the `[id]` rules are not, so the gate's probe asserts html scroll-padding-top computes 0px.

## Checks and caveats
- Trial: these exact edits plus an emulated scroll-padding zero were built and gated here: all 9 probe widths ok (landings 72 / 169 / 121 as tabled), every faq and pyv landing within 24 +/-2 at all 8 widths, `#pyv-emergency-h` 24 / 121, only `#enquire` at 390 and 767 red (SAOC's rule, absent the card fix). The edits were reverted; nothing is committed as product code.
- Vendored A13 script is report-only and does not count a sticky sub-nav as pinned: it reads 64 at 780-1023 and cannot be satisfied there without hiding the heading under the 48px bar. `checks/run-a13-8w.mjs` derives a copy that counts a <=64px sticky bar under the header as chrome, per the ruling's "plus any pinned sub-nav" (see PROVENANCE.md). If NOS Design meant header-only at 780-1023, the heading would sit under the bar; I took "no doc-index overlap" as binding.
- `/tickets` anchors sit under the committee-testing bar and are printed, not asserted.
- Turbopack served a stale globals.css from `.next` in a reused worktree during this work: build.sh refuses to build over a stale `.next`; build from a fresh worktree.
- `feat/nos-type-tokens` (unmerged, origin): no hunk touches the doc-variable block, the hash-target rules or any header-height token. It does edit nos-structure.css elsewhere and nos-chrome.css `.nh-link` / `.nh-cta` / `.nh-burger` / `.nf*` font rules (lines ~38, 66, 69, 127-157), not the `:root` block where the tokens go, so a textual merge is clean. Risk: it changes nav fonts, and min-height 44 keeps the bar at 70 only if the brand image still sets it; whichever lands second reruns probe-chrome (it fails on a header drift over 1px).
- (Superseded by 4b: the card is now in this build.) SAOC follow-up originally listed: `[data-sponsor-enquiry='nos']` in nos-structure.css:4612/4620 carries literal 68 and 121; derive them as `var(--nos-landing-air)` below 768 (68 is a leftover of the 700 break) and `calc(var(--nos-header-h) + var(--nos-landing-air))` from 768. Also presenters.css:57 (90px, assumes a 74px header) if presenters ever gain hash links.

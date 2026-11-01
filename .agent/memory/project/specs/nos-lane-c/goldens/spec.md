# NOS lane C: go-live polish (NOS Design, 2026-11-01)
Authority: Brad 2026-11-01 via SAOC, mission go-live-prep. CSS/markup only. NO COPY CHANGES. Hero frozen: NosHero, hub props and every `.nos-hero-*` rule untouched. Change nothing else.

## C1 Home h2
`.nos-theme .nos-hm-h2` (nos-structure.css ~4423): font-size `clamp(2rem, 1.2rem + 1.6vw, 2.5rem)`, font-weight 300 at every width. Delete the `@media (min-width: 800px)` weight override and its LT-1 comment. Why: 32/300 is what /what-to-expect uses on phone.

## C2 One sticky variable
`--doc-aside-top` (already on `.nos-theme`, already read by /sponsors via `.doc-aside`) is the one value. Replace the literal `top: 100px` in nos-structure.css at `.nos-pr-photo`, `.nos-hm-float-track .nos-hm-card`, `.nos-ct-card`, `.nos-we-card` with `top: var(--doc-aside-top)`. The value stays 100px: goldens/standard.json pins asideStickyTop 100 and the gate checks it on many routes. No visual change. Add no new custom property.

## C3 Scroller under the header from 768
The NOS header pins from 768, but the variables switch at 780, so at 768-779 the doc index scroller sticks at 0 behind the header. In the `.nos-theme` block (~2794) change `@media (min-width: 780px)` to `768px`; fix the nearby comment ("not sticky under 780" becomes 768). Grep the NOS CSS for other 780 rules tied to the scroller and align them only if they are about this same geometry. Update nos-content-standard/checks/gate-standard.mjs `wantTop` (~line 1001) and its D7 comment, and the `d7` text in goldens/standard.json, from 780 to 768. Do not edit any contract file. Leave gate-standard-known-defect.mjs alone (SAOC drops it after merge).

## C4 PageHero copy column cap
components/ui/PageHero.tsx, the image variant of `data-page-hero-copy`: keep `md:ml-[52%] md:pl-0`, keep 48% as the width, and cap it so the box's right edge meets the container's right edge: `width: min(48%, calc(var(--container-max) / 2 - 2%))` from md up (Tailwind arbitrary value or a small CSS rule, whichever the file's idiom favours). The container padding then puts content on the header CTA's right edge. /events/[slug] facts are the same defect: with the cap, the `start` facts row must fit, wrapping text in its cells as already allowed. Do not change `.hero-facts` type or the typographic variant. If /about facts cannot stay in one row inside the capped column, or a hero leaves 480px, STOP and report it with the measurement; do not improvise.

## C5 Countdown
- ShowBand labels: NO CHANGE. Measured on main at 11 widths from 320 to 1024, the smallest gap between labels is 34px; the @container 2-column fallback already fixed the 2026-10-25 defect. Do not edit ShowBand.tsx; the check stays as a regression guard.
- components/show/ShowCountdown.tsx:136: add `role="group"` beside the aria-label (the ShowBand precedent). Nothing else in that file.

## Delivery
Work only in `/Users/vetus/ai/SAOC NOS Design/.tmp/sandbox/go-live-c/wt`, branch polish/nos-lane-c. Never `cd`; use `pnpm --dir <wt>`. Files allowed: nos-structure.css, PageHero.tsx (and globals.css only if the C4 rule lives there), ShowCountdown.tsx, gate-standard.mjs, standard.json. Do not edit `checks/lane-c.mjs` in this spec or anything else. Commit per item with messages `fix(nos): ...`; do not push. Report commits, check output and anything you could not hold.

The test server is already running on port 3094 with hot reload, serving this clone: http://nos.localhost:3094 and http://localhost:3094. Do not start another server or kill anything. Do not run a production build. Run the checks from the clone with `pnpm --dir <wt> exec node .agent/memory/project/specs/nos-lane-c/checks/lane-c.mjs C1` (C1 to C5). Also run `pnpm --dir <wt> type-check` and `pnpm --dir <wt> lint`.

## C4 amendment (NOS Design review of 55fe59aa)
The capped column breaks "Western" mid-word on the event hero ("Wester / n Cape") at 1440 and 2056. Never acceptable. In app/globals.css, `.hero-facts[data-facts-align='start']` only: remove `min-width: 0` from the `> div` rule and change `overflow-wrap: anywhere` to `overflow-wrap: break-word` on its dd and dt, so a cell cannot shrink below its longest word. If the row then overflows at 1024, reduce the `gap` to 24px on the start variant only from 1024 up. Do not change font sizes, the centred variant, or the copy. Update the "Event hero only" comment if it no longer holds. check C4 now also requires no broken word and facts inside the viewport at 768, 1024, 1280, 1440, 2056.

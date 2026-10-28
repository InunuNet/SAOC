# nos-archive-back-arrow

Base: origin/main 8d9027c9. Branch: fix/nos-archive-back-arrow. Architect: contract and gate only, no product code.

## Cause

`app/(nos)/national-show/archive/[year]/page.tsx` renders U+2190 as text at two places:

| line | element | text |
|---|---|---|
| 166 | hero back link, `data-nos-backlink`, `href="/archive"` | `← Past shows` |
| 227 | prev-show link, `href="/archive/{prevShow.year}"`, a `<span>` inside a `group flex flex-col` link | `← Earlier` |

No shipped font has U+2190, so the browser falls back to a system glyph. These are the only two U+2190 under `app/(nos)`, `components/nos`, `components/nos-chrome` and `components/tickets` on main (gate A1 prints exactly these two). `Later →` at :242 is U+2192 and is out of scope: the rulings name only the two back arrows.

## Rulings (final, verbatim; also in goldens/rulings.md)

NOS Design, ruling (b) follow-up:

> archive/[year]/page.tsx:166 "← Past shows" and :227 "← Earlier". Use the NOS keepsake arrow mirrored, not components/ui/ArrowIcon. NOS keeps one arrow system (CRIT-13). Both are cross-route links, so the arrow is allowed. The gate is the same as A23, and no system-glyph arrow may remain on the NOS host.

Also from (b): the arrow leads the label, mirrored via scaleX(-1), with no literal space.

Answers to the three questions:

> 1. The keepsake stands as it is, at .nk-icon 1.1em with the 24-unit path, mirrored. The (b) geometry is SAOC's only; NOS keeps one arrow. 2. Gap: the same value the forward keepsake uses on NOS today, on the trailing side (margin-inline-end). 3. Hover: translateX(−3px), mirroring .nk-btn with the same timing. No nudge under reduced motion. Gate: mirror parity ±0.5px (width, gap, vertical) and zero U+2190 on the NOS host.

## Fix shape (what @dev implements)

1. Import `ArrowIcon` from `@/components/tickets/keepsake/parts` (components/tickets/keepsake/parts.tsx:20; a stateless server-safe function, `<svg class="nk-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">`, paths `M5 12h14` and `m12 5 7 7-7 7`). Do not edit it (A4). Do not use `components/ui/ArrowIcon` (A3).
2. In the two links, replace the U+2190 text with `<ArrowIcon />` placed before the label, no literal space between them (JSX children, no `{' '}`). The label text node stays exactly `Past shows` / `Earlier` (A10 checks the raw text node).
3. Mirror and gap, in `app/(nos)/national-show/nos-structure.css` (the file that already holds `.nk-icon` and the back-link rule at :273), scoped to these two arrows only so no forward keepsake changes: `transform: scaleX(-1)` and `margin-inline-end: 10px`. The icon size is left to `.nos-theme .nk-icon` (nos-structure.css:1284-1286, `1.1em`); do not override width or height (ruling answer 1).
4. Hover: `translateX(-3px)` combined with the mirror (`transform: translateX(-3px) scaleX(-1)`), triggered by hovering the link. The transition is `transform var(--dur-slow) var(--ease-nos)` and is declared only inside `@media (prefers-reduced-motion: no-preference)`, exactly as `.nk-btn .nk-icon` does at nos-structure.css:1327-1329. Under `reduce` there is no nudge and no transition.
5. Layout: the "Earlier" label is a `<span>` in a column flex link; the arrow plus label need an inline row (`inline-flex`, `align-items: center`) around that one span so the year line below is not disturbed. The back link is already `inline-flex items-center min-h-[44px]` (nos-structure.css:273-277). Focus ring, the 44px floor and tab order must not change (A12).

### The forward-keepsake gap

`.nos-theme .nk-btn { display: inline-flex; align-items: center; gap: 10px; ... }` at `app/(nos)/national-show/nos-structure.css:1303` (rule opens at :1296). The forward arrow's spacing is a flex `gap`, not a margin, so the value is **10px**; the back arrow reproduces it as `margin-inline-end: 10px` (ruling answer 2). The gate reads the live forward gap from a real `a.nk-btn` on `/tickets` and requires it to be 10px, so the golden cannot drift from the page.

## Decision flags for NOS Design (no ruling needed to proceed; my assumption stated)

- **Width.** Ruling answer 1 says the keepsake stands at `.nk-icon` `1.1em`. Inside `.nk-btn` the forward arrow is overridden to 16px (nos-structure.css:1315-1318) and inside `.nk-visit a` to 15px (:2158-2161), so there is no forward arrow at `1.1em` to measure against. Assumption: parity for width means (i) the back arrow is `1.1em` of its own link font-size (13.2px on a 12px link) and (ii) mirroring changes nothing (the mirrored box equals the same icon with the transform removed). Not asserted: equality with the 16px `.nk-btn` arrow.
- **Gap.** `.nk-visit a` uses `gap: 8px` (:2146), `.nk-btn` uses 10px. I took `.nk-btn` because the hover ruling names it ("mirroring .nk-btn"). If NOS Design meant 8px, change `forwardGapPx` in goldens/values.json and nothing else.

## Gate design

Everything that touches Sanity runs on fixture replay only: `SANITY_FIXTURE_MODE=replay` against a sandbox copy (`.tmp/sandbox/nos-archive-back-arrow-fixtures/sanity`) of the tracked nos-content-standard capture, `K_SERVICE` unset, `apicdn`/`api` Sanity hosts blocked in the build, the server and the browser. Each gate fails on any blocked request or fixture miss. Nothing reads the live dataset.

**No real archive year exists in the replay fixtures.** The tracked capture's `pastShowsQuery` result is `[]`, so `/archive/<real year>` is a 404 in replay. The gate overlays one synthetic key into the sandbox copy only (goldens/fixture-stubs/70c1b662...json: two `status: "past"` shows, 2024 and 2023, year and status only, `capturedAt: "synthetic-gate-stub"`). 2023 exists so 2024 has a prev show and the "Earlier" link renders. The tracked set is never written. This is test data, not content.

Servers: `next start` on port 3190 (override `NOS_ARROW_PORT`; the build bakes the same port into the site URLs), beta wall up, `SHOW_PLACEHOLDER_PREVIEW=true` so the archive route is not withheld. The child PID goes to `.tmp/sandbox/nos-archive-back-arrow-gate/pids/3190.pid` and only that exact PID is killed (`proc.kill()`); no pkill.

Browser: Playwright chromium from `@playwright/test`, no install. If the default cache lacks the revision, set `NOS_ARROW_PW_BROWSERS=.tmp/sandbox/pw-browsers` (the symlink directory the nos-type-tokens worktree uses: `chromium_headless_shell-1243 -> ~/Library/Caches/ms-playwright/chromium_headless_shell-1217`).

`node_modules` for this worktree was cloned from `.tmp/sandbox/nos-type-tokens/node_modules` with `cp -cR` (identical pnpm-lock.yaml, no network, no install).

| id | covers | what it proves | main |
|---|---|---|---|
| A1 | (a) | no U+2190 or escaped spelling in the four source roots | red (:166, :227) |
| A2 | ruling | page imports the keepsake `ArrowIcon` | red |
| A3 | ruling | page does not import `components/ui/ArrowIcon` | green (guard) |
| A4 | ruling 1 | `parts.tsx` unchanged since 8d9027c9 | green (guard) |
| A5-A7 | (g) | `tsc --noEmit`, eslint on the NOS roots, fixture-replay production build | green |
| A8 | (b) | rendered HTML of `/archive/2024`, `/archive/2023`, `/archive`, `/faq`, `/` on the NOS host: 200 and no U+2190, `&larr;`, `&#8592;`, `&#x2190;`, `←` | red |
| A9 | (c) | +-0.5px: width = 1.1em, mirrored box = unmirrored control (width, left, vertical centre), gap = 10px = live forward `.nk-btn` gap, `margin-inline-end` = 10px, icon-vs-label vertical offset = the forward keepsake's | red |
| A10 | (d) | one `svg.nk-icon` per link, `aria-hidden="true"`, `focusable="false"`, no tabindex, leads the label, label text node exact (no literal space), computed transform `matrix(-1,0,0,1,0,0)` at rest | red |
| A11 | (e) | hover moves the icon -3px (+-0.5) under `no-preference`, 0 under `reduce`, both links | red |
| A12 | (f) | Tab reaches both links in the same number of stops as main, `:focus-visible` outline style/width/offset/colour equal main, height >= 44 and >= main | green (guard) |

`goldens/baseline-main.json` is recorded once on main with `node .../gate-dom.mjs focus --record` (the same command re-records it; do not re-record on the fix branch).

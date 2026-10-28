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
3. Mirror and gap, in `app/(nos)/national-show/nos-structure.css` (the file that already holds `.nk-icon` and the back-link rule at :273), scoped to these two arrows only so no forward keepsake changes: `transform: scaleX(-1)` and `margin-inline-end: 8px`. The icon size is left to `.nos-theme .nk-icon` (nos-structure.css:1284-1286, `1.1em`); do not override width or height (ruling answer 1). With the label at 14px the arrow is 15.4px.
3a. Labels move to the NR-8 Caps tuple in this change (A13): Karla 700, 14px, letter-spacing 0.12em, uppercase, on both labels ("Past shows" at page.tsx:164 `text-[12px] ... tracking-[0.14em]`, "Earlier" at :226 `text-[12px] ... tracking-[0.18em]` on base). The gate asserts computed values, not a token name: type-tokens' `--w-caps` is not on main.
4. Hover: `translateX(-3px)` combined with the mirror (`transform: translateX(-3px) scaleX(-1)`), triggered by hovering the link. The transition is `transform var(--dur-slow) var(--ease-nos)` and is declared only inside `@media (prefers-reduced-motion: no-preference)`, exactly as `.nk-btn .nk-icon` does at nos-structure.css:1327-1329. Under `reduce` there is no nudge and no transition.
5. Layout: the "Earlier" label is a `<span>` in a column flex link; the arrow plus label need an inline row (`inline-flex`, `align-items: center`) around that one span so the year line below is not disturbed. The back link is already `inline-flex items-center min-h-[44px]` (nos-structure.css:273-277). Focus ring, the 44px floor and tab order must not change (A12).

### The forward-keepsake gap (ruled by NOS Design: 8px)

> 1. 8px. These are text links, so they take the .nk-visit gap; 10 is the button gap. 2. Yes, 1.1em of the label, checked mirrored against unmirrored. But the labels can't stay at 12px uppercase: NR-8 Caps is 14. If type-tokens doesn't already cover these two, move them to the Caps tuple in this change, which makes the arrow about 15.4px.

`.nos-theme .nk-visit a { display: inline-flex; align-items: center; gap: 8px; ... }` at `app/(nos)/national-show/nos-structure.css:2146` on base 8d9027c9 (rule opens at :2143). The forward arrow's spacing is a flex `gap`, not a margin, so the value is **8px**; the back arrow reproduces it as `margin-inline-end: 8px`. `.nk-btn` is 10px (:1303) and is not the reference. The gate reads the live gap from a real `.nk-visit a` on `/tickets` and requires it to be 8px, so the golden cannot drift from the page.

### Caps scope note

type-tokens (feat/nos-type-tokens 4e7fe348, docs/nos-type-tokens.md) limits Caps to buttons, pills, countdown units and footer heads, and does not touch `archive/[year]/page.tsx`. NOS Design's ruling adds these two back links to Caps. The `--w-caps` token does not exist on main, so A13 checks the computed tuple (Karla 700, 14px, 0.12em, uppercase) and works with or without the token.

## Resolved flags

Width and gap flags from the first draft are closed by the ruling above: width = 1.1em of the 14px label (15.4px), mirrored equals unmirrored; gap = 8px.

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
| A8 | (b) | every NOS-host HTML route, discovered from the built `.next/server/app-paths-manifest.json` (`/(nos)/` pages), the NOS `sitemap.xml`, the goldens' `/archive/2024`, `/archive/2023`, and a same-origin link crawl (cap 400 pages): 200 or non-5xx, and no U+2190, `&larr;`, `&#8592;`, `&#x2190;`, `\u2190` (37 routes on the current build) | red |
| A9 | (c) | +-0.5px: width = 1.1em = 15.4px, mirrored box = unmirrored control (width, left, vertical centre), gap = 8px = live forward `.nk-visit a` gap, `margin-inline-end` = 8px, icon vertical centre = the label's cap midline (canvas `actualBoundingBoxAscent` of "H" / 2 up from the baseline), NOS Design: 'On a caps label the optical target is the cap midline' | red |
| A10 | (d) | one `svg.nk-icon` per link, `aria-hidden="true"`, `focusable="false"`, no tabindex, leads the label, label text node exact (no literal space), computed transform `matrix(-1,0,0,1,0,0)` at rest | red |
| A11 | (e) | hover moves the icon -3px (+-0.5) under `no-preference`, 0 under `reduce`, both links | red |
| A13 | ruling | both labels compute Karla 700, 14px, 0.12em, uppercase | red (12px) |
| A12 | (f) | Tab reaches both links in the same number of stops as main, `:focus-visible` outline style/width/offset/colour equal main, height >= 44 and >= main | green (guard) |

`goldens/baseline-main.json` is recorded once on main with `node .../gate-dom.mjs focus --record` (the same command re-records it; do not re-record on the fix branch).

Gate self-proof: with the fix shape injected (`gate-dom.mjs <mode> --selftest`, never in the contract; the script refuses to run at all if `NOS_ARROW_SELFTEST` is set in the environment, and every contract command runs under `env -u NOS_ARROW_SELFTEST`) A9, A10, A11 and A13 pass against a main build; A12 stays green on main.

## Running the gate end to end

```
CONTRACT_GATE_RESIDUE_FIXTURE=.agent/memory/project/specs/nos-archive-back-arrow/goldens/residue-fixture-clean.json \
  python3 execution/contract.py gate .agent/memory/project/specs/nos-archive-back-arrow/contract.yaml --phase 4 --run-checks
```

- **Residue guard.** `contract.py` runs `scripts/scan-dataset-residue.ts` before and after the assertions. Pointed at the live dataset it fails open on any scanner error (and the Sanity CDN quota is exhausted). `CONTRACT_GATE_RESIDUE_FIXTURE` (execution/contract.py:777) switches the scan to a local JSON file, so the guard runs for real, reads no live dataset, and cannot fail open. `goldens/residue-fixture-clean.json` is a copy of `contracts/golden/dataset-residue-guard/fixture-clean.json`; the scan prints "ALL CLEAR" on it.
- **Timeouts.** Shell assertions default to 60s; A5-A13 carry their own `timeout_seconds` (build 900, the rest 300).
- **Triad.** A14 (`codex_qa`), A15 (`browser_deployed_check`) and A16 (`gws_inbox_check`, `required: false`: no email is sent) are declared the way admin-redesign/contract-f1.yaml does. A14 runs the Codex wrapper against `goldens/codex-qa-prompt.md`. A15 needs `.agent/memory/scratch/nos-archive-back-arrow-browser-manifest.json`, written by the orchestrator's BrowserAgent run against the deployed beta origin at the HEAD commit within 4 hours (docs/verification-triad-gate.md); until it exists A15 cannot pass. The scratch manifests are not part of this commit.

## A8 route coverage: what is skipped, and why

A8 prints the checked and skipped lists on every run. Deliberately not visited: `/og` (a route handler that returns an image, no HTML); unresolved `[dynamic]` templates (`/archive/[year]`, `/tickets/[slug]`) which are visited instead through their real values from the sitemap, the fixture stub years and the link crawl; any link that leaves the NOS origin; non-HTML responses (the crawl ignores asset, `.xml`, `.ics`, `/_next` and `/api` links); and a redirect that leaves the NOS origin (recorded in the skipped list). Redirects inside the origin are followed. Token-gated vendor pages are visited and checked as rendered (their no-token state). A page the crawl cannot reach by any link and that is neither in the manifest nor the sitemap would escape; there are none today (37 routes checked, 0 skipped on the 9d26c274 build).

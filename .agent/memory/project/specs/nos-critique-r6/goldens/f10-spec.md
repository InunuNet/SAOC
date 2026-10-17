# nos-critique-r6 f10 -- group sub-nav at <768 (NOS Design "Codi" ruling, critique H1, audit 2.4.7; lead approved into r6 2026-10-17)

**Naming.** The brief says ShowSectionNav. `components/show/ShowSectionNav.tsx` is the footer "More on the National Show" grid (R21,
never a scrolling row, no aria-current). The horizontally scrolling row with the aria-current item is the R27 group sub-nav under every
inner hero: `components/nos/NosSubNav.tsx` (client component, one effect) styled by `.nos-subnav*` in
`app/(marketing)/national-show/nos-structure.css`. This contract targets those two files. If the ruling was about the footer grid, stop and say so.

Sources (no-invention): the ruling above; design/design_handoff_saoc/ + branding/ for tokens; no copy changes (labels come from
nav-config via nos-subnav-groups.ts, untouched).

## Today (BASE)
`@media (max-width: 700px)`: the row scrolls (`overflow-x:auto`, snap), the effect centres the current item with `scrollLeft`, an 8px
right-edge fade span shows while overflowing, `scroll-padding-inline` and `padding-inline` are `--nos-axis-pad`, no start fade, no
resize/scroll updates (only `resize` toggles `data-overflowing`).

## Change (two files only: NosSubNav.tsx and nos-structure.css)
1. **Breakpoint (Codi: measure, do not assume).** 767 ONLY if a row genuinely overflows between 701 and 767; otherwise the R27 700px stays.
   `f10-capture-pre.mjs` measures the natural width (links + 24px gaps) against the row's room at 701, 720 and 767 on the four groups (about,
   programme, sa-exhibitors, sponsors) and records `goldens/f10-breakpoint.json` (`maxWidthPx` 767 or 700 plus the numbers). Every scroller rule
   uses that one `@media (max-width: <maxWidthPx>px)`; nothing outside it may change for `.nos-subnav*` (static compares the non-media rules to
   BASE, so >=768 is untouched by construction; the rendered check also compares screenshots). The rendered check at 720 asserts whichever case the
   JSON records: 767 = every group's row scrolls (overflow-x auto, nowrap, fade flags consistent); 700 = rows still wrap with no fade.
   **Recorded measurement: PENDING the capture run on a real build** (the estimate from label lengths at ~7.6px/char puts the 5-item Programme group
   near 630px against ~660px of room at 720, i.e. it may fit, so 700 may be the outcome; the capture decides).
2. **Lead.** The scroller `ul.nos-subnav-row` has `padding-inline: 16px` and `scroll-padding-inline: 16px` (keep the full-bleed negative margin).
   The first item is never clipped at scrollLeft 0.
3. **Bring current into view (Codi, final: NOT scrollIntoView, which can scroll the page vertically past the hero).** In the effect, when the row
   overflows (`row.scrollWidth > row.clientWidth + 1`), set `row.scrollLeft = clamp(current.offsetLeft - 16, 0, row.scrollWidth - row.clientWidth)`
   with `Math.max` / `Math.min`. `offsetLeft` is relative to the item's offsetParent, so make the row (`ul`) `position: relative` so the formula is
   measured from the scroller; the rendered check measures the result (>= 16px lead, fully in view, `window.scrollY === 0`). No `scrollIntoView`
   and nothing smooth anywhere.
4. **Fade.** A 40px edge fade (Codi FINAL: ink reaches alpha 0 at the edge; right edge `linear-gradient(to left, transparent 0, #000 40px)`, mirrored `to right` for the left edge) by `mask-image: linear-gradient(...)` on the scroller, only on an edge that hides items. The component
   sets `data-fade-start` (scrollLeft > 1) and `data-fade-end` (more content to the right: `scrollLeft + clientWidth < scrollWidth - 1`)
   on the `nav` or the `ul` via `toggleAttribute`; CSS keys three masks on them (start only, end only, both) inside the 767px query.
   No flag, no mask (`mask-image: none`). Update on `scroll` (passive) and `resize`; remove both listeners on cleanup. The old 8px
   `.nos-subnav-fade` span and its gradient rule go (the span may be deleted from the JSX).
5. **Unchanged:** 44px item height, hidden scrollbar (`scrollbar-width: none` + webkit rule), snap, 24px gap, link type, aria-current styling.

## Precondition (once, before editing)
With f1..f8 applied and f10 NOT yet started, build and run `node .agent/memory/project/specs/nos-critique-r6/checks/f10-capture-pre.mjs`.
It writes `goldens/f10-pre-programme-1280.png` and `goldens/f10-pre-faq-1280.png` (the stack's own 1280 sub-nav) and refuses to run on a
tree that already carries f10. Commit them with the spec. `f10-rendered.mjs` is red until they exist, by design.

## ShowSectionNav rename (Brad's naming ruling, via the lead)
`components/show/ShowSectionNav.tsx:46`: "SAOC Symposium" becomes "National Orchid Show Symposium" (the `label` and the `hint`, the only two occurrences; every other
character of the file's copy unchanged). `f10-static.mjs` S4 asserts exactly that. **No page renders this component** (it is exported from
`components/show/index.ts` and imported nowhere), so there is no rendered footer-grid label to assert; the footer grid users see is `NosShowIndex`,
which reads labels from nav-config and is untouched. Other "SAOC Symposium" strings on rendered NOS pages (programme/symposium/conferences pages,
nav-config descriptor, ticket-taxonomy) are outside this ruling and untouched. Note f1's T8 (copy strings unchanged in every changed .tsx) will flag
this one-file copy change in the stacked tree, so f1 needs an exemption for ShowSectionNav.tsx.

## Checks
`f10-static.mjs` (A3), `f10-footprint.mjs` (A2), `f10-rendered.mjs` (A6: /programme, /symposium, /conferences at 390 = current first,
middle, last of the 5-item Programme group; plus reduced motion, resize and scroll fade updates, 44px items, no scrollbar, no page
overflow; and the two 1280 screenshot diffs). SAOC and every other file untouched (A2).

## Gutter lead (Codex P3, lead ruling)
Below the breakpoint the row's padding-inline is `var(--nos-axis-pad)` (clamp(16px, 2.5vw, 32px)), so a fixed 16px lead drifts. Spec: `scroll-padding-inline: var(--nos-axis-pad)`
and the JS lead is `parseFloat(getComputedStyle(row).paddingLeft)` (scrollLeft = clamp(item.offsetLeft - lead)). Rendered GUTTER block: at 390 (gutter 16) and at the
recorded breakpoint width (gutter > 16) padding and scroll-padding equal the gutter, and a mid-scroll current item sits exactly one gutter in.

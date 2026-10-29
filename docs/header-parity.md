# HD-1 / HD-1b: one header and one container on both hosts

NOS Design HD-1 and HD-1b (final). Brad: switching between the SAOC site and the National Orchid
Show should be almost seamless; the visuals change, the header breakdown and sizes do not. The
reference is the NOS v4 header (`.nh` in `components/nos-chrome/nos-chrome.css`). SAOC moved to it.

## Structure

Both headers: no utility bar, a sticky bar with a permanent 1px bottom rule, lockup, nav, CTA and,
below the full breakpoint, a labelled MENU button. SAOC also has a 44x44 search button between the
nav and the CTA. The retired utility bar's pieces moved: "Join a society" (`/societies`) is the SAOC
CTA, `info@saoc.co.za` is in the footer brand column directly under the REG/NPO line, and the show
pill is gone.

## Hooks (`data-hd`)

Both headers carry the same attributes so one script (`checks/measure-header.js`) reads either:
`bar` (the flex row), `brand` (lockup link), `nav`, `item` (each top-bar link or trigger), `label`
(the span that owns the bar slot), `cta`, `menu` (the MENU button) and, on SAOC, `search`. The SAOC
drawer's search row is `drawer-search`.

## Shared breakpoints

Set by the longer SAOC row and always changed together (`goldens/header-geometry.json`):

| Width | Layout |
|---|---|
| 1384 and up | inline nav, search (SAOC), CTA |
| 780 to 1383 | lockup, CTA, then MENU; SAOC search is the drawer's first row |
| below 780 | the lockup takes the whole first row, CTA and MENU below, header not sticky |

Full = 1384 is the ruled fit (SAOC row 1301.1px of content plus gutters and a classic scrollbar,
rounded up). Row = 780 is measured (405 lockup + 24 + 168.4 CTA + 24 + 104 MENU, plus gutters and
scrollbar). The NOS media queries, `PANEL_BREAKPOINT_QUERY` and the lockup `<picture>` source move
with them. Tailwind's `max-[780px]` is `width < 780px`, the exact complement of `min-[780px]`.

## Sizes

- Bar: 13px block padding (16 top, 12 bottom below 780), gutter inline, gap 12, 97px tall at full
  size. Brand to nav is at least 24 (12 margin + 12 gap); nav to search and search to CTA are 12;
  NOS nav to CTA is 12.
- Items: 44px tall, `0 9px` padding, 2px gap, 600 14.5px/1, own sans per host, no tracking.
- CTA: 44px tall, `10px 24px` padding, 10px radius, 700 13px/1, 0.12em tracking, uppercase.
- MENU: 44px tall, 104px minimum width, `1.5px solid var(--nh-control-border)`. The token is nav ink
  at 28% over the ground, one solid colour per host: SAOC `#b6b6b0` (`globals.css`), NOS `#bebbc5`
  (scoped to `.nh`). `--rule` is not close enough (dE 12.6).
- States: hover and `:focus-visible` colour the text to the indicator colour and draw a 2px bar at
  the label's `-8px` slot; current (`aria-current`) is a persistent 2px bar in the same slot. No
  fill on menu items; only the open NOS trigger keeps its fill.

## Lockup decision

Parity is by ink width, not height. Each host keeps its own supplied lockup file, uncropped,
unfiltered and not recoloured (SAOC: the full-name PNG, Lee-Ann 2026-10-15). The lockup link is
`min(container, 405px)` wide on both hosts (405 at 780 and up, the container below) and SAOC's is
405:70, the NOS ink box, so the first row has the same height on both at every width and the SAOC
file is centred in it. Header height is therefore equal (97 at row and above, 155 at 760, 147 at 390).
NOS sizes its image from the link box with container units (`cqw`), so its transparent margin falls
outside the box at any width.

## Mobile drawer

Below 1384 the SAOC drawer's first row is a full-width 44px search row ("Search SAOC", the search
dialog's own label) that closes the drawer and opens the dialog. The header icon keeps
`aria-label="Open search"` above 1384.

## Container (HD-1b)

`--container-max` is `calc(1320px + 2 * clamp(16px, 2.5vw, 32px))` and `--container-pad` is
`clamp(16px, 2.5vw, 32px)`: the NOS box. `.saoc-container` follows with no page edits. Files that
hard-coded `max-w-[1280px] px-8` moved onto the class: `Breadcrumb`, `PageHero`, the society page,
`not-found`, and `SectionNav` / `ShowSectionNav` on the NOS pages (their left edge would otherwise
sit 52px right of the lockup at 2056). The society page also drops its `md:px-16` so its content
starts on the lockup's left edge. `admin/PageHeader.tsx` is out of scope.

Because the sticky header is now 97px, `html { scroll-padding-top }` moved from 5rem to 6.5rem so a
focused element is not covered (WCAG 2.4.11).

## Verification

Static checks in `.agent/memory/project/specs/nav-focus-underline/checks/` (`check-header-spec.mjs`,
`check-container.mjs`, `compare-geometry.mjs --selftest`) cover what a measurement cannot name. The
measured gate (`compare-geometry.mjs` on `hd1-geometry-measurements.json`) runs after deploy.

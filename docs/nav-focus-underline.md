# NAV-1: underline focus, route-change focus, aria-current

NOS Design ruling NAV-1 (final). Brad's complaint: a box drawn around the selected menu item.
The box was the keyboard focus ring on header nav links: after a client-side navigation focus
stayed on the clicked link, so the next keypress drew a ring on an idle page, and no header link
carried `aria-current`.

## What changed

| Area | Before | After |
|---|---|---|
| Nav and footer link focus | `ring-2` (SAOC), blanket `.nh :focus-visible` / `.nf :focus-visible` outline (NOS) | 2px underline in the indicator colour, UA outline cleared, `forced-colors` fallback |
| After a navigation | focus stayed on the clicked link | focus moves to the new page's `<h1>`, else `<main>` (`RouteFocus`) |
| Current item | class-driven (`startsWith`, `data-current`) | `aria-current` from one segment-boundary matcher, the visual hangs off `[aria-current]` |

Buttons and fields keep their rings (search, MENU, drawer Close, drawer search row, the Tickets
CTA, the NOS burger, the newsletter field, checkbox and button). The brand lockup links keep theirs.

## Files

- `lib/nav-current.ts`: `isNavCurrent`, `navAriaCurrent`, `anyNavCurrent`. Query and hash are
  stripped, one trailing slash is ignored, both sides go through `nosPath()` so `/faq` and
  `/national-show/faq` agree, `/` and the NOS hub match exactly, everything else matches the path
  or a descendant on a segment boundary (`/events/x` marks Events, `/eventsfoo` does not).
  Matching is case-sensitive. Absolute hrefs and `crossSite` items are never current.
- `lib/route-focus.ts`: the pure core (`shouldMoveRouteFocus`, `focusRouteTarget`,
  `ROUTE_FOCUS_ATTRIBUTE`, `ROUTE_FOCUS_WAIT_MS`). It skips the first render, an unchanged path
  and a hash navigation, never steals focus already inside `#main-content`, adds `tabindex="-1"`
  only when the target has none, sets a one-shot `data-route-focus` marker and focuses with
  `preventScroll`.
- `components/site-chrome/RouteFocus.tsx`: client component mounted after the header and `<main>`
  in `SaocFrame` and `NosFrame` (not in admin). If the page's `<h1>` has not streamed in it
  watches `#main-content` with a `MutationObserver` for up to one second. It sits after `Header`
  in tree order, so on a mobile-menu navigation its effect runs after the focus trap has handed
  focus back to the hamburger and the heading wins.
- `app/globals.css`: `[data-route-focus]:focus { outline: none; }`. The marker exists only while a
  route focus holds focus, so the skip link's focus on `<main>` is unchanged.

## Decisions

- **`aria-current="true"` on NOS disclosure triggers.** The Visit, Programme and Exhibit & trade
  triggers (header and drawer) are buttons that do not navigate. They carry `aria-current="true"`
  when one of their pages is current; `"page"` would misreport a control that is not itself a page
  link. The visual selector is `[aria-current]`, so both values draw the same bar. Leaf links, the
  hub, Contact and the Tickets CTA carry `"page"`.
- **SAOC footer uses ivory, not `--primary`.** The footer ground is `--primary-800`, where
  `--primary` text would disappear. Focus uses the hover colour `--ivory` plus a 2px `--ivory`
  underline at a 4px offset. The classes sit on `Footer.tsx`, not in `footer-data.ts` (shared with
  the NOS footer).
- **NOS plain links get the active bar too.** Show sponsors and Contact carried `aria-current`
  with no mark. Their label is wrapped in `.nh-label` so they draw the same bar as the triggers.
- **Focus beats current.** When an item is current and focused the bar is `--nc-royal` (3:1 on the
  ground); `--nc-green-1` is 2.4:1, which is pre-existing and not changed.
- **NOS credit lockup link in the footer** (`SaocLockup`, a brand-style link) has no rule of its
  own and shows the browser default focus outline. It is not a link list and the old blanket rule
  is gone.

## Indicator colours and contrast (WCAG 1.4.11)

| Surface | Indicator on ground | Ratio |
|---|---|---|
| SAOC header and mobile menu | `--primary` on `--parchment` | 9.5:1 |
| SAOC mobile menu row | `--primary` on `--bone` | 8.5:1 |
| SAOC footer | `--ivory` on `--primary-800` | 13.6:1 |
| NOS header and drawer | `--nc-royal` on `--nc-ground` | 14.8:1 |
| NOS footer | `--nc-ground` on `--nc-royal` | 14.8:1 |

## Forced colours

A background bar vanishes in forced-colours mode. SAOC links add `forced-colors:` variants
(underline, decoration colour `Highlight`); NOS adds an `@media (forced-colors: active)` block
with a `Highlight` outline on the focused link families.

## Verification

`.agent/memory/project/specs/nav-focus-underline/checks/`: `check-nav-current.mjs`,
`check-route-focus.mjs`, `check-focus-static.mjs` (nine modes), `check-contrast.mjs`,
`check-scope.mjs`. The post-deploy BrowserAgent protocol (click leaves focus on the `<h1>` on
desktop, mobile menu and the NOS drawer; Tab shows the underline with no ring; accessibility tree
shows `current`) is in the goldens README.

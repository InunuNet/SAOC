# Golden: F1 — "About the Show" mega-menu column

## `components/chrome/nav-config.ts` — `show` NavItem's `columns` array

Exactly 2 `NavColumn` entries, in this order:

1. **`id: 'about'`**, `heading: 'About the Show'`, `headingHref: '/national-show'`, 4 links:
   | link id | label | href |
   |---|---|---|
   | `what-to-expect` | What to Expect | `/national-show/what-to-expect` |
   | `plan-your-visit` | Plan Your Visit | `/national-show/plan-your-visit` |
   | `faq` | FAQ | `/national-show/faq` |
   | `archive` | Archive | `/national-show/archive` |

2. **`id: 'tickets'`**, `heading: 'Tickets'`, `headingHref: '/national-show/tickets'`, unchanged,
   still exactly these 5 links in this order: `visitor`, `exhibitor`, `vendor`, `conferences`,
   `workshops` (see `ticketing-conferences-and-events/goldens/f4-nav-wiring.golden.md` for their
   exact label/href pairs — not repeated here, must not be touched by F1 at all).

## `components/chrome/MegaMenu.tsx`

Only the columns-wrapper layout changes (e.g. the `flex flex-col gap-6` container around
`item.columns.map(...)` gains a responsive two-column arrangement at `sm:`/`lg:` breakpoints —
`sm:grid-cols-2`-style or `sm:flex-row`). No new Tailwind color/spacing tokens. No change to:
- the trigger button
- the `aria-haspopup`/`aria-expanded`/Escape/outside-click logic
- individual link/heading markup or classes (so focus/hover/keyboard behavior is inherited
  unchanged — no `outline-none` or `focus:outline-none` may be introduced)
- the "Visit National Show →" footer link

## `components/chrome/MobileMenu.tsx` and `components/chrome/Header.tsx`

Zero diff against the pre-F1 baseline. `MobileMenu.tsx` already renders `columns.map(...)`
stacked inside one accordion panel; a second column entry needs no code change there.

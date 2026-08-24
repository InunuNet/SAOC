# contact-mobile-nav-fix — F1 golden spec

## The defect (confirmed live at 375px)

`components/chrome/Header.tsx` renders three zones: logo, primary nav (`NAV.map`,
`hidden min-[1240px]:flex`), and actions. The Contact CTA
(`components/chrome/Header.tsx:143-148`) is a standalone `<Link href="/contact">` styled
as a filled button, classed `hidden sm:inline-block` — hidden below the `sm` (640px)
breakpoint, not part of the `NAV` array.

`components/chrome/MobileMenu.tsx` renders exactly two link sources: the `nav` prop
(`NAV` from `components/chrome/nav-config.ts` — About, Societies, Judging & Awards,
National Show [mega], Events, Learn [disabled]) and a `mailto:council@saoc.co.za` link in
the footer meta block. Neither source contains `/contact`.

At a 375px viewport: the Contact CTA is hidden (`sm:` requires >=640px) and the hamburger
trigger is the only header affordance (`min-[1240px]:hidden`). Opening the mobile menu
renders the NAV-derived list plus the mailto: footer link — zero `a[href="/contact"]`
anywhere in the header before or after opening the menu. The footer (`app/**/layout` /
site footer, out of scope here) is the only remaining path to `/contact` on mobile. This
is a real navigation gap on the public marketing site.

## Root cause

Pure omission, not a rendering bug: `/contact` was never added to any data source
`MobileMenu.tsx` reads. `NAV` (`nav-config.ts`) is shared by both the desktop primary nav
(Zone 2, `min-[1240px]:flex`) and `MobileMenu`'s nav list — but the desktop Contact
affordance was implemented as a separate CTA button in Header's Zone 3 (actions), not as
a `NAV` entry. Because of that split, appending `/contact` to the shared `NAV` array is
**not** available as a single-source-of-truth fix here: `NAV` also drives the desktop
Zone 2 primary nav at >=1240px, and appending a `contact` entry there would add a second,
new "Contact" nav link to the desktop primary nav in addition to the existing Zone 3 CTA
button — a desktop layout change, which is explicitly out of scope. `NAV` and
`nav-config.ts` are therefore untouched by this fix.

## Fix direction (binding on @dev)

Add a `/contact` link inside `components/chrome/MobileMenu.tsx` only, visually consistent
with the other mobile nav items (same `<li>`/`<Link>` treatment as a plain `NAV` link
item — `flex items-center px-3 py-3 font-sans text-[15px] text-ink hover:text-primary
hover:bg-bone rounded-sm transition-colors duration-150` plus the existing focus-visible
ring classes), and call `onClose` on click exactly like every other mobile nav link so the
menu closes on navigation. Placement: as an additional `<li>` in the "Mobile primary" nav
list (`<ul className="flex flex-col gap-1">`), most naturally appended after the `nav.map`
output — do not interleave it into the `NAV` array/data structure itself. `Header.tsx` is
not touched: the desktop Contact CTA button (`Header.tsx:143-148`, `hidden
sm:inline-block`) stays exactly as-is, and the `<MobileMenu open={mobileOpen}
onClose={...} nav={NAV} />` call site is unchanged.

## Scope boundaries — this feature touches exactly

- EDIT `components/chrome/MobileMenu.tsx` — add one additional `/contact` link, styled and
  behaving like the existing plain nav links, distinct from the `nav` prop's mapped
  output.
- NOT touched: `components/chrome/Header.tsx` (desktop Contact CTA and Zone 2 primary nav
  unchanged — verified by A3 as a regression guard, not a change target),
  `components/chrome/nav-config.ts` (`NAV` array — shared by desktop Zone 2 nav, must not
  gain a new entry), `components/chrome/MegaMenu.tsx`, `components/chrome/SearchOverlay.tsx`.

## What this contract does NOT do

- Does not unhide or restyle the desktop Contact CTA button.
- Does not add `/contact` to the shared `NAV` array (would leak into the desktop Zone 2
  primary nav at >=1240px).
- Does not touch the footer's existing `/contact` path or the `mailto:` link.
- Does not restructure `MobileMenu.tsx`'s overlay/animation/backdrop behavior.

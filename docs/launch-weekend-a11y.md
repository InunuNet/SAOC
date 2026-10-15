# Launch-weekend accessibility basics (F1)

Mission `launch-weekend`, feature F1. Accessibility basics on the SAOC chrome and the SAOC and
National Show routes, with no new visual design: no new colours, fonts or tokens.

## Skip link

- `components/chrome/SkipLink.tsx` is a plain `<a href="#main-content">` (not `next/link`), so the
  browser does the hash focus handling.
- It is the first child in `app/(marketing)/layout.tsx`, so it is the first tab stop on every
  marketing route, National Show routes included.
- The target is the single `<main id="main-content" tabIndex={-1}>` in the same layout.
- It sits off-screen until focused, then shows as a 44px-high chip using existing `:root` tokens
  (`bg-primary`, `text-ivory`).

## Target size

- Inline-sized chrome links (header nav, mega-menu trigger, footer, utility-bar email, and a few
  text links) get `min-h-6`: a 24px floor, the WCAG 2.5.8 minimum, to avoid visual change.
- Province chips on `/societies` are at least 44x44 outright.
- Hero carousel dots keep the painted 2px bar; the button around it is 24px tall (negative margin
  keeps the layout unchanged), with non-intersecting 24px hit areas.

## Reduced motion

- `app/globals.css` has one global `@media (prefers-reduced-motion: reduce)` block collapsing
  animation and transition durations and setting `scroll-behavior: auto`. Nothing changes under
  no-preference.
- `components/home/Hero.tsx` stops its 5.5s autoplay under reduce (WCAG 2.2.2), following live
  changes through `useSyncExternalStore` on `matchMedia`.
- JS scrolling is not covered by CSS: `components/vendors/VendorRegisterForm.tsx` uses `'auto'`
  instead of `'smooth'` in `scrollIntoView` when reduced motion is requested. Any new
  `behavior: 'smooth'` call must do the same.

## Verification

Contract `.agent/memory/project/specs/launch-weekend/contract-f1.yaml`, assertions A1-A5 (skip
link, target size, reduced motion, visual identity, scope and tokens), checks in
`contracts/checks/launch-weekend/f1/`. Runtime checks need a prod build served with
`SITE_PUBLIC_LAUNCH=true` (otherwise the beta wall returns 401) and `BASE_URL` set.

## Known limitation

A5's smooth-scroll rule is a regex (`behavior: 'smooth'` files must mention
`prefers-reduced-motion`); it cannot prove the scroll is actually gated.

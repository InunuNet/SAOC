# MobileMenu focus trap — spec

## Focusable set inside the drawer (DOM order, drawer collapsed / no mega-menu expanded)

Reference: `components/chrome/MobileMenu.tsx` as of `contact-mobile-nav-fix` (F1 of this
feature must not reorder these — only wrap them in the trap):

1. Close button (`aria-label="Close menu"`, the `X` icon button) — **first focusable, and the
   element focus moves to on open.**
2. Each top-level `NAV` item that renders as a `<button aria-expanded=...>` (mega-menu
   toggles) or a plain `<Link>` (`nav.map(...)` output), in array order.
   - If a mega-menu toggle is expanded, its column headings/links (when present as `<Link>`s)
     and column item `<Link>`s become part of the focusable set, inserted at that toggle's
     position, until it is collapsed again.
3. The `/contact` `<Link>` added by `contact-mobile-nav-fix` (last item in the `<ul>`).
4. The `mailto:council@saoc.co.za` `<a>` in the footer-meta block.

That is the complete focusable set — nothing before #1, nothing after #4 — while the drawer
is open.

## Behavior contract

- **Open:** focus moves to element #1 (close button). Background page content becomes
  `inert` (fallback: `aria-hidden="true"` if `inert` is unsupported) — every sibling of the
  drawer's own subtree that is NOT part of `MobileMenu`'s rendered output (i.e. `<header>`,
  `<main>`, `<footer>`, and the `SearchOverlay` root if it renders a persistent node) must
  carry `inert` while `open === true`, and must NOT carry it once `open === false`.
- **Tab from the last focusable element (#4):** focus wraps to #1. It must never reach
  anything outside the drawer (a header nav link, the search button, the desktop Contact CTA,
  page `<main>` content, or the footer).
- **Shift+Tab from the first focusable element (#1):** focus wraps to the current last
  element (#4, or the last visible/expanded element if a mega-menu is open).
- **Escape (drawer open, any focus position inside it):** the drawer closes (`onClose()`
  fires) and focus returns to the hamburger trigger button in `Header.tsx`
  (`aria-label="Open menu"`).
- **Backdrop click / X click / nav-link click (existing close paths):** unaffected by this
  feature — they already call `onClose`. Regression-only: confirm they still work and that
  closing via any of these paths also leaves `inert`/`aria-hidden` removed from the
  background (not just the Escape path).
- **Mouse/tap interaction while open:** completely unaffected — clicking the close button,
  a nav link, or the mailto link must work exactly as before this feature.

## `useFocusTrap` hook shape (illustrative — @dev owns the literal signature)

```ts
// lib/hooks/useFocusTrap.ts
function useFocusTrap(options: {
  active: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  onEscape: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}): void;
```

Any signature that delivers the behavior contract above is acceptable — the assertions below
test behavior through a real browser, not the hook's internal API.

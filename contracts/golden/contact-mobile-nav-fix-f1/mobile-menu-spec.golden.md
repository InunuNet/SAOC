# contact-mobile-nav-fix — F1 mobile menu link spec

## Required markup shape (components/chrome/MobileMenu.tsx)

Within the `<nav aria-label="Mobile primary">` block, in addition to the existing
`nav.map(...)` output, there must be exactly one additional list item rendering a real
`next/link` `<Link>` to `/contact`:

```tsx
<li>
  <Link
    href="/contact"
    onClick={onClose}
    className="flex items-center px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
  >
    Contact
  </Link>
</li>
```

Requirements this markup must satisfy (exact class values may vary slightly as long as
each requirement below holds):

1. Uses `next/link`'s `Link` component (already imported in the file) with `href="/contact"`
   — not an `<a href="/contact">`, not a `mailto:` link, not a `href="#"` placeholder.
2. Calls `onClose` on click, matching every other plain nav link in the file, so the menu
   closes on navigation.
3. Is a real rendered, visible, tappable element when the menu is open — not
   `aria-hidden`, not `display:none`, not conditionally gated behind `expandedId` or any
   other state that would hide it by default.
4. Is NOT added to the `NAV` array in `components/chrome/nav-config.ts` and is NOT part of
   the `nav.map(...)` loop's output — it is additional markup local to `MobileMenu.tsx`.
5. `components/chrome/Header.tsx` is byte-for-byte unchanged by this feature (verified by
   A3 hashing / diffing against the pre-fix file, or an equivalent grep-based regression
   check on the Contact CTA button and `<MobileMenu ... nav={NAV} />` call site).

## Verification viewports

- **Primary (gating):** 375×667 — iPhone SE / common small mobile width, matches the
  confirmed live defect report.
- **Regression (gating):** 1440×900 — desktop, confirms the Zone 2 primary nav and Zone 3
  Contact CTA button are visually and structurally unchanged.

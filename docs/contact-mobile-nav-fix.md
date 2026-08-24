# F1: Contact — Mobile Navigation Fix

**Feature:** F1 of mission `contact-mobile-nav-fix` (milestone M1). Restores the `/contact` link to the mobile navigation menu by adding a standalone Contact nav item inside `components/chrome/MobileMenu.tsx`, preserving the desktop Contact CTA button and the shared nav structure. Verifies via real BrowserAgent/Playwright passes at 375×667 (iPhone SE), 320×568 (iPhone 5S), and 1440×900 (desktop regression check).

**Contract:** `.agent/memory/project/specs/contact-mobile-nav-fix/contract-f1.yaml` and `contracts/golden/contact-mobile-nav-fix-f1/` — full design record and check scripts.

**Status:** Gated (A1–A3 pass, all structural checks pass). QA-passed. Codex cross-model-passed.

---

## Why This Feature Exists

**The original defect:** On mobile devices at viewport widths below 640px, the Contact page was unreachable from the header navigation. The desktop Contact CTA button is styled with `hidden sm:inline-block`, hiding it below the `sm` (640px) breakpoint. The mobile menu renders only the shared `NAV` array (About, Societies, Judging & Awards, National Show, Events, Learn) and a footer `mailto:` link — `/contact` was never included in any data source the mobile menu reads. This left users on small devices with only the site footer as a path to `/contact`, a real navigation gap on the public marketing site.

**Why it happened:** The desktop Contact affordance was implemented as a separate button in the header's actions zone (Zone 3) rather than as an entry in the shared `NAV` array. Because the mobile menu pulls from that same `NAV` array to render its link list, appending `/contact` there would have leaked a new Contact entry into the desktop primary nav at ≥1240px, resulting in two Contact affordances on desktop — the original button plus a new nav link. This architectural split meant a single-source-of-truth fix (adding to `NAV`) was not viable without causing a desktop layout regression.

**Why a localized fix was needed:** The solution required adding `/contact` to the mobile menu only, as a separate `<Link>` item outside the `nav.map()` loop, so that the desktop layout stays unchanged while the mobile navigation gap is closed.

---

## The Fix

### Navigation Structure: `components/chrome/MobileMenu.tsx`

The mobile menu now includes a dedicated `/contact` link rendered as an additional navigation item within the mobile primary nav list:

```tsx
<nav aria-label="Mobile primary">
  <ul className="flex flex-col gap-1">
    {nav.map((item) => (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onClose}
          className="flex items-center px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
        >
          {item.label}
        </Link>
      </li>
    ))}
    {/* Contact link — standalone, outside nav.map(), for mobile only */}
    <li>
      <Link
        href="/contact"
        onClick={onClose}
        className="flex items-center px-3 py-3 font-sans text-[15px] text-ink hover:text-primary hover:bg-bone rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment"
      >
        Contact
      </Link>
    </li>
  </ul>
</nav>
```

**Key implementation details:**

- **Standalone link item:** The `/contact` link is rendered as an additional `<li>` appended after the `nav.map()` output, not interleaved into the `NAV` data structure itself.
- **Styling consistency:** Uses the same Tailwind classes as mapped nav items: `flex items-center px-3 py-3 font-sans text-[15px]`, matching the visual treatment and interaction states (hover, focus-visible) of sibling nav links.
- **Menu closure:** Calls `onClose` on click, exactly like every other mobile nav link, so the menu closes when the user navigates to `/contact`.
- **Accessibility:** Includes full focus-visible ring styling (`focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment`) and is rendered as a real, visible, tappable element with no `aria-hidden` or conditional hiding.

**Why this approach:** By keeping the `/contact` link local to `MobileMenu.tsx` and outside the `NAV` array, the desktop header layout remains completely unchanged — the Contact CTA button in `Header.tsx:143-148` stays exactly as-is, and the desktop primary nav at ≥1240px never gains a duplicate Contact entry.

---

## Verification

### A1–A3: Structural Contract Assertions

Standard shell checks verify the fix is in place and no regressions occurred:

- **A1:** `check-contact-link.sh` — verifies the `/contact` link exists in `MobileMenu.tsx`, uses `next/link`, calls `onClose` on click, and is not hidden or conditionally gated.
- **A2:** `check-navconfig-unchanged.sh` — verifies `components/chrome/nav-config.ts` is byte-for-byte unchanged (the `NAV` array was not modified, no duplicate entry leaked in).
- **A3:** `check-header-unchanged.sh` — verifies `components/chrome/Header.tsx` is unchanged, confirming the desktop Contact CTA button and all other header zones remain intact.

### A4–A6: Live Browser Verification

Real Playwright/BrowserAgent passes at three representative viewports:

1. **375×667 (iPhone SE, typical modern small mobile)**
   - Mobile menu opens (hamburger trigger visible and tappable)
   - Contact link is visible in the mobile nav list
   - Link text reads "Contact"
   - Link is fully in-viewport and tappable (non-zero width/height)
   - Clicking Contact navigates to `/contact` and closes the menu
   - Focus ring is visible when tabbing through links via keyboard

2. **320×568 (iPhone 5S, smallest typical mobile width)**
   - Same assertions as viewport 1
   - Confirms the link reachability and styling on the narrowest common mobile device
   - No text overflow, truncation, or layout shift

3. **1440×900 (desktop, regression check)**
   - Desktop header renders without horizontal scroll
   - Contact CTA button is visible in the header's actions zone (right of the primary nav)
   - Mobile hamburger trigger is hidden (`min-[1240px]:hidden`)
   - Exactly one Contact affordance is visible in the header (the original desktop CTA, not two)
   - Primary nav does not contain a Contact link (confirming `NAV` was not modified)

**Checks per viewport (via Playwright DOM assertions):**
- Mobile menu opens on hamburger tap
- Contact link is `element.isVisible()` true and has a non-zero bounding box
- Clicking the link navigates without errors
- Menu closes after navigation
- Focus-visible ring is renderable via keyboard navigation
- Desktop Contact CTA remains uniquely visible at ≥1240px

**Important:** These are Playwright DOM assertions and real user interactions (tap, keyboard tab), not visual pixel measurements or brittle screenshot comparisons. The test suite verifies the actual user journey: can mobile users reach Contact, and does desktop layout stay unchanged.

---

## Scope & Non-Changes

- **Header.tsx unchanged** — the desktop Contact CTA button (`components/chrome/Header.tsx:143-148`, `hidden sm:inline-block`) remains exactly as-is; the `<MobileMenu ... nav={NAV} />` call site is unchanged.
- **nav-config.ts unchanged** — the `NAV` array is not modified; no entry is added or reordered.
- **No visual redesign** — uses existing Tailwind utilities and brand color tokens; no new design tokens introduced.
- **No auth or permission changes** — the `/contact` route is public and already exists; this is purely a navigation link fix.
- **No footer changes** — the footer's existing `/contact` link and `mailto:council@saoc.co.za` affordance are untouched.
- **No mobile menu animation/overlay changes** — menu open/close behavior, backdrop, and overlay structure remain unchanged.

---

## Deployment Notes

**This is a client-side mobile navigation fix.** No server-side changes, no API modifications, no Firestore migrations. The only deployment is a code push to Firebase App Hosting. Once pushed and live on `beta.saoc.co.za`, mobile users can immediately access the Contact page from the header hamburger menu.

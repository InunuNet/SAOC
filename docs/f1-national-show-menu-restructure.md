# F1–F2: National Show Menu Restructure and Exhibitor Messaging

**Features:** F1–F2 of mission `national-show-menu-restructure` (milestone M1). Restructures the National Show mega-menu to surface four previously unlinked show-info pages ("What to Expect", "Plan Your Visit", "FAQ", "Archive") in a new "About the Show" column alongside the existing "Tickets" column. Adds honest "not yet open" messaging to exhibitor entry points, clarifying that exhibitor ticket sales do not yet exist (backlog item, pricing-blocked).

**Mission brief:** `.agent/memory/project/missions/2026-08-21-national-show-menu-restructure.md` — the full record; read it first for context. **This doc is the guide; that is the specification.**

**Status:** Gated, QA-passed (real browser verification at 375px and 320px), Codex GPT-5.5 cross-model-passed.

---

## Why This Feature Exists

Brad's live-site testing (2026-08-21) discovered two usability gaps on the National Show section:

1. **Show-info pages are undiscoverable.** The site has real, published pages for "What to Expect", "Plan Your Visit", "FAQ", and "Archive" — all returning 200 OK — but none of them appear in any menu. Visitors have no way to find them except by guessing URLs.
2. **Exhibitor entry reads broken.** The `/national-show/exhibitors` page and the "Exhibitor Entry" chooser card on `/national-show/tickets` both lack any messaging that exhibitor tickets do not yet exist; visitors assume this is a purchase flow and hit a dead end.

Both gaps are UX/discoverability defects, not bugs — the links are correct, and the content exists. This feature surfaces what was already built.

---

## F1: Two-Column National Show Mega-Menu

### The Decision: Flat Two-Column Layout Over Nested Submenu

The chosen solution adds a second "About the Show" column to the existing National Show mega-menu item, keeping both columns flat in a side-by-side layout on desktop and stacked on mobile.

**Why not true nesting (collapsible submenu)?** `MegaMenu.tsx` has zero concept of a second-level flyout — building one means new hover-intent timing, a second `aria-expanded` layer, keyboard arrow-key traversal between levels, and a distinct mobile interaction (two levels of disclosure vs. current single level). This project carries acknowledged a11y debt; a second flat column achieves "see everything at once" with no new interaction model. A nine-item mega-menu (4 About + 5 Tickets) is still a normal, readable panel at 1280px+ — no crowding.

### What Changed

**`components/chrome/nav-config.ts`**
- Extended the `show` NavItem's `columns` array from 1 to 2 NavColumn entries.
- Added "About the Show" column (heading links to `/national-show`):
  - What to Expect → `/national-show/what-to-expect`
  - Plan Your Visit → `/national-show/plan-your-visit`
  - FAQ → `/national-show/faq`
  - Archive → `/national-show/archive`
- "Tickets" column remains unchanged (5 links: Visitor, Exhibitor Entry, Vendor Registration, Conferences, Workshops & Field Trips).

**`components/chrome/MegaMenu.tsx`**
- Changed the columns wrapper from single-direction flex (`flex flex-col gap-6`) to desktop-responsive flex row (`flex flex-col gap-6 sm:flex-row sm:gap-10`).
- Widened the panel from `sm:min-w-[280px]` to `sm:min-w-[520px]` to accommodate two columns side-by-side.

**`components/chrome/MobileMenu.tsx` and `components/chrome/Header.tsx`**
- Zero structural change required. Both already iterate `item.columns.map(...)` generically; adding a second column entry renders for free.

---

## F2: Exhibitor Entry Messaging Fix

### Root Cause

The site offers no exhibitor ticket product yet (confirmed in backlog: "Exhibitor/Vendor ticketing… NOT built"). The `/national-show/exhibitors` page and the "Exhibitor Entry" chooser card on `/national-show/tickets` both imply that entry is a live purchase flow ("Register your entries…"), when in reality the page is reference-only (entry process, fees "TBC" via the existing `ExhibitorStatusBadge` pattern). It reads as a dead end, not a wrong link.

### The Fix: Honest Static Messaging

**`app/(marketing)/national-show/exhibitors/page.tsx`**
- Added a static banner/notice below the page hero and above `ExhibitorKeyDates`, matching the site's existing "to be confirmed" voice:
  - Text: "Exhibitor ticket sales are not yet open. This page covers what to expect when entries open — check back, or contact the council to be notified."
  - No new Sanity field — static JSX. It toggles off entirely once exhibitor ticketing ships (a code-level conditional), avoiding a stray CMS field nobody remembers to flip.

**`app/(marketing)/national-show/tickets/page.tsx`**
- Reworded the "Exhibitor Entry" `OPTIONS` card's `body` copy from the purchase-implied "Register your entries for judging and exhibition at the National Show" to the honest "See what's involved in exhibiting — entry opens closer to the show."
- Kept `cta: 'Exhibitor entry'` and href unchanged (still correctly routes to `/national-show/exhibitors`).

### Out of Scope (Backlog)

Building an actual exhibitor ticket product, pricing it, or wiring a purchase flow. That is a separate, larger, pricing-blocked backlog item. This feature is a messaging fix only.

---

## Implementation Notes

- **Data-driven menu:** `MegaMenu.tsx` and `MobileMenu.tsx` already iterate columns generically; no component logic changed, only data.
- **Responsive layout:** Flex row on desktop (`sm:flex-row`), stacked on mobile (default flex-col).
- **Visual verification:** Tested at 375px and 320px widths; both columns render and stack correctly on mobile.
- **Consistent voice:** Exhibitor messaging matches the site's existing provisional-status patterns (e.g., `ExhibitorStatusBadge`, `ConfirmationBadge`).

---

## Contract & Golden Files

See `.agent/memory/project/specs/national-show-menu-restructure/`:
- `contract-m1.yaml` — gate assertions (grep for new hrefs, confirm MobileMenu/Header unchanged)
- `goldens/f1-nav-about-column.golden.md` — expected menu structure
- `goldens/f2-exhibitor-messaging.golden.md` — expected copy on both pages

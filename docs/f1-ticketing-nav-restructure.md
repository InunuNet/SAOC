# F1–F2: Ticketing Navigation Restructure

**Features:** F1–F2 of mission `ticketing-nav-restructure` (milestone M1). Restructures site navigation so "National Show" becomes the one top-level item, with a mega-menu whose Tickets column heading routes to a plain-language chooser page while the same column also carries direct sub-links to Visitor, Exhibitor, and Vendor entry points. Audit for "Events" naming collision with the existing societies-calendar nav item (F2).

**Contract:** `contracts/golden/ticketing-nav-restructure/contract-f1.yaml` — the full design record; do not duplicate it, read it first. **This doc is the guide; that is the specification.**

**Status:** Gated (A1–A9 all pass), QA-passed (keyboard focus-escape bug fixed), Codex cross-model-passed (mobile nav regression fixed on re-review).

---

## Why This Feature Exists

Before this pass, ticket sales and admission-related links were scattered across the top-level nav (standalone "Tickets" link, "Exhibitors", "Vendors" as separate items or buried). The National Show is a specific, time-bound event (September 2027), not site-wide. Grouping all ticket sales under "National Show" makes two things clear to a visitor:

1. **Ticket sales are for the show only.** They don't exist year-round; they're specific to the 2027 edition.
2. **The nav can scale** — when Mission Two adds Conferences and Workshops & Field Trips categories, the "National Show" mega-menu can grow without a redesign; the structure is prepared for it.

For an undecided visitor, the new chooser page (`/national-show/tickets`) answers "What are you here for?" with three plain-language options, routing them to the right category. For someone who already knows what they want, direct sub-links in the mega-menu skip the question entirely.

---

## The New Structure: Data-Driven Nav

### `components/chrome/nav-config.ts` — Single Source of Truth

A new, typed nav config replaces the flat array that was hardcoded in `Header.tsx`:

```ts
export interface NavLeaf {
  id: string;
  label: string;
  href: string;
  disabled?: boolean;
}

export interface NavColumn {
  id: string;
  heading: string;
  headingHref?: string;  // heading itself is a link when present
  links: NavLeaf[];
}

export type NavItem =
  | { type: 'link'; id: string; label: string; href: string; disabled?: boolean }
  | { type: 'mega'; id: string; label: string; href: string; columns: NavColumn[] };

export const NAV: readonly NavItem[] = [
  { type: 'link', id: 'about', label: 'About', href: '/about' },
  { type: 'link', id: 'societies', label: 'Societies', href: '/societies' },
  { type: 'link', id: 'judging', label: 'Judging & Awards', href: '/judging' },
  {
    type: 'mega',
    id: 'show',
    label: 'National Show',
    href: '/national-show',
    columns: [
      {
        id: 'tickets',
        heading: 'Tickets',
        headingHref: '/national-show/tickets',
        links: [
          { id: 'visitor', label: 'Visitor Tickets', href: '/tickets' },
          { id: 'exhibitor', label: 'Exhibitor Entry', href: '/national-show/exhibitors' },
          { id: 'vendor', label: 'Vendor Registration', href: '/national-show/vendors/register' },
        ],
      },
    ],
  },
  { type: 'link', id: 'events', label: 'Events', href: '/events' },
  { type: 'link', id: 'learn', label: 'Learn', href: '#', disabled: true },
];
```

**Why this is load-bearing:** No component file hardcodes nav links or ticket destination hrefs anymore. When Mission Two adds Conferences or Workshops & Field Trips entries, they are appended to the `Tickets` column's `links` array here — not scattered across `Header.tsx`, `MegaMenu.tsx`, or `MobileMenu.tsx`. The shape is future-proofed for new data without code changes.

### Desktop Mega-Menu: `components/chrome/MegaMenu.tsx`

A new component handles the desktop dropdown, consuming a `mega`-type `NavItem`:

- Renders as a `<button>` with `aria-expanded` and `aria-haspopup="true"` (following the existing `AdminNav.tsx` disclosure pattern).
- Opens on click AND on keyboard `Enter`/`Space` while focused (no mouse required).
- Closes on `Escape`, returning focus to the trigger (critical for keyboard navigation).
- The Tickets column heading is itself a `<Link>` to `/national-show/tickets` (the chooser page).
- Each sub-link in the column is a real `<a href>` element, Tab-reachable when the menu is open.
- Clicking a sub-link closes the menu (good UX — prevents accidental re-opening on the next click).

### Header & Mobile: Updated to Consume Data

**`components/chrome/Header.tsx`** (modified) — now imports `NAV` from `nav-config.ts` and renders either a simple `<Link>` for `type: 'link'` items or delegates to `<MegaMenu>` for `type: 'mega'` items. The old hardcoded top-level "Tickets" link is removed entirely.

**`components/chrome/MobileMenu.tsx`** (modified) — updated to understand the new `NavItem` shape:
- `type: 'link'` items render exactly as before.
- The `type: 'mega'` "National Show" item renders as an expandable disclosure section (same `aria-expanded` pattern as desktop), which when expanded reveals the Tickets column heading link (`/national-show/tickets`) and all three direct sub-links as real `<a href>` elements in the DOM — not desktop-only, not hidden by viewport constraints. This fixed a regression found during Codex review (see "Bugs Found & Fixed" below).

---

## The Chooser Page: `/national-show/tickets`

New Server Component at `app/(marketing)/national-show/tickets/page.tsx`. Content:

- A `PageHero` (reusing existing site pattern) with eyebrow "National Show", heading "What are you here for?", and lede explaining the choice.
- Three cards, one for each Exhibition category:
  1. "I'm coming to visit" → `/tickets` (Visitor Tickets purchase page)
  2. "I'm exhibiting orchids" → `/national-show/exhibitors` (Exhibitor entry)
  3. "I'm a nursery or trader" → `/national-show/vendors/register` (Vendor registration)

Static copy, no Sanity dependency required for this pass. The page is additive; the existing `/tickets` page (Visitor ticket purchase) is completely unchanged.

---

## F2: "Events" Naming Collision Resolved

The site already had a top-level "Events" nav item (the societies calendar at `/events`). Lee-Ann's ticketing spec also calls one of its three categories "Events" (workshops, field trips, cocktails at the National Show) — a different thing entirely. Before this pass, both could appear in top-level nav.

**F1 resolves this by construction:** All ticketing is now nested under "National Show," so there is no second top-level "Events" nav item anymore.

**F2 audits no regression:** The contract includes a check (`verify_no_bare_events_label.py`) that scans the files F1 touches (nav-config.ts, Header.tsx, MegaMenu.tsx, MobileMenu.tsx, and the chooser page) for the bare word "Events" used to label a ticket category. The legitimate `/events` link is left unchanged — still labelled "Events," still pointing at `/events`.

---

## Bugs Found & Fixed

Two real defects were found during QA and Codex review and fixed before gate closure:

### Bug 1: Keyboard Focus on Tab-Past-Last-Link (QA Found)

In the desktop mega-menu, if a user opened the menu with keyboard and Tab'd past the last link in the Tickets column, focus would not return to the menu trigger — it would escape to the page body, losing navigation context.

**Fix:** `MegaMenu.tsx` now includes focus-trap logic via `onBlur` event on the container. When focus leaves the menu entirely (not just moving between menu items), the menu closes and focus is explicitly returned to the trigger button.

### Bug 2: Mobile `/national-show` Link Missing (Codex Found on Re-Review)

During initial implementation, the mobile menu's National Show disclosure section revealed the three ticket sub-links (Visitor/Exhibitor/Vendor) but did NOT include a link to `/national-show` itself — you could only go to the sub-pages, not to the main National Show hub.

**Fix:** `MobileMenu.tsx` now renders the National Show section heading with its own `href: '/national-show'` link, matching the desktop mega-menu's behavior. A Codex re-review confirmed the fix.

---

## Structural Extensibility: Why Data Arrays Matter

The Tickets column's links are stored as a plain data array in `nav-config.ts`:

```ts
links: [
  { id: 'visitor', label: 'Visitor Tickets', href: '/tickets' },
  { id: 'exhibitor', label: 'Exhibitor Entry', href: '/national-show/exhibitors' },
  { id: 'vendor', label: 'Vendor Registration', href: '/national-show/vendors/register' },
],
```

When Mission Two builds the Conferences category and Workshops & Field Trips, the changes needed are:

1. Add two more objects to this `links` array in `nav-config.ts`.
2. No changes to `Header.tsx`, `MegaMenu.tsx`, or `MobileMenu.tsx` — they iterate over the data, not hardcode links.

This pattern scales cleanly and keeps concerns separate: nav structure lives in config data; rendering logic lives in components.

---

## Files Changed

- `components/chrome/nav-config.ts` (new) — typed NAV data array driving the header
- `components/chrome/MegaMenu.tsx` (new) — desktop mega-menu component with keyboard/focus handling
- `components/chrome/Header.tsx` (modified) — consumes nav-config, renders MegaMenu for mega-type items
- `components/chrome/MobileMenu.tsx` (modified) — National Show as expandable disclosure with direct `/national-show/tickets` link and three ticket sub-links
- `app/(marketing)/national-show/tickets/page.tsx` (new) — "What are you here for?" chooser page routing to the three Exhibition category destinations
- `execution/checks/verify_nav_mega_menu.ts` (new) — behavioral test: real dev server, desktop/mobile viewports, keyboard open/close/escape, verified hrefs
- `execution/checks/verify_no_bare_events_label.py` (new) — scan for "Events" naming collision in files F1 touches

---

## Sources

- `contracts/golden/ticketing-nav-restructure/contract-f1.yaml` — design record, approved artifact (mission brief), scope boundaries, QA bugs found & fixed
- `.agent/memory/project/missions/2026-08-21-ticketing-nav-restructure.md` — mission context, Mission Two deferral, why F1 comes before F2's categories
- `.agent/memory/project/specs/ticketing-nav-restructure/goldens/f1-mega-menu-nav.golden.md` — binding UX spec, structure & extensibility details
- `.agent/memory/project/specs/ticketing-nav-restructure/goldens/f2-events-naming.golden.md` — naming audit scope, what F1 resolves by construction

All three are load-bearing.

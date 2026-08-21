# F1 golden — National Show mega-menu with Tickets chooser + direct deep links

Binding UX source: mission `ticketing-nav-restructure` F1 inline_brief, quoting the
approved artifact (`https://claude.ai/code/artifact/294a3298-1040-4ff7-b1ff-8b7a0ed4facb`)
verbatim. The artifact itself is a private Claude.ai page and returned "Page not found"
to an unauthenticated fetch during scoping — this golden is built from the mission's
verbatim quote of its "Chosen direction," not from re-reading the page. If @dev or @qa can
open it directly (signed in as Brad), treat any conflict between this golden and the live
mockup as a signal to flag to the orchestrator, not to silently follow one or the other.

## Scope boundary (do not exceed)

- Only the Orchid Exhibition category (Visitor / Exhibitor / Vendor) is real today. Do NOT
  build routes/pages for Conferences or Workshops & Field Trips/Cocktails.
- Decision (architect's call per mission brief, "whichever is smaller true scope"):
  **OMIT Conferences and Workshops & Field Trips entirely from the rendered Tickets column
  in this pass.** No "Coming soon" placeholder link is required. "Reserve room" is
  satisfied structurally, not visually: the Tickets column's links must be driven by a
  plain data array (see `nav-config.ts` below), not individually hardcoded JSX elements,
  so Mission Two can append two more `NavLeaf` entries to that array without touching
  `Header.tsx`, `MegaMenu.tsx`, or `MobileMenu.tsx`. A2 in the contract checks this
  data-driven shape.
- Do not rename or move any existing route. `/tickets` keeps its current URL and stays the
  Visitor ticket purchase page exactly as it is today
  (`app/(marketing)/tickets/page.tsx` — untouched). The new chooser page is an ADDITIVE
  route at `/national-show/tickets`, distinct from `/tickets`.
- No new brand colours, fonts, or visual system. Reuse existing Tailwind v4 tokens already
  in use in `Header.tsx`/`MobileMenu.tsx`/`AdminNav.tsx` (`text-ink`, `text-primary`,
  `bg-parchment`, `border-rule`, `bg-bone`, etc.) and the existing `Menu`/`X`/lucide-react
  icon set. `AdminNav.tsx` (`components/admin/AdminNav.tsx`) already has a working
  `aria-expanded` disclosure pattern in this codebase — follow its shape rather than
  inventing a new one.

## Required structure

### 1. Nav config becomes data, not a flat array

Current `components/chrome/Header.tsx` hardcodes a flat `NAV` array of
`{ id, label, href, disabled? }`, including a **top-level** `{ id: 'tickets', label:
'Tickets', href: '/tickets' }` entry. That top-level entry is removed — ticket links
move entirely inside the new National Show mega-menu.

Introduce a typed nav config (new file, e.g. `components/chrome/nav-config.ts`) something
like:

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
  headingHref?: string; // heading itself is a link when present
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
      // Additional columns (e.g. "About the Show") are at @dev's discretion within
      // existing site tokens — not gated by this contract, since the binding spec only
      // pins down the Tickets column's shape.
    ],
  },
  { type: 'link', id: 'events', label: 'Events', href: '/events' },
  { type: 'link', id: 'learn', label: 'Learn', href: '#', disabled: true },
];
```

Exact type/variable names are not gated — the assertions grep for the underlying facts
(a `mega` item, a `Tickets` column, `headingHref` distinct from `/tickets`, the three
leaf hrefs), not this literal source text.

### 2. Desktop mega-menu

- The "National Show" top-level item becomes a real, focusable trigger (`<button>`, not a
  `<div>` with only `onMouseEnter`) exposing `aria-expanded` and `aria-haspopup="true"`,
  matching `AdminNav.tsx`'s existing disclosure pattern.
- Opens on click AND on keyboard `Enter`/`Space` when focused (Tab-reachable from the
  preceding nav item without a mouse). Closes on `Escape`, returning focus to the trigger.
- The Tickets column heading ("Tickets") is itself a link to `/national-show/tickets` (the
  chooser). Immediately below/alongside it, three direct links: Visitor Tickets → `/tickets`,
  Exhibitor Entry → `/national-show/exhibitors`, Vendor Registration →
  `/national-show/vendors/register`. All three destination links must be real, Tab-reachable
  `<a href>` elements when the menu is open — not `href="#"` with a JS-only handler.
- Plain click/tap on `/national-show` itself (the trigger's own href, if the trigger is
  also a link, or a separate "Visit /national-show" affordance in the menu) must still work
  — the mega-menu is an enhancement layered on the existing `/national-show` destination,
  not a replacement for it.

### 3. Chooser page — `/national-show/tickets`

New Server Component route, `app/(marketing)/national-show/tickets/page.tsx`. Content:
a plain-language question ("What are you here for?" or equivalent copy — exact wording is
@dev's to write within the approved direction, not gated) with three options routing to
the same three destinations as the mega-menu's direct links: `/tickets`,
`/national-show/exhibitors`, `/national-show/vendors/register`. Uses the existing
`PageHero` pattern (see `app/(marketing)/national-show/vendors/page.tsx` for the shape:
`PageHero` + `max-w-[1280px]` content container). No Sanity dependency required — static
copy is acceptable for this pass.

### 4. Mobile — real, independent implementation, not desktop-only

`components/chrome/MobileMenu.tsx` currently renders one flat `<ul>` of the old flat
`nav` prop. It must be updated to understand the new `NavItem` shape:

- `type: 'link'` items render exactly as today.
- The `type: 'mega'` National Show item renders as an expandable/disclosure section
  (button with `aria-expanded`, same pattern as desktop) that, when expanded, reveals the
  Tickets column's heading link (`/national-show/tickets`) and all three direct sub-links
  as real `<a href>` elements in the DOM — reachable by scrolling/tapping, no viewport
  constraint hides them (this is the specific failure mode the existing
  `/contact`-unreachable-on-mobile backlog defect describes for a different link; this
  contract's mobile mega-menu must not repeat that pattern for ticket links).
- This is genuinely new UI, not a resized copy of the desktop dropdown — a full-screen
  slide-in panel with an accordion section is the expected shape, consistent with the
  panel's existing full-screen slide-in behavior.

## Explicitly out of scope for this contract (do not fix here)

- The pre-existing `/contact` unreachable-on-mobile defect (backlog.md, "Accessibility &
  UI defects") is a SEPARATE known issue on the existing flat nav items, not introduced by
  this work. Leave it as filed; do not silently fold its fix into this pass.
- Conferences / Workshops & Field Trips routes and any "coming soon" UI for them.
- Any new Sanity schema, CMS-driven nav content, or admin nav-editing UI.

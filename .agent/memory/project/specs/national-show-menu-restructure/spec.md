# Spec: National Show mega-menu restructure

## Trigger
Brad, live-testing beta.saoc.co.za: wants the National Show mega-menu to surface show-info
pages ("what to expect", etc.), keep Tickets grouped, and fix "Exhibitor Entry points to the
wrong page." @qa-apex confirmed the Tickets column itself is fine post-deploy; the real gaps
are (1) four real, live, unlinked show-info pages, and (2) the exhibitor path has nowhere to
actually buy anything, so it *reads* broken even though the link is technically correct.

## Decision: two-column flat mega-menu, not true nested submenu

**Recommendation: two-column flat mega-menu.** Extend `NavColumn[]` on the existing `show`
NavItem from one column to two — no new interaction model, no flyout-within-flyout, no new
component.

- Column 1, **"About the Show"** (new), heading links to `/national-show`:
  1. What to Expect — `/national-show/what-to-expect`
  2. Plan Your Visit — `/national-show/plan-your-visit`
  3. FAQ — `/national-show/faq`
  4. Past Shows / Archive — `/national-show/archive`
- Column 2, **"Tickets"** (existing, unchanged), heading links to `/national-show/tickets`:
  Visitor Tickets, Exhibitor Entry, Vendor Registration, Conferences, Workshops & Field Trips.

`/national-show` itself is not repeated as a link inside "About the Show" — it's already the
column heading's `headingHref`, and the panel's existing "Visit National Show →" footer link
covers it a second time. Listing it a third time as a bullet is redundant.

**Why not true nesting (Tickets → hover/tap-to-expand submenu):** Brad's stated goal is
discoverability ("I don't see a place to link to any of the others"), not information density.
`MegaMenu.tsx` today has zero concept of a second-level flyout — building one means new
hover-intent timing, a second `aria-expanded`/`aria-haspopup` layer, keyboard arrow-key
traversal between levels, and a distinct mobile interaction (the current `MobileMenu.tsx`
accordion already does one level of disclosure; nesting doubles it to a two-level accordion).
That's real a11y surface on a project that already carries acknowledged a11y debt, for a
5-item list that fits on screen unexpanded. A second flat column achieves "see everything at a
glance, grouped sensibly" with the exact same disclosure primitive already shipped and audited.
Two columns of 4–5 links each is a completely ordinary mega-menu pattern at 1280px+; it will
not visually crowd the existing `min-w-[280px]` panel (widen to `min-w-[520px]` or let it size
to two columns via `sm:grid-cols-2`-style layout — implementation detail for @dev).

**Data model:** no change to the `NavColumn`/`NavLeaf` interfaces in `nav-config.ts` — this is
purely adding a second entry to the `columns` array of the existing `show` item. `MegaMenu.tsx`
already iterates `item.columns.map(...)`, so a second column renders for free; the only styling
work is arranging two columns side-by-side (currently `flex flex-col gap-6` stacks all columns
vertically — needs `sm:flex-row` or a grid wrapper at the columns level, kept within the panel's
existing visual language, no new tokens/colors).

## MobileMenu.tsx — no structural change needed

`MobileMenu.tsx` already renders `n.columns.map(...)` inside the expanded accordion panel
(lines 90–119 today), each column rendered stacked with its own heading + link list — this is
already the "flat, multiple groups under one expand" shape. Adding a second column entry just
adds a second heading block underneath the first inside the same accordion, no code change.
At 375px/320px this means the expanded National Show accordion item grows to ~9 links total
(4 About + 5 Tickets) instead of 5 — still one thumb-scroll, still one level of disclosure,
still reachable one-handed. No new component, no new state.

## Exhibitor messaging fix (small, static-code scope)

Root cause confirmed: `/national-show/exhibitors` and `/national-show/tickets`'s "Exhibitor
entry" card both point to the same real content page, which is pure show-committee reference
info — key dates, entry process, fees "TBC" via the already-shipped `ConfirmationBadge` /
`ExhibitorStatusBadge` pattern (`components/show/ConfirmationBadge.tsx`,
`components/show/ExhibitorStatusBadge.tsx`) — but has **no purchase call-to-action at all**,
because no exhibitor ticket product exists yet (confirmed in backlog.md: "Exhibitor/Vendor
ticketing... NOT built"). It reads as a dead end, not a wrong link.

**Fix, in scope:**
1. `app/(marketing)/national-show/exhibitors/page.tsx` — add one static banner/notice near the
   top of the page (below `PageHero`, above `ExhibitorKeyDates`), plain text, matching the
   page's existing pending-status voice ("To be confirmed" / "Not yet confirmed" — see
   `ConfirmationBadge.tsx` fallback constants): something to the effect of *"Exhibitor ticket
   sales are not yet open. This page covers what to expect when entries open — check back, or
   contact the council to be notified."* This is static JSX, not a new Sanity field — it is not
   describing a fact that changes per-show-edition (entry process/fees are Sanity-driven and
   already marked pending independently); it is a fixed "purchasing isn't live yet" notice that
   toggles off entirely once F-exhibitor-ticketing ships. Do not add a new Sanity boolean for
   this — a code-level `revalidate`-safe conditional is enough, and avoids a stray CMS field
   nobody remembers to flip when exhibitor ticketing finally ships.
2. `app/(marketing)/national-show/tickets/page.tsx` — the "Exhibitor entry" `OPTIONS` card
   (`id: 'exhibitor'`): reword `body` from "Register your entries for judging and exhibition at
   the National Show" (implies action-now) to something like "See what's involved in exhibiting
   — entry opens closer to the show." Keep `cta: 'Exhibitor entry'` and the href unchanged
   (still correctly routes to the info page) since it is not a wrong destination, just needs the
   surrounding copy to stop implying "buy now."

**Out of scope, confirmed against backlog.md:** building an actual exhibitor ticket product,
pricing it, or wiring a purchase flow. That is a separate, larger, pricing-blocked backlog item
(exhibitor/vendor ticketing category has no priced products). Do not scope it here.

## Milestone breakdown

Both changes are small and independent; recommend **one milestone, two features** (not two
milestones — neither is large enough to warrant separate gate cycles, and they touch disjoint
files with no shared risk):

- **F1 — Nav restructure**: `components/chrome/nav-config.ts` (add "About the Show" column +
  4 links to the `show` item's `columns` array), `components/chrome/MegaMenu.tsx` (two-column
  layout within the existing panel), no change needed to `MobileMenu.tsx` or `Header.tsx`
  beyond what the data-driven render already handles — but include a visual/manual check that
  the accordion still renders both columns correctly at 375px.
- **F2 — Exhibitor/tickets-chooser messaging**: `app/(marketing)/national-show/exhibitors/page.tsx`
  (static banner) + `app/(marketing)/national-show/tickets/page.tsx` (reworded card body).

Gate-able assertions (for @architect's contract when this spec is approved): grep for the 4 new
`href`s in `nav-config.ts`; grep for the new banner text and reworded card body string; confirm
`MobileMenu.tsx`/`Header.tsx` are untouched (diff should show zero lines changed in those two
files, proving the "no structural change needed" claim held).

## Deferred to backlog (no action this mission)
- Actual exhibitor ticket purchasing/pricing (blocked on committee pricing decision).
- The National Show brand-model restructuring question (`branding/national-show-2027/`) —
  unrelated, already tracked separately in backlog.md.

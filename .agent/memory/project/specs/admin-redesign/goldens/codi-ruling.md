# Admin redesign — Codi (NOS Design) ruling, verbatim relay, 2026-10-22

Brad's request (verbatim): "The admin section of the website, the design is not great. It's inconsistent. The content doesn't always fit on the page, forcing you to horizontally scroll. It's just not user friendly at all. We need to put some proper design effort into this and standardize all the admin pages. Let's use a traditional burger menu or something to just, I don't know, do some research and improve this." Reference he likes: the WOSA admin (sidebar, dashboard stat cards, quick links) and its floating admin pill.

---

From Codi, RULING admin-redesign (P1, Brad). SAOC tokens only. Measured on beta at 1280: the ticket table is 1678px inside a 1199px container, and vendors is 1841px in 1199. WOSA's model (sidebar, dashboard cards, task-first quick links) is the right one. It's adapted below, with two of its faults fixed: the drag-only pill, and the pill covering the sidebar's sign-out.

(a) SHELL. A new app/admin layout; admin routes drop the public utility bar, header and footer.
- ≥1024: fixed left sidebar, 248px wide, parchment #F4F3EC with a 1px --rule right border; the content area is bone #E8E6DC.
- Sidebar top: SAOC emblem (mark only, 28px, the supplied file), "Admin" in mono 11px muted, "South African Orchid Council" in Crimson Pro 600 at 18px.
- Groups get mono 11px uppercase muted labels:
  - SHOW: Dashboard, Tickets, Door scanner
  - VENDORS: Applications [count of pending], Vendors
  - COMMUNICATIONS: Newsletter
  - SYSTEM: Settings
  These are existing routes only. Labels are the current names in sentence case.
- Rows: 40px tall (44px on touch), 18px lucide icon, 14px Manrope 500 ink.
- Active row: bone background, a 3px brass left bar, primary text, aria-current="page". Hover: bone at 60%.
- Pending badge: primary fill, ivory mono 11px, radius 999.
- Bottom block, pinned: signed-in email (13px muted, truncated, full text in title), "View site ↗", "Sign out".
- <1024: a 56px parchment top bar with a 44×44 burger at the left, then "Admin · <page name>".
  - The burger opens the same sidebar as a left drawer, 280px or 85vw, over a rgba(34,40,31,.55) scrim (the handoff's mobile-menu scrim).
  - The drawer traps focus, closes on Esc and on navigation, and locks body scroll.
  - No wrapping tab row.
(impeccable audit.md navigation + keyboard; H4, H6 recognition, H7)

(b) PAGE TEMPLATE.
- Content padding 32px (16px <640), max-width 1280.
- Header row: H1 in Crimson Pro 600 32px; a one-line subtitle at 14px muted; actions right-aligned. The primary action is a sage button, secondary is a brass outline, both at --radius-1 2px, 44px tall. Below 768 the actions wrap under the title.
- Drop the "ADMIN" chip; the shell already says admin.
- Sections are parchment cards with a 1px --rule border, radius 2px, 24px padding.
- Every page has an empty, a loading-skeleton and an error state. (craft-floor hierarchy; H1, H9)

(c) DASHBOARD, from existing data only.
- H1 "Dashboard", plus the subtitle "Updated hh:mm". A "Refresh" button only if the data is client-cached.
- Stat cards: 4 across at ≥1280, 2 at 640–1279, 1 below 640. Tickets sold · Orders · Applications pending review · Vendors approved · Newsletter subscribers.
- Each card: a 40px bone tile with a sage icon (brass tile when "pending" > 0), the number in Crimson Pro 32px tabular figures, a 13px muted label, and a "→". The whole card is a link to its list.
- No rainbow tiles; SAOC is one palette.
- Two panels below:
  - "Quick actions": Download tickets CSV, Open door scanner, Review applications, Payment settings.
  - "Needs attention": the 5 oldest pending applications (business, submitted date, View).
(critique.md hierarchy; H6)

(d) TABLE STANDARD.
- No horizontal scroll at any width. Document scrollWidth = viewport, which also meets WCAG 1.4.10 reflow.
- ≥1024: at most 6 columns, table-layout fixed with set widths. Long text truncates with an ellipsis, with full text in title and in the detail view.
- Text is left-aligned; this fixes the centred Booking ref. Numbers and dates are right-aligned with tabular-nums.
- Header: mono 11px uppercase .12em muted on bone, sticky.
- Rows 48px, 1px --rule-soft separators, bone at 50% on hover. Status uses StatusPill.
- Actions sit last, right-aligned. One "View", or a "⋯" row menu once there are more than 2 actions; targets are 44px.
- Above each table, a toolbar: search, a status filter (segmented), a count ("24 applications") and CSV where it exists.
- 640–1023: every column has a priority 1–3, and priority 3 hides. Below 640: stacked cards.
  - Title: the primary field in bold. Status pill top-right.
  - Then 2–3 label/value pairs.
  - The whole card opens the detail.
- DETAIL VIEW for wide records: row "View" opens a right drawer, 520px wide on ≥1024, which keeps the list visible. Below 1024 it's a full page with a back link.
  - Content is grouped definition lists: Business · Contact · Stand · Permits · Payment · Photos.
  - A sticky footer holds the record's actions (Approve / Reject / Payment link / Photo link).
- Columns:
  - Tickets: Booking ref (mono 13) · Name · Email · Ticket type (pill) · Purchased · Status.
  - Applications: Business (name, with the contact in 13px muted underneath; one merged column) · Category · Stand · Submitted · Status · View.
  - Permits leave the table and move into the detail view.
(audit.md tables + reflow; H8; craft-floor alignment)

(e) FLOATING ADMIN PILL: adopt it, but fixed and not draggable. WOSA's pill drags by mouse only, which fails WCAG 2.5.7, and it covers its own sign-out.
- Public pages, signed-in admins only. Fixed bottom-right, 16px inset, 44px tall.
- Primary-800 at 92% with backdrop blur, ivory text, radius 999.
- Contents: "Admin" with a 6px sage-light dot · "Dashboard" · "Edit this page ↗" (only where a route maps to a Studio document; otherwise hidden) · a sign-out icon with aria-label.
- Below 640 it collapses to one 44px "Admin" button that opens those items as a small menu.
- It never covers a sticky CTA (it lifts above it), hides in print, isn't shown inside /admin, and its DOM position is after main.
(audit.md; WCAG 2.5.7, 2.4.11)

(f) DOOR SCANNER, inside the shell, mobile-first.
- At <640 the top bar shrinks to 48px.
- A camera viewport at full width, 1:1, max 480px.
- Under it, DoorResultBanner at a minimum 72px tall, with icon + text + colour, never colour alone: valid (sage tint, ✓, the name), already used (brass, a warning icon, first check-in time), invalid (red-700, ✕).
- A manual booking-ref field, 48px, autocapitalize="characters".
- A 56px "Scan next" button.
- Screen Wake Lock where supported.
- "Checked in: N" if the data exists.
(audit.md targets; H1)

Acceptance:
- Each of the 7 routes at 1280, 1024, 768 and 390: no horizontal scroll, the sidebar or drawer works by keyboard, active state correct.
- Ticket and Applications tables fit at 1280, become cards at 390, and the detail drawer works.
- Pill: no overlap at 390 or 1280; keyboard and screen reader can use it.
Send me screenshots per route before beta, and I'll check in Canary after deploy.

---

## Codi later ruling (supersedes (c) stat cards), 2026-10-22

Verbatim, relayed by the lead after Codex read the older (c) line:

"2 columns from 640 to 1439 and 4 columns from 1440 (2xl, or a 1440 breakpoint), so the labels stay on 1–2 lines. Equal heights at every width with items-stretch / h-full on the card, so the numbers sit on one baseline."

This replaces the "4 across at ≥1280, 2 at 640–1279, 1 below 640" line in (c). Implemented as `min-[90rem]:grid-cols-4` (90rem = 1440px, written in rem so Tailwind v4 orders it after `sm:`; the project has no Tailwind 1440 token; the drawer uses a raw 1440px media query in app/globals.css).

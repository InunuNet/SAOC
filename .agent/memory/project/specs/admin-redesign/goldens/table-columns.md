# Table column specs (golden) — Codi ruling (d)

All tables: table-layout fixed, <=6 columns at >=1024, no min-w, no whitespace-nowrap on cells; text left, numbers/dates right + tabular-nums; header mono 11px uppercase .12em muted on bone, sticky; rows 48px; priority 1-3 (3 hides 640-1023); <640 stacked cards (title = primary field bold, status pill top-right, 2-3 label/value pairs, whole card opens detail). Column config lives in `components/admin/table/columns.ts` exporting TICKET_COLUMNS, APPLICATION_COLUMNS, VENDOR_COLUMNS as `{ id, label, width, priority, align }[]` (label = header text below).

## Tickets (/admin/tickets) — from ruling
| id | label | priority | align |
|---|---|---|---|
| bookingRef | Booking ref | 1 | left (mono 13) |
| name | Name | 1 | left |
| email | Email | 3 | left |
| ticketType | Ticket type | 2 | left (pill) |
| purchased | Purchased | 2 | right |
| status | Status | 1 | left (StatusPill) |
No actions column (tickets have no row action). Toolbar: search, status segmented filter, count ("N tickets"), CSV link to /api/admin/export-csv.

## Applications (/admin/vendors/applications) — from ruling
| id | label | priority | align |
|---|---|---|---|
| business | Business | 1 | left (name; contact 13px muted beneath) |
| category | Category | 3 | left |
| stands | Stand | 2 | right |
| submitted | Submitted | 2 | right |
| status | Status | 1 | left |
| view | View | 1 | right (44px target) |
"Permits" and "Code" (registration code, reissue) move to the detail view.

## Vendors (/admin/vendors) — NOT specified by the ruling; derived from existing columns (flagged to team-lead)
| id | label | priority | align |
|---|---|---|---|
| business | Business | 1 | left (contact beneath) |
| category | Category | 3 | left |
| submitted | Submitted | 2 | right |
| status | Status | 1 | left |
| standPayment | Stand payment | 2 | left |
| view | View | 1 | right |
Permits & certificates, marketing uploads, payment link, photo link, publish listing move to detail view.

## Detail view groups (definition lists)
Business · Contact · Stand · Permits · Payment · Photos. Sticky footer: Approve / Reject / Payment link / Photo link (+ existing publish listing and reissue code where they exist today).

## Findability requirements (team-lead, from Brad's failed test 2026-10-22) — HARD
- Every admin list orders server-side newest first: tickets `orderBy('purchasedAt','desc')`, applications and vendors `orderBy('submittedAt','desc')`. Tables never re-sort client-side. (Firestore .get() with no orderBy returns auto-ID order — the root cause.) If an index is needed, add it to firestore.indexes.json.
- H1 and sidebar label match: "Applications" (/admin/vendors/applications), "Vendors" (/admin/vendors), "Tickets", "Door scanner", "Settings", "Dashboard". No two admin pages share an H1. The old "Vendor Applications" title and the "View new applications →" cross-link go away.
- Applications default status filter is "Pending" (or "All"), newest first. Cards at <640 carry `data-admin-card`; the sidebar pending badge carries `data-pending-badge`.
- Fixture contract: fixture applications = 8 rows, 4 pending, first row (newest) "Fresh Fixture Nursery" pending with submittedAt = now; dashboard fixture likewise (4 pending <= 5, so Needs attention includes it). Badge must read 4.
- Open conflict: ruling says Needs attention = 5 OLDEST pending; with >5 pending a fresh one would not show there. Ruling kept; the guarantee for a fresh application is the Applications list (newest first) + badge. Raised with team-lead.

## Codi token rulings (final)
- Pill dot: accent-soft. Brass "pending" tile: bg accent with primary-800 text/icon, never white.
- ONE new token: `--color-error: #9b2c2c` in app/globals.css @theme, defined once; Tailwind `bg-error`/`text-error`. No other new hex or rgba (scrim rgba(34,40,31,.55) only).
- Door banner: invalid = bg-error, white text, ✕ icon; valid = bg-primary, white text, ✓ icon; already-used stays brass with its warning icon (text primary-800, not white).
- Vendors columns confirmed as listed. Submitted column right-aligned, newest-first, `aria-sort="descending"` on its th (all lists with a Submitted/Purchased date column).
- Tickets newest-first (purchasedAt desc). Dashboard Orders = orders with status 'paid' only.

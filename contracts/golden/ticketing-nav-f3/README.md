# Decision Record: F3 (ticketing-conferences-and-events, M2) — Nav extension deferred

## The brief's assumption didn't hold

F3's inline_brief: "Add 'Conferences' and 'Workshops & Field Trips' as two more entries
(direct links, matching the existing Visitor/Exhibitor/Vendor pattern) once F1/F2's routes
exist." It also explicitly flagged the fallback: if this needs Header/MegaMenu/MobileMenu
structural changes, "that's a signal Mission One's 'data-driven for extensibility' claim was
wrong and needs flagging, not silently patching around."

F1 and F2 (both done, commits `9b48493` and `2937c50`) built the ticket-TYPE DATA MODEL only —
`CONFERENCE_PRODUCTS` and `WORKSHOP_FIELD_TRIP_PRODUCTS` in `lib/provisional-figures.ts`,
seeded as Sanity `ticketType` documents. Neither built a purchase page or route. Confirmed by
reading `app/`: the only real ticket-purchase-adjacent routes are `/tickets` (Visitor),
`/national-show/exhibitors`, and `/national-show/vendors/register`. There is no
`/national-show/conferences` and no `/national-show/workshops`.

## Options considered

**(a) Link to the existing `/tickets` page, filtered by category.**
Rejected — not available without new work. Read `app/(marketing)/tickets/page.tsx` and
`sanity/queries.ts`: `activeTicketTypesQuery` selects every active `ticketType` document for
the active show with **no category filter**, and `sanity/schemas/documents/ticketType.ts` has
**no category-discriminating field** (no `category`, no equivalent). Once F1/F2's 10 products
are seeded, they already render mixed into the same list as the 5 admission products on
`/tickets` — a "Conferences" nav link pointing at `/tickets` would land on a page showing all
15 products, not just the 6 Conference ones. Building category filtering (schema field +
query change + page logic, likely a dedicated route or a query-param-scoped view) is real
feature work with its own design surface — more appropriately owned by F4 (checkout support,
which already has to reason about how these new ticket types flow through the buying
experience) or a new feature, not F3's nominal "small mechanical nav extension."

**(b) Wait — do not add nav entries yet.** Chosen. There is genuinely nothing live to link to,
and the two ways to fake it (link to an unscoped page under a scoped label, or link to a
nonexistent route) both violate this project's rule against dead/misleading links. Honest,
minimal-scope answer.

**(c) Nav entries with `disabled: true` "coming soon."** Rejected for now, on inspection.
`NavLeaf.disabled` exists and is honored by `Header.tsx` and `MobileMenu.tsx` for top-level
`NavItem`s (see the existing "Learn" entry), but `MegaMenu.tsx`'s column-link rendering
(`components/chrome/MegaMenu.tsx:90-99`) maps `column.links` straight to active `<Link>`s and
never checks `.disabled`. Adding that support would be a structural change to `MegaMenu.tsx` —
exactly what F3's brief said to flag rather than silently patch around. Noting it here as the
concrete trigger: if a future feature adds real `.disabled` handling to `MegaMenu.tsx` for its
own reasons, option (c) becomes cheap and should be reconsidered then.

## What this contract does instead

Five guard-rail shell assertions (`contract-f3.yaml`) that mechanically prove today's actual
state — no premature nav entries, no routes, no category field/filter, no MegaMenu `.disabled`
support, and this README exists. They are not implementation-progress checks; they exist so
this decision can't silently rot: if any of the underlying facts changes (a route ships, a
category filter ships, MegaMenu gains disabled support, or someone adds a nav entry anyway
without either landing first), the contract gate goes red and flags it for review rather than
drifting unnoticed.

## What should happen next

F3 stays `blocked`, not `done`. The mission file's F3 status should be corrected to reflect
this — it currently reads `pending` with no indication the "once F1/F2's routes exist"
precondition is unmet. Recommend either:
- Re-scoping F4 (checkout support) to also decide and build the category-aware
  page/route surface these two categories need, after which F3 becomes the actual mechanical
  append its tier assumed, or
- Adding a new feature between F1/F2 and F4/F3 explicitly for "Conferences and Workshops
  purchase pages," if that's judged too large to fold into F4.

Either way, F3 itself should not be re-dispatched to @dev until one of A2/A3 above would flip
green for a real reason.

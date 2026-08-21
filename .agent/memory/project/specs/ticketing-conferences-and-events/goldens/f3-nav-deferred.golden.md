# F3 Golden: Nav extension deferred, not implemented

**This is a deferral golden, not an implementation spec.** F3's original brief ("add
Conferences and Workshops & Field Trips as two more direct-link entries... once F1/F2's
routes exist") assumed routes would exist by the time F3 ran. They don't — F1/F2 only shipped
the ticket-type DATA MODEL. There is no page or route for either category, and the one page
that could plausibly host them (`/tickets`) has no way to scope itself to a single category.

## Expected state (what the contract's assertions prove)

1. `components/chrome/nav-config.ts`'s Tickets column has exactly its original three links —
   Visitor Tickets, Exhibitor Entry, Vendor Registration. No Conferences or Workshops entry.
2. No `app/(marketing)/national-show/conferences/` or `.../workshops/` directory exists.
3. `sanity/schemas/documents/ticketType.ts` has no `category` field; `activeTicketTypesQuery`
   in `sanity/queries.ts` has no category filter.
4. `components/chrome/MegaMenu.tsx`'s column-link rendering does not check `.disabled` on a
   `NavLeaf` — so a "coming soon" disabled placeholder entry is not available today without a
   structural change to that component.
5. `contracts/golden/ticketing-nav-f3/README.md` exists and records this decision.

## What would invalidate this golden

- A category-aware route or a category filter on `/tickets` ships (satisfies option a).
- `MegaMenu.tsx` gains real `.disabled` rendering support for a reason unrelated to this
  feature (reopens option c on its own merits).
- Someone adds a Conferences/Workshops nav entry without either of the above landing first
  (this would be the premature-scope regression this golden exists to catch).

Any of these should prompt re-opening F3 with @architect, not silently editing nav-config.ts.

# F4 Golden: National Show mega-menu Tickets column wired to both new categories

**This supersedes `goldens/f3-nav-deferred.golden.md`**, which recorded a deferral decision
under this feature's old number ("F3") from before the mission's mid-mission feature
renumbering. That deferral is resolved: F3 (now shipped) built real category-aware purchase
pages at `/national-show/conferences` and `/national-show/workshops`, so the premise the
deferral rested on ("nothing live to link to") no longer holds.

## Expected state

`components/chrome/nav-config.ts`'s `tickets` `NavColumn.links` array contains exactly five
entries, in this order, with the first three unchanged from Mission One:

1. `{ id: 'visitor', label: 'Visitor Tickets', href: '/tickets' }`
2. `{ id: 'exhibitor', label: 'Exhibitor Entry', href: '/national-show/exhibitors' }`
3. `{ id: 'vendor', label: 'Vendor Registration', href: '/national-show/vendors/register' }`
4. `{ id: 'conferences', label: 'Conferences', href: '/national-show/conferences' }`
5. `{ id: 'workshops', label: 'Workshops & Field Trips', href: '/national-show/workshops' }`

No other file changes. `Header.tsx`, `MegaMenu.tsx`, and `MobileMenu.tsx` are all
nav-config-driven already (Mission One's design, documented in `nav-config.ts:1-9`) — this
feature is a pure data append to the `links` array and must not touch any of those three
files. If implementing this feature seems to require touching them, that's a signal Mission
One's "data-driven for extensibility" claim was wrong, and should be flagged to the
architect/orchestrator rather than silently patched around.

The "Workshops & Field Trips" label is used verbatim — never a bare "Events" label, since a
top-level "Events" nav item already exists elsewhere in `NAV` and points to `/events`
(unrelated content); reusing that word for this column entry would collide with it. This
naming rule was already established in the `ticketing-nav-restructure` mission's F2.

## What would invalidate this golden

- Either `/national-show/conferences` or `/national-show/workshops` stops existing (route
  removed or renamed) — the nav entries would then point at a 404.
- A structural change is made to `Header.tsx`, `MegaMenu.tsx`, or `MobileMenu.tsx` to
  accommodate this feature — reopen with @architect instead of shipping it.
- The "Workshops & Field Trips" entry's label is shortened to bare "Events" or similar,
  recreating the naming collision Mission One resolved.

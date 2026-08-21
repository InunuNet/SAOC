# F2 golden — resolve the "Events" naming collision

## What F1 already resolves by construction

Before F1, the top-level nav had two things that could be called "Events": the societies
calendar (`/events`, label "Events") and, informally, Lee-Ann's ticketing category name
for workshops/field trips/the Sunset Cocktails evening. F1 removes the standalone top-level
"Tickets" link and nests all ticketing under "National Show," so there is no second
top-level nav item named "Events" — the collision at the TOP LEVEL is gone once F1 ships.
F2 does not need to touch `Events` in `nav-config.ts`'s top-level `link` items; leave that
label exactly as "Events," pointing at `/events`, unchanged.

## What F2 must still check

The word "Events" can still appear, unqualified, in places F1 newly introduces or touches:

1. `nav-config.ts` — the Tickets column and its three leaf labels/headings must never use
   the bare word "Events" for anything. (They don't need to today — "Visitor Tickets" /
   "Exhibitor Entry" / "Vendor Registration" / "Tickets" — but this is the regression this
   check exists to catch if a later edit drifts.)
2. The new chooser page at `app/(marketing)/national-show/tickets/page.tsx` — its copy
   (heading, question text, option labels) must never use the bare word "Events" to refer
   to a ticket category. If workshops/field trips/cocktails need a passing mention (they
   don't need to be built, but might be referenced as "coming soon" prose), the required
   qualified form is **"Workshops & Field Trips"** — the exact phrase already used in the
   mission brief for Mission Two — never bare "Events."
3. Any copy F1 touches in `Header.tsx` / `MobileMenu.tsx` (aria-labels, visually-hidden
   text, etc.) — same rule: no bare "Events" used to mean the ticketed category.

## What F2 explicitly does not do

- Does not rename the existing `/events` route or its "Events" nav label — that page (21
  affiliated societies' meetings/local shows) keeps its name; it was never the ambiguous
  half of the collision, the ticketing category name was.
- Does not draft final copy for the not-yet-built Conferences/Workshops & Field
  Trips/Cocktails category — Mission Two owns that, once Lee-Ann's pricing/category data
  lands (per the mission's "Mission Two" note). F2 only prevents bare "Events" from
  leaking into what F1 ships now.
- Does not touch breadcrumbs beyond what F1's new page needs (the chooser page's own
  breadcrumb, if `components/chrome/Breadcrumb.tsx` is used, must read "National Show >
  Tickets" or equivalent — never bare "Events").

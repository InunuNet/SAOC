---
schema: athanor.mission/v1
slug: ticketing-nav-restructure
goal: 'Restructure ticketing navigation so a visitor lands on the correct ticket category
  (Orchid Exhibition Visitor/Exhibitor/Vendor, Conferences, Workshops/Field-Trips/Cocktails)
  without guessing, and resolve the naming collision between ticketed "Events" and the
  existing societies-calendar "Events" nav item, ahead of building the Conferences and
  Events ticket categories'
created_at: '2026-08-21T00:00:00+00:00'
started_at: null
last_active_at: null
status: done
started_at: '2026-08-21T11:30:00+00:00'
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F2
  ts: '2026-08-21T00:00:00+00:00'
features:
- id: F1
  status: done
  tier: apex
  title: 'APPROVED 2026-08-21: National Show mega-menu with Tickets chooser + direct deep links'
  inline_brief: 'Brad approved a direction 2026-08-21 from
    https://claude.ai/code/artifact/294a3298-1040-4ff7-b1ff-8b7a0ed4facb (updated to show it):
    ticket sales are specific to the 2027 National Show, not site-wide, so "National Show"
    becomes the ONE top-level nav item and everything else (About the Show, Tickets,
    Programme, Exhibitors & Vendors, etc.) becomes a sub-item under its mega-menu. Within
    that mega-menu, the "Tickets" column HEADING routes to a chooser page ("What are you
    here for?" - Option B: a plain-language question that routes an undecided visitor to
    the right category) while the SAME column also lists direct sub-links straight to
    Visitor tickets and Exhibitor/Vendor entry, so someone who already knows what they want
    never has to answer the question. This is Mission One, explicitly scoped to ONLY the
    Orchid Exhibition category (Visitor + Exhibitor/Vendor) - the only category that is
    actually built today. DO NOT build or stub Conferences or Workshops/Field-Trips/
    Cocktails routes/pages in this feature - they get their own mission (Mission Two, per
    Brad 2026-08-21) once this nav shell and Exhibition ticketing are proven. The mega-menu
    structure and the Tickets column itself SHOULD reserve visual/structural room for
    Conferences and Workshops & Field Trips as future sub-links (per the approved mockup),
    but those links do not need to resolve anywhere real yet - agree with @architect
    whether to omit them entirely from this pass or render them as visibly "coming soon"
    rather than a dead 404, whichever is the smaller true scope. Tier: apex - this touches
    the site-wide Header/nav component, a new chooser route/page, and the existing ticket
    purchase entry points, so treat it as the harder of this mission''s two features per
    Brad''s standing instruction to bump model tier on difficult work. Read the current nav
    implementation (components/chrome/Header.tsx, MobileMenu.tsx, or wherever it actually
    lives - do not assume) before scoping; also read app/(marketing)/tickets/ for the
    current ticket purchase entry point(s) this needs to route into. Mobile nav (there is
    an existing MobileMenu component per backlog''s /contact-unreachable-on-mobile item)
    needs its own version of this mega-menu -> chooser structure, not just a desktop
    dropdown; do not ship desktop-only and call it done.'
- id: F2
  status: done
  tier: standard
  title: Resolve the "Events" naming collision
  inline_brief: 'The site already has a top-level "Events" nav item at app/(marketing)/events/
    for the 21 affiliated societies'' meetings and local shows. Lee-Ann''s ticketing spec
    also calls one of its three categories "Events" (workshops, field trips, the Sunset
    Cocktails evening at the National Show) - a different thing entirely. Now that F1 nests
    everything ticketing-related under "National Show," this collision is resolved BY
    CONSTRUCTION for the top-level nav (there is no longer a second top-level "Events") -
    but the same word will still appear as a sub-link label inside the National Show
    mega-menu (e.g. "Workshops & Field Trips") once Mission Two builds that category, and
    any in-page copy/breadcrumbs must not reuse "Events" unqualified where it could mean
    either thing. Tier: standard - this is a naming/copy check, not new structure. Propose
    label wording rather than inventing final copy Brad hasn''t seen, same discipline as F2
    of leeann-content-corrections. This can land as part of F1''s implementation pass rather
    than a fully separate dev cycle if the architect judges them one contract -
    @architect''s call at scoping time, but keep the two concerns (nav structure vs. naming
    audit) clearly separable in the contract so QA can test them independently.'
milestones:
- id: M1
  title: Nav restructure and Events-naming fix (Exhibition category only - Mission One)
  features:
  - F1
  - F2
  status: done
---

# Mission: Fix ticketing navigation

## Context

Drafted 2026-08-21, next mission after `leeann-content-corrections`, per Brad's direction:
"next mission is fix NAV, then we move onto scoping/building the rest of the categories
Conferences and Events tickets." Precedes any work building the Conferences or Events
(workshops/field trips/cocktails) ticket categories themselves - the nav needs a shape that
scales to three categories before a second and third one get built into a nav designed for
only one.

Only Orchid Exhibition Visitor ticketing is shipped today (verified E2E on the deployed site
2026-08-20/21). Exhibitor, Vendor, Conferences, and Workshops/Field-Trips/Cocktails are all
unbuilt - see the "Category structure" note in `.agent/memory/project/backlog.md`.

## Mission Two (not this mission - do not scope it here)

Brad, 2026-08-21: once this mission (Mission One) ships, Mission Two expands ticketing to
the other two categories - Conferences and Workshops/Field Trips/Cocktails ("Events" in
Lee-Ann's doc). Deliberately not drafted yet - real ticket types, prices, and capacities
for those categories are still being estimated (see leeann-content-corrections F4) and
drafting Mission Two's contract before that data exists would mean inventing scope. Draft
it once Mission One's gate is green and F4's estimates land.

## Notes

- F1's nav direction is APPROVED as of 2026-08-21 (see F1's inline_brief) - the artifact
  recommendation is no longer a proposal, it's the spec. @architect should treat the
  artifact's "Chosen direction" mockup as binding UX, not a starting point to redesign.
- Do not restructure or rename routes to force a design - adapt within
  `app/(marketing)/` structure per this project's CLAUDE.md design-handoff rules; this is
  navigation/routing, not a new visual design system, so it does not need to wait on a
  Claude Design handoff, but should not invent new brand colours/visual treatment either.
- Check whether this mission's F1/F2 overlap with the paused `multi-line-item-cart` mission's
  F6 (booking contact block, POPIA fields) before dispatching - unlikely given F6 is
  checkout-flow content not nav structure, but confirm rather than assume.

## Closeout (2026-08-21)

M1 (F1+F2) done, gate green 8/8. "National Show" is the one top-level nav item; a data-driven
mega-menu (`components/chrome/nav-config.ts`) holds About the Show / Tickets / Get Involved
columns, desktop and mobile both cover it. Tickets column heading routes to
`/national-show/tickets` ("What are you here for?"); the same column also lists direct
sub-links to Visitor/Exhibitor/Vendor entry points. F2's naming collision resolved by
construction (no second top-level "Events"). Chain: @architect-apex (F1, tier: apex) →
@dev → @qa-apex adversarial → mandatory Codex GPT-5.5 cross-model pass (run twice) → @docs
(`docs/f1-ticketing-nav-restructure.md`) → gate 8/8. Two real defects caught and fixed, see
`learned.md`: a keyboard focus-escape bug in the desktop mega-menu (@qa-apex) and a mobile
"National Show" disclosure that never linked to `/national-show` itself (Codex). Mission
status set to `done`. Mission Two (Conferences + Workshops/Field-Trips/Cocktails categories)
is intentionally not drafted yet — blocked on real pricing data from
`leeann-content-corrections` F4, per this file's own "Mission Two" section above.

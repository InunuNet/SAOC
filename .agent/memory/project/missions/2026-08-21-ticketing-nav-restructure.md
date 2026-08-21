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
status: pending
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  status: pending
  title: Confirm nav approach with Brad from the nav-options artifact, then implement it
  inline_brief: 'Three nav options were mocked up 2026-08-21 for Brad to choose from:
    https://claude.ai/code/artifact/294a3298-1040-4ff7-b1ff-8b7a0ed4facb (Option A: single
    "Tickets" mega-menu with three columns; Option B: a "what brings you?" chooser landing
    page that routes to one category; Option C: flat top-level nav items per category,
    no grouping). Orchestrator recommended Option B with Option A folded in as a
    "know what you want? jump straight there" shortcut on the chooser page, but this is
    Brad''s call, not a settled decision - DO NOT dispatch @architect on this feature until
    he has actually picked one (or a variant) in conversation. Today only Orchid Exhibition
    Visitor ticketing exists and is reachable; this feature is scoped to the NAV STRUCTURE
    only (the shell that will host Conferences/Events links once they exist), not to
    building the Conferences or Events ticket flows themselves - those are separate,
    later missions once this nav shell is in place. Read the current nav implementation
    (components/chrome/*, check for a Header/Nav component) before scoping - do not assume
    its current structure without reading it first.'
- id: F2
  status: pending
  title: Resolve the "Events" naming collision
  inline_brief: 'The site already has a top-level "Events" nav item at app/(marketing)/events/
    for the 21 affiliated societies'' meetings and local shows. Lee-Ann''s ticketing spec
    also calls one of its three categories "Events" (workshops, field trips, the Sunset
    Cocktails evening at the National Show) - a different thing entirely. Whichever nav
    option F1 lands on, these two concepts need distinct, unambiguous labels before the
    ticketed category ships (e.g. "Society Events" vs "Show Workshops & Trips", or similar
    - exact wording is a content decision, not this brief''s to invent; propose options to
    Brad rather than picking one unilaterally, similar to how F2 of
    leeann-content-corrections flagged rather than guessed Lee-Ann''s missing email). This
    can land as part of F1''s implementation pass rather than a fully separate dev cycle if
    the architect judges them one contract - orchestrator/@architect''s call at scoping
    time.'
milestones:
- id: M1
  title: Nav restructure and Events-naming fix
  features:
  - F1
  - F2
  status: pending
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

## Notes

- F1 is gated on a real decision from Brad, not the orchestrator's recommendation in the
  artifact - do not treat the recommendation as pre-approval.
- Do not restructure or rename routes to force a design - adapt within
  `app/(marketing)/` structure per this project's CLAUDE.md design-handoff rules; this is
  navigation/routing, not a new visual design system, so it does not need to wait on a
  Claude Design handoff, but should not invent new brand colours/visual treatment either.
- Check whether this mission's F1/F2 overlap with the paused `multi-line-item-cart` mission's
  F6 (booking contact block, POPIA fields) before dispatching - unlikely given F6 is
  checkout-flow content not nav structure, but confirm rather than assume.

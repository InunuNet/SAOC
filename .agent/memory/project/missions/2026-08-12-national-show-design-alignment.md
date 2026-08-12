---
schema: athanor.mission/v1
slug: national-show-design-alignment
goal: Bring the Claude Design assets and design system into the repo and rebuild the
  National Show section to match the agreed design spec
created_at: '2026-08-12T16:31:05.000000+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 4
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  title: Ingest the Claude Design handoff and record what it actually specifies
  inline_brief: BLOCKED until Brad delivers the assets — this mission cannot start
    without them. When they land, inventory the bundle (tokens, type scale, spacing,
    components, page compositions, imagery treatment) and write it down as the single
    source of truth before any code changes. Diff it against what the repo already
    has in `app/globals.css` so the delta is explicit rather than discovered mid-build.
    Do NOT begin implementation during this feature.
  status: pending
  milestone: M1
- id: F2
  title: Add the design tokens to globals.css without breaking the existing site
  inline_brief: Tailwind v4 is CSS-first — brand tokens go into `app/globals.css` as
    `@theme` variables. The current token set (bone/parchment/ink/rule/muted/primary/accent,
    "Sage & Paper") is a PLACEHOLDER, not the real SAOC brand, and is used site-wide.
    Adding or replacing tokens therefore risks every page, not just the Show section
    — assert the non-Show pages still render correctly, over real HTTP, before and
    after.
  status: pending
  milestone: M1
- id: F3
  title: Rebuild the National Show section against the design
  inline_brief: The Show surfaces are `/national-show` (landing), `plan-your-visit`,
    `what-to-expect`, `faq`, `exhibitors`, `archive` and `archive/[year]`. Implement
    the handoff faithfully against the EXISTING route structure — per CLAUDE.md, adapt
    the design to the structure, do not restructure routes or rename pages to fit the
    design. Every value already wired to Sanity must STAY wired; the show identity
    (title, venue, dates, edition, countdown) flows from the `nationalShow` singleton
    across seven surfaces and a redesign must not re-hardcode any of it.
  status: pending
  milestone: M2
- id: F4
  title: Apply the National Show 2027 brand layer correctly
  inline_brief: Per the resolved brand-architecture decision, SAOC chrome stays site-wide
    and Show branding sits BELOW the header on /national-show. Assets are in `branding/national-show-2027/`
    (logo in 5 formats, 13 cleared Scott Ormerod photos, palette A7A841/7F7D33/211A57/F3F2D6,
    Montserrat + display faces). Note Brad has since produced a new Show logo and is
    designing the SAOC org logo — confirm which assets are current before using the
    2027 folder. The favicon should be revisited once the org logo lands.
  status: pending
  milestone: M3
milestones:
- id: M1
  title: The design system is in the repo and understood, nothing broken
  features:
  - F1
  - F2
  status: pending
- id: M2
  title: The Show section matches the agreed design
  features:
  - F3
  status: pending
- id: M3
  title: Show branding applied at the right layer
  features:
  - F4
  status: pending
---

# Mission: National Show design alignment

## Context

**Brad's directive, 2026-08-12:** "I need to bring the Claude design assets and the design system
to you so that we can fix the national show section of the website to match the actual design
spec we've all agreed on."

Visual design for this project is produced in **Claude Design** (claude.ai/design) as a separate
workstream, and design approval happens there, not in this repo. What exists in the codebase
today is a placeholder system, and the National Show section was built structurally rather than
to an approved design.

### BLOCKED — this mission cannot start yet

Brad must deliver the design bundle first. Per CLAUDE.md a handoff contains the design spec
(colours, typography, spacing tokens), the component structure with props, and implementation
notes. Until that arrives there is nothing authoritative to build against, and **no agent should
invent brand assets, colours or fonts** — that is a standing project rule, not a preference.

### What is already true about the Show section

- `/national-show` and its sub-pages are structurally complete and Sanity-editable: show identity
  (title, venue, dates, edition, countdown) flows from the `nationalShow` singleton to all seven
  surfaces, proven by a runtime swap sweep rather than a source grep. **A redesign must not
  re-hardcode any of it.**
- Visitor information (`plan-your-visit`, `what-to-expect`, `faq`) and exhibitor information
  shipped with contracts green (74/74 and 52/52) and carry honestly-labelled placeholder content
  pending committee confirmation.
- A "Book Tickets" CTA now sits in the hero CTA row; keep an equivalent entry point in any
  redesign — reachability of the revenue path is a first-class requirement, not decoration.

### Watch for these when the design lands

- **Design reference vs. built page may legitimately differ.** There is a standing unresolved
  question about hero lede copy where the reference and the local code differ and authority was
  never established — do not silently overwrite copy in the name of fidelity.
- **`design/Claude Design HTML/SAOC Website (standalone).html`** is the existing reference for the
  main site. Note it contains no "In collaboration with" section, which is how we discovered that
  section had been invented — treat absence from the reference as a question, not permission.
- **Spec V3 asks for a separate Show website** rather than a section of this one. That is an open
  commercial question for Brad and is explicitly parked; this mission improves the Show section
  where it currently lives and must not pre-empt that decision.

## Notes

- Tailwind v4, CSS-first: tokens go in `app/globals.css` as `@theme` variables, no
  `tailwind.config.ts`.
- Known pre-existing defect worth fixing while in the area: `ShowBand.tsx:35`'s `aspect-[4/3]`
  causes horizontal overflow at 375px.
- Assert rendered output over real HTTP, at multiple viewports, with negative controls. A visual
  mission is exactly where false-green assertions are easiest to write and hardest to notice.

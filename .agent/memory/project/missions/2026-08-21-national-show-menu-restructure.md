---
schema: athanor.mission/v1
slug: national-show-menu-restructure
goal: 'National Show mega-menu restructure: surface About-the-Show content pages (What
  to Expect, Plan Your Visit, FAQ, Archive — confirmed 200 OK but unreachable from
  any menu) alongside the existing Tickets column, and fix /national-show/exhibitors
  reading as a dead end (no purchase CTA, no messaging) for Brad''s live-tested complaint
  2026-08-21. QA-apex confirmed via real browser: deploy is live and correct, no misrouted
  links — this is a menu-structure and page-messaging gap, not a bug.'
created_at: '2026-08-21T20:29:26.306594+00:00'
started_at: null
status: close_out
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F2
  ts: '2026-08-21T20:48:26.059549+00:00'
features:
- id: F1
  status: done
  tier: standard
  title: Two-column National Show mega-menu — add an "About the Show" column alongside
    the existing Tickets column
  inline_brief: 'Extend the show NavItem''s columns array in components/chrome/nav-config.ts
    from 1 to 2 NavColumn entries. New "About the Show" column (heading links to /national-show,
    the show''s own home page): What to Expect (/national-show/what-to-expect), Plan
    Your Visit (/national-show/plan-your-visit), FAQ (/national-show/faq), Archive
    (/national-show/archive). Existing "Tickets" column (5 links) stays byte-for-byte
    unchanged. MegaMenu.tsx already maps item.columns generically — verify it renders
    a second column correctly (likely only needs a flex/grid wrapper class change,
    no new design tokens or colours per CLAUDE.md''s no-invented-brand-assets rule
    — reuse existing panel/heading/link styling exactly). MobileMenu.tsx architect-assessed
    as needing ZERO structural change (already stacks columns.map() inside one accordion
    panel) — prove this with a contract assertion (diff of MobileMenu.tsx and Header.tsx
    against pre-F1 baseline is empty), not just an assumption. Read .agent/memory/project/specs/national-show-menu-restructure/spec.md
    for the full design rationale (two-column flat over true nested submenu — explicitly
    rejected nesting due to this project''s existing a11y debt and MegaMenu.tsx having
    zero flyout/hover-intent concept today). Verify at 375px and 320px with a real
    browser before calling done — this project has a standing CLAUDE.md rule that
    visual/nav changes are not done until a browser has seen them.'
  contract: .agent/memory/project/specs/national-show-menu-restructure/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/national-show-menu-restructure/goldens/f1-nav-about-column.golden.md
  completed_at: '2026-08-21T20:48:25.847624+00:00'
- id: F2
  status: done
  tier: standard
  title: Exhibitor-entry messaging fix — replace implied-purchase framing with honest
    "not yet open" status
  inline_brief: 'app/(marketing)/national-show/exhibitors/page.tsx and app/(marketing)/national-show/tickets/page.tsx''s
    Exhibitor-entry chooser card both currently read as though exhibitor tickets can
    be purchased when no exhibitor ticket product exists (confirmed: /tickets has
    5 admission products, none exhibitor; no separate exhibitor-purchase route anywhere
    on the site). Add a clear static banner/note on both surfaces stating exhibitor
    ticket sales are not yet open, matching the site''s existing "to be confirmed"/provisional
    voice already used elsewhere on this page (e.g. ExhibitorKeyDates''s "TO BE CONFIRMED
    BY THE SHOW COMMITTEE" badge pattern) — do not invent a date or process, do not
    build a purchase flow, do not touch Sanity schema. This is a copy/messaging fix
    only. Read spec.md for the exact recommended wording approach before writing final
    copy.'
  contract: .agent/memory/project/specs/national-show-menu-restructure/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/national-show-menu-restructure/goldens/f2-exhibitor-messaging.golden.md
  completed_at: '2026-08-21T20:48:26.059359+00:00'
milestones:
- id: M1
  status: done
  features:
  - F1
  - F2
  gate_ran_at: '2026-08-21T20:48:50.134555+00:00'
  gate_result: pass
---






# Mission: National Show mega-menu restructure: surface About-the-Show content pages (What to Expect, Plan Your Visit, FAQ, Archive — confirmed 200 OK but unreachable from any menu) alongside the existing Tickets column, and fix /national-show/exhibitors reading as a dead end (no purchase CTA, no messaging) for Brad's live-tested complaint 2026-08-21. QA-apex confirmed via real browser: deploy is live and correct, no misrouted links — this is a menu-structure and page-messaging gap, not a bug.

## Context

Spec: .agent/memory/project/specs/national-show-menu-restructure/spec.md (written by
@architect 2026-08-21). Both features are small, disjoint files, no shared risk — one
milestone. Explicitly out of scope, backlog instead: building actual exhibitor ticket
purchasing (pricing-blocked).

## Notes


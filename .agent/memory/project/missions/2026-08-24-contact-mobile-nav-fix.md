---
schema: athanor.mission/v1
slug: contact-mobile-nav-fix
goal: 'Fix /contact unreachable from the header on mobile. Verified live at 375px:
  header Contact button is `hidden sm:inline-block` (Header.tsx:150) and MobileMenu.tsx
  renders only the NAV array plus a mailto: link -- zero a[href="/contact"] in the
  header before or after opening the menu. Footer is the only current path. Fix by
  adding /contact to MobileMenu (the nav list), not by unhiding the desktop button.
  Verify with real BrowserAgent at 375px: open the mobile menu, confirm a visible,
  tappable /contact link exists and navigates correctly. Route through @architect
  for contract + goldens.'
created_at: '2026-08-24T22:56:36.759500+00:00'
started_at: null
status: close_out
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
  name: /contact is reachable from the mobile menu at 375px via a visible, tappable
    /contact link that is not part of the shared NAV array, with the desktop header
    unchanged.
  status: pending
  inline_brief: 'Fix direction confirmed (contracts/golden/contact-mobile-nav-fix-f1/README.md
    "Fix direction"): add one additional /contact <Link> inside components/chrome/MobileMenu.tsx''s
    "Mobile primary" nav, styled and behaving like the existing plain NAV link items
    (same classes, calls onClose on click), rendered outside the nav.map(...) loop
    -- not added to the shared NAV array (components/chrome/nav-config.ts), since
    NAV also drives the desktop Zone 2 primary nav at >=1240px. Header.tsx and nav-config.ts
    are untouched. Full spec and scope boundary: .agent/memory/project/specs/contact-mobile-nav-fix/contract-f1.yaml
    and contracts/golden/contact-mobile-nav-fix-f1/mobile-menu-spec.golden.md. Done
    when the contract''s A1-A5 all pass, including the A5 agent_review BrowserAgent
    pass at 375x667 (mobile menu link works) and 1440x900 (desktop unchanged).'
milestones:
- id: M1
  name: Mobile contact link fix
  features:
  - F1
  gate: contract
  status: done
  gate_ran_at: '2026-08-24T23:07:10.116564+00:00'
  gate_result: pass
---



# Mission: Fix /contact unreachable from the header on mobile. Verified live at 375px: header Contact button is `hidden sm:inline-block` (Header.tsx:150) and MobileMenu.tsx renders only the NAV array plus a mailto: link -- zero a[href="/contact"] in the header before or after opening the menu. Footer is the only current path. Fix by adding /contact to MobileMenu (the nav list), not by unhiding the desktop button. Verify with real BrowserAgent at 375px: open the mobile menu, confirm a visible, tappable /contact link exists and navigates correctly. Route through @architect for contract + goldens.

## Context

(Add context here)

## Notes


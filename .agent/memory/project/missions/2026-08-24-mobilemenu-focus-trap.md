---
schema: athanor.mission/v1
slug: mobilemenu-focus-trap
goal: 'Fix MobileMenu.tsx: the mobile nav drawer has no focus trap. Tab escapes onto
  background page content while the drawer is open. Flagged real by @qa during backlog-a11y-ui-quickfixes
  (2026-08-21/22) while verifying an unrelated focus-ring fix; not folded into that
  mission. Fix: when the drawer opens, focus moves into it (e.g. first focusable element
  or the close/hamburger trigger), Tab and Shift+Tab cycle only within the drawers
  focusable elements (do not let focus reach header/main/footer content behind the
  open overlay), Escape closes the drawer and returns focus to the trigger button
  that opened it, and inert/aria-hidden (or an equivalent) is applied to the rest
  of the page while open so screen readers also do not see background content. Must
  be verified with real BrowserAgent keyboard-only interaction (real Tab/Shift+Tab/Escape
  key presses), not just DOM presence of aria attributes. Route through @architect
  for contract + goldens.'
created_at: '2026-08-24T23:10:17.078851+00:00'
started_at: null
status: done
completed_at: '2026-08-25T00:00:00.000000+00:00'
last_active_at: '2026-08-25T00:00:00.000000+00:00'
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
  title: Hand-rolled focus trap for MobileMenu drawer
  status: pending
  inline_brief: 'Add a useFocusTrap hook (lib/hooks/useFocusTrap.ts) wired into components/chrome/MobileMenu.tsx:
    on open, focus moves to the drawer''s close button (X); Tab/Shift+Tab cycle only
    within the drawer''s focusable elements (nav links, expand buttons, close button,
    mailto link); Escape closes the drawer and returns focus to the hamburger trigger
    button in Header.tsx (its ref must be threaded down or the callback pattern used);
    the rest of the page (header siblings, main, footer) gets inert (or aria-hidden
    as a fallback) while the drawer is open. No focus-trap/radix/headlessui dependency
    exists in package.json — hand-roll, do not add a new dependency for this. Regression:
    mouse/tap open-close, all nav links incl. /contact and the mega-menu expand/collapse,
    and the mailto link must keep working exactly as before.

    '
milestones:
- id: M1
  title: Focus trap implementation and verification
  features:
  - F1
  status: done
  gate_ran_at: '2026-08-24T23:24:17.776680+00:00'
  gate_result: pass
---




# Mission: Fix MobileMenu.tsx: the mobile nav drawer has no focus trap. Tab escapes onto background page content while the drawer is open. Flagged real by @qa during backlog-a11y-ui-quickfixes (2026-08-21/22) while verifying an unrelated focus-ring fix; not folded into that mission. Fix: when the drawer opens, focus moves into it (e.g. first focusable element or the close/hamburger trigger), Tab and Shift+Tab cycle only within the drawers focusable elements (do not let focus reach header/main/footer content behind the open overlay), Escape closes the drawer and returns focus to the trigger button that opened it, and inert/aria-hidden (or an equivalent) is applied to the rest of the page while open so screen readers also do not see background content. Must be verified with real BrowserAgent keyboard-only interaction (real Tab/Shift+Tab/Escape key presses), not just DOM presence of aria attributes. Route through @architect for contract + goldens.

## Context

(Add context here)

## Notes


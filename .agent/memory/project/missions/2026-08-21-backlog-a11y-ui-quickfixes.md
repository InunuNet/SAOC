---
schema: athanor.mission/v1
slug: backlog-a11y-ui-quickfixes
goal: 'Backlog sweep: accessibility and UI-defect quick fixes not blocked on Brad/council
  — dead footer link (wosa.org.za -> wildorchids.co.za), invisible focus rings on
  cream-background buttons (reuse the site''s existing near-black nav-link focus pattern,
  no new colour tokens), low-contrast form error text on ContactForm/TicketPurchaseForm
  (reuse the admin pages'' existing bordered-callout pattern), 375px horizontal overflow
  in ShowBand.tsx, and PartnersSection''s concatenated accessible name. All five are
  small, independently-scoped fixes reusing patterns already established elsewhere
  in the codebase — no invented brand assets, no design decisions pending Brad.'
created_at: '2026-08-21T21:59:08.235296+00:00'
started_at: '2026-08-21T22:05:00+00:00'
completed_at: '2026-08-22T00:00:00+00:00'
last_active_at: '2026-08-22T00:00:00+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F5
  ts: '2026-08-22T00:00:00+00:00'
features:
- id: F1
  status: done
  tier: standard
  title: Footer dead link — wosa.org.za to wildorchids.co.za
  inline_brief: 'components/chrome/Footer.tsx:117 (approx — re-grep, line numbers drift)
    links the dead wosa.org.za domain, site-wide, every page. The live WOSA (Wild Orchids
    of Southern Africa) site is https://wildorchids.co.za. One-line fix — update the href.
    Do not touch WOSA''s own content/branding (out of scope, separate org, per this
    project''s CLAUDE.md scope boundary), just the URL.'
  contract: .agent/memory/project/specs/backlog-a11y-ui-quickfixes/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-a11y-ui-quickfixes/goldens/m1-golden.md
- id: F2
  status: done
  tier: standard
  title: Invisible focus rings on cream-background buttons
  inline_brief: 'Buttons render their focus outline as the same colour as the cream body
    background (rgb(244,243,236)) with a 2px offset — focusable and keyboard-operable but
    invisible to a keyboard user. Confirmed on "Buy Ticket" (/tickets) and "Download
    ticket". Header/footer NAV LINKS already do this correctly with a near-black outline —
    find that exact pattern/token and apply the SAME one to buttons; do not invent a new
    colour or design a new focus treatment. After the token-level fix, browser-verify (not
    grep) that focus is now visible on every button site-wide, not just the two confirmed
    instances — a token change should fix all of them at once if scoped correctly.'
  contract: .agent/memory/project/specs/backlog-a11y-ui-quickfixes/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-a11y-ui-quickfixes/goldens/m1-golden.md
- id: F3
  status: done
  tier: standard
  title: Low-contrast form error text
  inline_brief: 'ContactForm and TicketPurchaseForm (or whatever the current component
    names are — re-grep, they may have been renamed since this was logged) render
    validation error text as text-accent — 2.94:1 contrast on ivory, fails WCAG AA, on
    public-facing forms. The admin pages already use a bordered callout pattern at 13.6:1
    contrast for the same purpose — find that existing pattern and apply the SAME one here,
    not a new design. Public-facing only; do not touch admin forms (already correct).'
  contract: .agent/memory/project/specs/backlog-a11y-ui-quickfixes/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-a11y-ui-quickfixes/goldens/m1-golden.md
- id: F4
  status: done
  tier: standard
  title: ShowBand.tsx 375px horizontal overflow
  inline_brief: 'components/home/ShowBand.tsx:35 (approx) uses aspect-[4/3] and overflows
    horizontally at 375px viewport width — pre-existing, minor. Fix the overflow (likely a
    max-width/w-full or aspect-ratio adjustment) without changing the component''s visual
    intent at desktop widths. Verify with a real browser at 375px and 320px, and confirm
    desktop (1440px) is unaffected.'
  contract: .agent/memory/project/specs/backlog-a11y-ui-quickfixes/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-a11y-ui-quickfixes/goldens/m1-golden.md
- id: F5
  status: done
  tier: standard
  title: PartnersSection accessible name concatenation
  inline_brief: 'PartnersSection.tsx: the partner name and description spans are
    JSX-adjacent with no whitespace text node between them, so the anchor''s accessible
    name concatenates without a space — a screen reader announces e.g. "Wild Orchids of
    Southern AfricaPartner organisation hosting..." as one run-on word. Fix with an
    aria-label on the anchor or a {'' ''} separator between the spans — whichever is the
    smaller, more idiomatic fix given the surrounding JSX. Verify with a real screen-reader
    or accessibility-tree inspection (browser devtools Accessibility panel), not just visual
    screenshot — the bug is in the accessible name, not the visual rendering.'
  contract: .agent/memory/project/specs/backlog-a11y-ui-quickfixes/contract-m1.yaml
  golden_files:
  - .agent/memory/project/specs/backlog-a11y-ui-quickfixes/goldens/m1-golden.md
milestones:
- id: M1
  status: done
  gate_result: pass
  features: [F1, F2, F3, F4, F5]
---

# Mission: Backlog sweep: accessibility and UI-defect quick fixes not blocked on Brad/council — dead footer link (wosa.org.za -> wildorchids.co.za), invisible focus rings on cream-background buttons (reuse the site's existing near-black nav-link focus pattern, no new colour tokens), low-contrast form error text on ContactForm/TicketPurchaseForm (reuse the admin pages' existing bordered-callout pattern), 375px horizontal overflow in ShowBand.tsx, and PartnersSection's concatenated accessible name. All five are small, independently-scoped fixes reusing patterns already established elsewhere in the codebase — no invented brand assets, no design decisions pending Brad.

## Context

Sourced directly from `.agent/memory/project/backlog.md`'s "Accessibility & UI defects"
section, filtered to items with no Brad/council blocker and an existing in-codebase pattern
to reuse (no new design decisions). Dispatched autonomously per Brad's standing 2026-08-21
instruction to keep iterating on backlog items that don't need him, without stopping to ask.
One milestone, five small disjoint-file features.

## Notes


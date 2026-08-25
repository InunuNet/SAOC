---
schema: athanor.mission/v1
slug: tickettypecard-focus-ring
goal: TicketTypeCard's list-mode wrapper <Link> (components/tickets/TicketTypeCard.tsx)
  has no focus-visible:ring-* class and falls back to the default browser outline.
  Still accessible, but visually inconsistent with the custom focus rings already
  used on the quantity stepper buttons in the same file. Apply the identical focus-visible
  ring treatment used on the stepper buttons to the list-mode Link wrapper. Small,
  low-risk, one component.
created_at: '2026-08-25T00:00:00+00:00'
started_at: null
status: close_out
cost_estimate:
  features: 1
  milestones: 1
  total_calls: 0
last_checkpoint: null
features:
- id: F1
  status: pending
  tier: standard
  title: Match list-mode Link focus ring to stepper button focus ring in TicketTypeCard
  inline_brief: In components/tickets/TicketTypeCard.tsx, the mode==='list' branch
    renders a <Link href={`/tickets/${slug}`} className={cardClassName}> with no focus-visible
    styling of its own. The mode==='buy' stepper buttons (same file) use "focus-visible:outline-none
    focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2". Append
    the identical token set to the list-mode Link's className (do not invent a new
    ring color/width/offset — match exactly, per this project's "No invented brand
    assets" rule). card-mode/grid-mode rendering and the stepper buttons themselves
    must be unaffected. Requires a real BrowserAgent/Playwright keyboard-Tab pass
    with screenshots proving the ring renders and is visually consistent with the
    stepper's ring, not just a DOM className match.
  contract: .agent/memory/project/specs/tickettypecard-focus-ring/contract-f1.yaml
  golden_files:
  - contracts/golden/tickettypecard-focus-ring-f1/README.md
  completed_at: null
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-25T11:02:57.793705+00:00'
  gate_result: pass
---



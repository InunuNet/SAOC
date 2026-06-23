---
schema: athanor.mission/v1
slug: design-verify
goal: Verify live site matches Claude Design reference; fix remaining visual gaps
  after chrome-wiring landed
created_at: '2026-06-23T00:00:00Z'
status: done
autonomy: high
features:
- id: F1
  name: Visual audit — compare live site against all 7 reference screenshots
  status: done
  completed_at: '2026-06-23T20:27:29.888897+00:00'
- id: F2
  name: Typography pass — Crimson Pro + Manrope loading and sizes correct
  status: done
  completed_at: '2026-06-23T20:27:30.103473+00:00'
- id: F3
  name: Spacing + colour pass — CSS vars and section padding match spec
  status: done
  completed_at: '2026-06-23T20:27:30.315192+00:00'
- id: F4
  name: Interior pages — spot-check About, Societies, Judging, Events
  status: done
  completed_at: '2026-06-23T20:27:30.522061+00:00'
- id: F5
  name: Fix confirmed gaps via chain
  status: done
  completed_at: '2026-06-23T20:27:30.722263+00:00'
milestones:
- id: M1
  title: Audit complete — gap list produced
  features:
  - F1
  - F2
  - F3
  - F4
  status: done
  gate_ran_at: '2026-06-23T20:27:35.987484+00:00'
  gate_result: pass
- id: M2
  title: All gaps fixed — pnpm build exits 0
  features:
  - F5
  status: done
  gate_ran_at: '2026-06-23T20:27:36.196723+00:00'
  gate_result: pass
last_checkpoint:
  milestone: M2
  feature: F5
  ts: '2026-06-23T20:27:30.722513+00:00'
last_active_at: '2026-06-23T20:27:41.372545+00:00'
completed_at: '2026-06-23T20:27:41.372335+00:00'
---










# Mission: design-verify

## Context

Chrome wiring landed (commits 01ceb4a + b49ff7b). Firebase build confirmed LIVE.
UtilityBar, Header, Footer now mounted in layout.tsx. NavCards and ShowBand verified correct.
Remaining concern: typography, spacing, colour token rendering vs Claude Design reference.

## Reference

- Design spec: `design/design_handoff_saoc/SAOC Website.html`
- Screenshots: `design/design_handoff_saoc/screenshots/01-home.png` through `07-contact.png`
- Token file: `design/design_handoff_saoc/colors_and_type.css`

## Out of scope

- Payment/ticketing (blocked on Stripe)
- DNS cutover
- Phase 2 features
- Hero image selection (rotation is intentional)
- Wild orchid conservation content (WOSA scope)

## Done when

All 7 page sections visually match their reference screenshots within acceptable tolerance. `pnpm build` exits 0.

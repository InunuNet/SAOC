---
schema: athanor.mission/v1
slug: conference-workshop-tickets
goal: 'Build SAOC Symposium, WOSA Conference and Workshops ticketing + NOS-branded
  brochure pages per Brad 2026-10-07 (verbatim: .agent/memory/scratch/brad-ticket-news-2026-10-07.md).
  Symposium and WOSA Conference: separate products, R2000 each, 80 tickets per event
  of which 10 are early-bird, with a live honest ''N of 10 early-bird tickets left''
  scarcity counter per event read from real sales. Brochure/tile layout in NOS branding;
  copy = one short card per presenter (photo + summary bio supplied by Lee-Ann; visibly
  flagged pending until supplied, never invented), each card clicking through to that
  event''s ticket booking. Workshops: small exclusive sessions throughout the show,
  R100 each, 10 tickets per workshop, ticket-only booking; structure built now (Sanity-editable
  sessions), full schedule to follow from Brad/Lee-Ann. Replaces the provisional CONFERENCE_PRODUCTS
  estimates (R450-R900, joint bundle) in lib/provisional-figures.ts. Pages under app/(marketing)/national-show/**
  are the NOS Site lane: post a comms.md notice. Early-bird price not yet given ->
  pending/flagged, never invented.'
created_at: '2026-10-06T22:55:40.960318+00:00'
started_at: '2026-10-06T23:47:42.760004+00:00'
last_active_at: '2026-10-07T04:27:45.379557+00:00'
status: in_progress
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M3
  feature: F5
  ts: '2026-10-07T04:27:45.379557+00:00'
features:
- id: F1
  inline_brief: null
  name: 'Conference/workshop figures: Symposium + WOSA R2000 flat, 80 places each,
    no early bird; workshops R100, 10 places/session'
  milestone: M1
  status: done
  spec: .agent/memory/project/specs/conference-workshop-tickets/contract-f1.yaml
  contract: .agent/memory/project/specs/conference-workshop-tickets/contract-f1.yaml
  started_at: '2026-10-06T23:47:42.759821+00:00'
  completed_at: '2026-10-07T00:19:33.256821+00:00'
- id: F2
  inline_brief: null
  name: 'Admission/evening figures: Weekend Pass R380 + Weekend Pass EB R360 split,
    Day Pass EB R120, shared 500 EB pool, Day Pass excludes Thursday, VIP R300/200,
    Sunset Cocktails R800/100, couple SKU retired'
  milestone: M1
  status: done
  spec: .agent/memory/project/specs/conference-workshop-tickets/contract-f2.yaml
  contract: .agent/memory/project/specs/conference-workshop-tickets/contract-f2.yaml
  started_at: '2026-10-07T00:45:23.262101+00:00'
  completed_at: '2026-10-07T01:10:33.582101+00:00'
- id: F3
  inline_brief: null
  name: Sanity schema excludedDays + migration patches + checkout-route wiring
  milestone: M2
  status: done
  spec: .agent/memory/project/specs/conference-workshop-tickets/contract-f3.yaml
  contract: .agent/memory/project/specs/conference-workshop-tickets/contract-f3.yaml
  started_at: '2026-10-07T01:11:12.726287+00:00'
  completed_at: '2026-10-07T03:49:48.027311+00:00'
- id: F4
  inline_brief: null
  name: 'Race-safe capacity/pricing engine: Day Pass 1000 per day (day-qualified pool
    keys), shared EB pool, concurrency assertions, PayFast sandbox E2E'
  milestone: M2
  status: done
  spec: .agent/memory/project/specs/conference-workshop-tickets/contract-f4.yaml
  contract: .agent/memory/project/specs/conference-workshop-tickets/contract-f4.yaml
  started_at: '2026-10-07T02:00:32.368314+00:00'
  completed_at: '2026-10-07T03:49:43.333586+00:00'
- id: F5
  inline_brief: null
  name: Exhibitor/Vendor R3500 - DOC-ONLY fact-finding pending Brad (#10); no change
    to vendor pricing/payment paths
  milestone: M3
  status: done
  spec: .agent/memory/project/specs/conference-workshop-tickets/contract-f5.yaml
  contract: .agent/memory/project/specs/conference-workshop-tickets/contract-f5.yaml
  started_at: null
  completed_at: '2026-10-07T04:27:45.379410+00:00'
- id: F6
  inline_brief: null
  name: TicketCard/Presenter/WorkshopSession view-models + server loaders with honest
    remaining counts; inert prop wiring; comms.md handoff to saoc-nos-design-f1
  milestone: M4
  status: pending
  spec: .agent/memory/project/specs/conference-workshop-tickets/contract-f6.yaml
  contract: .agent/memory/project/specs/conference-workshop-tickets/contract-f6.yaml
  started_at: null
  completed_at: null
milestones:
- id: M1
  features:
  - F1
  - F2
  name: Ticket figures per Brad 2026-10-07 rulings
  status: done
  gate_ran_at: '2026-10-07T01:10:55.223605+00:00'
  gate_result: pass
- id: M2
  features:
  - F3
  - F4
  name: Capacity/pricing engine + schema wiring
  status: done
  gate_ran_at: '2026-10-07T04:04:50.952028+00:00'
  gate_result: pass
- id: M3
  features:
  - F5
  name: Vendor R3500 fact-finding (doc-only)
  status: done
  gate_ran_at: '2026-10-07T04:32:53.838101+00:00'
  gate_result: pass
- id: M4
  features:
  - F6
  name: Ticket card view-models + design handoff
  status: pending
  gate_ran_at: null
  gate_result: null
---

# Mission: Build SAOC Symposium, WOSA Conference and Workshops ticketing + NOS-branded brochure pages per Brad 2026-10-07 (verbatim: .agent/memory/scratch/brad-ticket-news-2026-10-07.md). Symposium and WOSA Conference: separate products, R2000 each, 80 tickets per event of which 10 are early-bird, with a live honest 'N of 10 early-bird tickets left' scarcity counter per event read from real sales. Brochure/tile layout in NOS branding; copy = one short card per presenter (photo + summary bio supplied by Lee-Ann; visibly flagged pending until supplied, never invented), each card clicking through to that event's ticket booking. Workshops: small exclusive sessions throughout the show, R100 each, 10 tickets per workshop, ticket-only booking; structure built now (Sanity-editable sessions), full schedule to follow from Brad/Lee-Ann. Replaces the provisional CONFERENCE_PRODUCTS estimates (R450-R900, joint bundle) in lib/provisional-figures.ts. Pages under app/(marketing)/national-show/** are the NOS Site lane: post a comms.md notice. Early-bird price not yet given -> pending/flagged, never invented.

## Context

(Add context here)

## Notes

- Goal text above predates Brad's 2026-10-07 rulings (no early bird for Symposium/WOSA; R2000 flat, 80 places). Contracts f1-f6 are authoritative.
- F7 (apply NOS design handoff from saoc-nos-design-f1) is BLOCKED on the external handoff; not registered until a contract exists.


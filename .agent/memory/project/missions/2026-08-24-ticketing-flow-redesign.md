---
schema: athanor.mission/v1
slug: ticketing-flow-redesign
goal: 'Redesign the ticket purchase flow per Brad''s approval of the vertical-card
  prototype, with his changes: (1) vertical ticket-type cards, not horizontal; (2)
  one dedicated buy screen per ticket type instead of a shared cart+buy button; (3)
  merge early-bird and regular into ONE ticket per type — price changes at the cutoff
  date rather than two separate ticket products (supersedes the earlier grey-out-early-bird
  approach); (4) Day Visitor needs a per-day quantity picker, not single-day-only;
  (5) replace placeholder icons with real orchid photos, reusing public/images/orchid-{pink,purple,yellow,violet,dark}.jpg
  already used site-wide; (6) fix VIP price — currently R300, cheaper than the regular
  Weekend Pass (R400); correct VIP price is R480 so VIP stays the top tier. This touches
  the ticketType Sanity schema (F4 fields), checkout data model, and UI — route through
  @architect for a full spec/contract before any implementation, since it changes
  pricing data model (merged early-bird/regular needs a real schema field, not just
  UI toggling).'
created_at: '2026-08-24T18:05:55.961296+00:00'
started_at: '2026-08-24T18:32:16.019448+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M2
  feature: F3
  ts: '2026-08-24T19:36:31.516314+00:00'
features:
- id: F1
  name: Merge early-bird/regular pricing into one ticketType document per product
    via a new regularPrice field, and fix the VIP price bug (R300 -> R480).
  status: done
  milestone: M1
  spec: .agent/memory/project/specs/ticketing-flow-redesign
  contract: .agent/memory/project/specs/ticketing-flow-redesign/contract-f1.yaml
  completed_at: '2026-08-24T18:32:15.395639+00:00'
- id: F2
  name: Vertical ticket-type cards with real orchid photos; one dedicated buy screen
    per Admission ticket type instead of a shared cart with a single buy button.
  status: done
  milestone: M2
  spec: .agent/memory/project/specs/ticketing-flow-redesign
  contract: .agent/memory/project/specs/ticketing-flow-redesign/contract-f2.yaml
  started_at: '2026-08-24T18:32:16.019232+00:00'
  completed_at: '2026-08-24T18:55:42.727151+00:00'
- id: F3
  name: Day Visitor per-day quantity picker — pick ticket counts per show day in one
    screen, on top of F2's dedicated buy screen.
  status: done
  milestone: M2
  spec: .agent/memory/project/specs/ticketing-flow-redesign
  contract: .agent/memory/project/specs/ticketing-flow-redesign/contract-f3.yaml
  started_at: '2026-08-24T18:55:43.327425+00:00'
  completed_at: '2026-08-24T19:36:31.516140+00:00'
milestones:
- id: M1
  name: Pricing model migration (schema, provisional-figures, checkout price resolution,
    VIP fix)
  features:
  - F1
  gate_ran_at: '2026-08-24T18:29:13.450830+00:00'
  gate_result: pass
  status: done
- id: M2
  name: UI redesign — vertical per-type buy screens with real photos (F2), then the
    Day Visitor per-day quantity picker built on top of F2's screen shell (F3)
  features:
  - F2
  - F3
  gate_ran_at: '2026-08-24T19:36:27.404220+00:00'
  gate_result: pass
  status: done
completed_at: '2026-08-24T19:38:10.746847+00:00'
last_active_at: '2026-08-24T19:38:10.747063+00:00'
---











# Mission: Redesign the ticket purchase flow per Brad's approval of the vertical-card prototype, with his changes: (1) vertical ticket-type cards, not horizontal; (2) one dedicated buy screen per ticket type instead of a shared cart+buy button; (3) merge early-bird and regular into ONE ticket per type — price changes at the cutoff date rather than two separate ticket products (supersedes the earlier grey-out-early-bird approach); (4) Day Visitor needs a per-day quantity picker, not single-day-only; (5) replace placeholder icons with real orchid photos, reusing public/images/orchid-{pink,purple,yellow,violet,dark}.jpg already used site-wide; (6) fix VIP price — currently R300, cheaper than the regular Weekend Pass (R400); correct VIP price is R480 so VIP stays the top tier. This touches the ticketType Sanity schema (F4 fields), checkout data model, and UI — route through @architect for a full spec/contract before any implementation, since it changes pricing data model (merged early-bird/regular needs a real schema field, not just UI toggling).

## Context

(Add context here)

## Notes


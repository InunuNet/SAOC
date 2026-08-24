---
schema: athanor.mission/v1
slug: venue-never-changed-copy-fix
goal: Remove all 'venue has changed' / 'previous venue no longer applies' narrative
  from the National Show visitor-info content. The venue never changed — CTICC was
  an incorrect early placeholder that got corrected to the real venue (The Hangar,
  Stellenbosch Flying Club). Rewrite affected content (scripts/seed-show-visitor-info.ts
  and the live Sanity showVisitorInfo doc it seeds) to state the venue plainly, as
  if it was always the Hangar, while preserving genuinely-still-true content (travel/parking/accommodation
  guidance not yet worked out is fine to say, just not framed as a consequence of
  a change). Given this repo's history on this exact topic (contracts/golden/venue-prose-residue/),
  route through @architect for a proper contract before @dev touches it.
created_at: '2026-08-24T11:45:17.724231+00:00'
started_at: null
last_active_at: '2026-08-24T12:16:50.999028+00:00'
status: done
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
  title: Remove the "venue changed" narrative framing from scripts/seed-show-visitor-info.ts,
    its golden copy-source JSON, the live Sanity showVisitorInfo document (via a one-off
    patch script), and the one dev-facing doc quoting it verbatim. Full spec — contracts/golden/venue-never-changed-copy-fix-f1/README.md.
  inline_brief: null
  spec: .agent/memory/project/specs/venue-never-changed-copy-fix
  contract: .agent/memory/project/specs/venue-never-changed-copy-fix/contract-f1.yaml
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-24T12:16:44.018884+00:00'
  gate_result: pass
completed_at: '2026-08-24T12:16:50.998811+00:00'
---



# Mission: Remove all 'venue has changed' / 'previous venue no longer applies' narrative from the National Show visitor-info content. The venue never changed — CTICC was an incorrect early placeholder that got corrected to the real venue (The Hangar, Stellenbosch Flying Club). Rewrite affected content (scripts/seed-show-visitor-info.ts and the live Sanity showVisitorInfo doc it seeds) to state the venue plainly, as if it was always the Hangar, while preserving genuinely-still-true content (travel/parking/accommodation guidance not yet worked out is fine to say, just not framed as a consequence of a change). Given this repo's history on this exact topic (contracts/golden/venue-prose-residue/), route through @architect for a proper contract before @dev touches it.

## Context

(Add context here)

## Notes


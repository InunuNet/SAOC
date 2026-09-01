---
schema: athanor.mission/v1
slug: vendor-stand-early-bird-pricing
goal: 'Add the missing early-bird dimension to vendor stand pricing. lib/vendor-stand-pricing.ts
  currently exposes VENDOR_STAND_PRICE_ZAR as a single price per booth size (1/2/3),
  all null pending the Show Organising Committee, with no early-bird tier and no cutoff
  date anywhere in the stand payment path. Brad confirmed 2026-09-01 that stand fees
  have early-bird and regular tiers, so the model needs a second axis: 3 booth sizes
  x 2 tiers = 6 prices, plus a cutoff instant that decides which tier applies at the
  moment of payment. Build it while every figure is still null - adding the axis after
  real figures land is a data migration rather than a schema decision. Follow the
  proven ticketing pattern (isWithinEarlyBirdWindow / earlyBirdCutoff, F4, docs/f4-admission-products.md)
  rather than inventing a second mechanism. Ships with all six prices null and the
  cutoff null, and refuses at the point a real figure is missing, exactly as M3 does
  today; the tier decision must be server-side and must not be spoofable by a client-supplied
  timestamp. Existing vendorStandOrders documents must remain readable.'
created_at: '2026-09-01T18:13:42.673076+00:00'
started_at: null
last_active_at: '2026-09-01T19:24:33.002588+00:00'
status: done
cost_estimate:
  features: 1
  milestones: 1
  total_calls: 3
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-09-01T19:23:42.709744+00:00'
features:
- id: F1
  title: Two-tier (early-bird/regular) vendor stand pricing, server-derived and spoof-proof
  status: done
  inline_brief: null
  completed_at: '2026-09-01T19:23:42.709359+00:00'
  spec: contracts/contract-vendor-stand-early-bird-pricing.yaml
  contract: contracts/contract-vendor-stand-early-bird-pricing.yaml
milestones:
- id: M1
  title: Two-tier pricing model implemented, RED checks green, QA + Codex passed
  features:
  - F1
  status: done
  gate_ran_at: '2026-09-01T19:24:30.003236+00:00'
  gate_result: pass
completed_at: '2026-09-01T19:24:33.002148+00:00'
---

# Mission: Add the missing early-bird dimension to vendor stand pricing

See `goal` in the frontmatter for the full brief, and
`contracts/golden/vendor-stand-early-bird-pricing/README.md` for the architect's design
record.

## Context

Brad confirmed 2026-09-01 that vendor stand fees have early-bird and regular tiers. This
mission adds that axis to `lib/vendor-stand-pricing.ts` while every figure is still null
(council-blocked, per `vendor-gated-registration-flow` M3), following the ticketing F4/F1
early-bird pattern rather than inventing a new mechanism.

## Notes

- Council still owes: six ZAR figures (3 booth sizes × 2 tiers) and one cutoff date. None
  of these may be invented, estimated, or defaulted.
- `vendor-gated-registration-flow` M3 (F26-F32, checks A55-A63) must stay green throughout —
  this mission is additive to that shipped mechanism, not a rewrite of it.

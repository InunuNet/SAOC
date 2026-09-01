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
  proven ticketing pattern (isWithinEarlyBirdWindow / earlyBirdCutoff, F4,
  docs/f4-admission-products.md) rather than inventing a second mechanism. Ships with
  all six prices null and the cutoff null, and refuses at the point a real figure is
  missing, exactly as M3 does today; the tier decision must be server-side and must
  not be spoofable by a client-supplied timestamp. Existing vendorStandOrders documents
  must remain readable.'
created_at: '2026-09-01T18:13:42.673076+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 1
  milestones: 1
  total_calls: 3
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  title: Two-tier (early-bird/regular) vendor stand pricing, server-derived and spoof-proof
  status: pending
  inline_brief: 'Restructure lib/vendor-stand-pricing.ts: VENDOR_STAND_PRICE_ZAR becomes
    a per-booth-size, per-tier record ({1: {earlyBird: number|null, regular: number|null},
    2: {...}, 3: {...}}, all null today) plus a new VENDOR_STAND_EARLY_BIRD_CUTOFF:
    string|null (also null today, council-blocked same as the prices). resolveVendorStandPrice(boothSize,
    now: Date) becomes a required-now, still-pure function (no internal Date.now()/new
    Date() call) that decides the tier via lib/checkout-reservation.ts''s existing isWithinEarlyBirdWindow(now,
    cutoffIso) - reuse it, do not reimplement cutoff math - then looks up that tier''s
    price; returns {ok:false, reason:''not-configured''} if the SELECTED tier''s figure
    is null, even when the other tier has a real number. On success returns {ok:true,
    amount, tier}. app/api/vendors/stand-payment/initiate/route.ts (already computes
    `now = new Date()` for token verification) passes that SAME now value into resolveVendorStandPrice
    - never a body-derived value - and this is the only change needed for the route to
    stay spoof-proof; the request body allow-list stays exactly {token, boothSize}. types/index.ts''s
    VendorStandOrder gains `tier: VendorStandPricingTier | null` as an ADDITIVE, nullable
    field written by the initiate route; every existing reader (lib/vendor-stand-payment-notification.ts''s
    settlement guards, app/admin/vendors/page.tsx''s status badge) must keep working unmodified
    against a pre-existing vendorStandOrders document that has no tier field at all -
    settlement''s idempotency/amount/cross-gateway checks must never read or require order.tier.
    See contracts/golden/vendor-stand-early-bird-pricing/README.md for the full decision
    record and contracts/contract-vendor-stand-early-bird-pricing.yaml (assertions A1-A4)
    for the RED checks this must turn green. Do not invent a cutoff date or any of the
    six prices - ship every one of them null/absent, refusing exactly as M3 does today.'
milestones:
- id: M1
  title: Two-tier pricing model implemented, RED checks green, QA + Codex passed
  features:
  - F1
  status: pending
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

# p2-restore-the-deferred-legacy-order-che

**[P2] Restore the deferred legacy-order check for stand pricing tiers** (deferred
  2026-09-01 under demo time pressure, by @architect, explicitly flagged rather than dropped).
  `vendor-stand-early-bird-pricing` shipped A1-A4 but cut the standalone RED check proving a
  pre-existing `vendorStandOrders` document with no `tier` key still settles and renders
  identically. The deferral reasoning is sound — stand payment has refused since it shipped
  (prices were null), so no real stand order can exist yet to break — but that stops being true
  the moment the first vendor pays, which is now days away, not months.
  `VendorStandOrder.tier` was still built additive/nullable and the settlement handler was left
  untouched, so the property is believed to hold; it is simply unproven. Write the check before
  any real stand payment settles.

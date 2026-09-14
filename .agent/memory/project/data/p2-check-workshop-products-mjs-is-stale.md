# p2-check-workshop-products-mjs-is-stale

**[P2] `check-workshop-products.mjs` is stale post-F2 (ticketing-complete) — three
  assertions need updating to the new 3-product reality, one genuine pre-existing defect
  needs separate repair.** Ruling written 2026-09-08:
  `.agent/memory/project/specs/ticketing-complete/goldens/f2-README.md` §14. File:
  `contracts/checks/ticketing-workshops-f2/check-workshop-products.mjs` (belongs to the
  earlier, closed `ticketing-conferences-and-events` mission, not `ticketing-complete`).
  Correct-consequence fixes (never revert F2's data to make these pass): update
  `REQUIRED_SLUGS` to drop `field-trip-single`/`field-trip-all-outings` and add `field-trip`;
  update the `length === 4` expectation to `3`; delete the now-permanently-vacuous
  field-trip bundle-relationship check (both slugs it reads are `undefined` post-retirement,
  so its guard silently no-ops rather than failing — dead coverage, not passing coverage).
  Genuine pre-existing defect, unrelated to F2: the "oversell invariant" check
  (`cocktailSingle.capacity * 1 + cocktailCouple.capacity * 2 <= 200`) predates
  `planPooledCapacity()` (shipped later, `ticketing-conferences-and-events` M2/F5) and
  double-counts one shared `capacityPool: 'sunset-cocktails'` ceiling as if it were two
  independent per-slug budgets — it will fail forever regardless of any F2 change. Needs
  rewriting to assert the two products share one pool at the real venue ceiling (200), not a
  sum of two fields. Implementation work for `@dev`, not an architect edit.

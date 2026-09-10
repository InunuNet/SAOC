# p2-ticketing-purchase-pages-f3-check-see

**[P2] `ticketing-purchase-pages-f3/check-seed-category-field.mjs` hardcodes a stale product
  total** (found 2026-09-08 by the F2 dev, mission ticketing-complete). OWNER, corrected: the
  script is run by `.agent/memory/project/specs/ticketing-conferences-and-events/contract-f3-purchase-pages.yaml:209`
  — a DIFFERENT, earlier mission that also numbered a feature F3. It is NOT ticketing-complete's
  contract-f3.yaml, which is clean. Do not confuse the two.
  It asserts `ALL_PRODUCTS.length !== 15`. Already stale at HEAD before any F2 change — HEAD has
  14 real products (counted by listing `slug:` lines, not `grep -c`, which overcounts by matching
  the interface's own `slug: string;` declaration); the working tree now has 13 (4 admission +
  6 conference + 3 workshop-field-trip), with `field-trip-single`/`field-trip-all-outings` retired
  and `field-trip` in their place. Drifted twice in one mission and caught nobody.
  RECOMMENDED FIX (architect, 2026-09-08): drop the count assertion entirely rather than deriving
  it. Nothing downstream needs a count to be true — a count only proves someone remembered to bump
  a literal. What the check actually exists to prove is that `buildTicketTypeDoc` stamps `category`
  onto every product using the real builder. Assert instead: every product's built doc carries a
  `category` matching its own `product.category`; no two products across the three arrays share a
  slug; and `RETIRED_FIELD_TRIP_SLUGS` never appears as a live slug. All three survive any future
  product addition or retirement with no magic number to maintain.
  Same shape as the stale `ticketing-workshops-f2` capacity check.

# p1-ticket-prices-and-capacities-estimate

**[P1] Ticket prices and capacities — estimate now, correct later (Brad's standing
  instruction, already the pattern used for the ticketing admission products in
  `lib/provisional-figures.ts`/F4).** Do not leave figures blank waiting on the council; put in
  our best estimate, flagged provisional, same discipline as F4. Conference tickets (SAOC
  Symposium/WOSA/joint, 6 entries) fully shipped as of 2026-08-21 — data model (F1), purchase
  pages (F3), nav (F4), and checkout (F5) all done; `ticketing-conferences-and-events` (Mission
  Two) is now complete end to end. Workshops/Field Trips/Cocktails category likewise fully
  shipped as of 2026-08-21 (F2 estimation, F5 checkout closes the pooled-capacity fix F2
  deferred) — 4 real priceable products (Sunset Cocktails single/couple, Field Trip
  single/all-outings) now enforce their REAL physical ceilings (200/200/60/60) via
  `planPooledCapacity()`'s pool-key/headcount-weighted math, not the F2 interim's conservative
  resized constants (100/50/30/30). A non-sellable `WORKSHOP_PRICING_STRUCTURE` placeholder
  remains since individual workshop sessions genuinely cannot be priced without a
  council-confirmed session list — do not invent specific workshops. Still outstanding: vendor
  fees (exhibit/food), venue/workshop capacity figures generally, and the real workshop session
  list itself. Her form answers (pricing artifact) are still empty as of 2026-08-21 — do not
  wait for them to start estimating the remaining categories.

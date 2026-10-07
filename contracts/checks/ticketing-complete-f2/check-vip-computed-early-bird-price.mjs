// F2 (ticketing-complete, M1) ORIGINAL — proved Brad's 2026-09-08 VIP ruling (R625 regular,
// 20% early-bird discount, R500 early-bird) was exercised by the real computed-discount
// engine (lib/admission-early-bird-pricing.ts) rather than assumed arithmetic.
//
// SUPERSEDED (conference-workshop-tickets, M1/F2, 2026-10-07) — Brad's ticket news, verbatim,
// message 6 (.agent/memory/scratch/brad-ticket-news-2026-10-07.md) and Lee-Ann's sheet, line
// 19 (.agent/memory/scratch/leeann-notes-2026-10-07.md: "23 VIP Thursday, Opening 3 Hours on
// thursday evening.(R300) 16h00-19h00 Total # 200 total") replace the 2026-09-08 ruling with
// a flat R300 figure and drop the early-bird tier entirely — VIP now carries no
// `regularPrice` and no `earlyBirdCutoff` at all. This check now proves the OPPOSITE
// property it originally did: no purchase date can ever change VIP's price.
//
// WHY resolveEffectivePrice(), NOT resolveComputedEarlyBirdPrice()
// `resolveComputedEarlyBirdPrice()` (lib/admission-early-bird-pricing.ts) is never called by
// any live route in the app (confirmed by `grep -rl resolveComputedEarlyBirdPrice` across
// app/**, lib/**, components/** finding only its own defining file) — it was a correctness
// check on the ARITHMETIC, not the deployed mechanism. The real runtime price-resolution
// function every checkout path actually calls is `resolveEffectivePrice()`
// (lib/checkout-reservation.ts, imported by app/api/tickets/checkout/route.ts). This check
// now exercises THAT function directly, proving VIP's stored shape makes it return the same
// flat price regardless of `now` — the real mechanism, not a stand-in.
//
// NEGATIVE CONTROL: reverting VIP's `earlyBirdCutoff`/`regularPrice` to any non-null value
// must turn this check RED (the probe-dates loop would then find at least one `now` where
// resolveEffectivePrice() returns something other than the flat price).
//
// Run as: npx tsx contracts/checks/ticketing-complete-f2/check-vip-computed-early-bird-price.mjs

import { resolveEffectivePrice } from '../../../lib/checkout-reservation.ts';
import { ADMISSION_PRODUCTS } from '../../../lib/provisional-figures.ts';

const failures = [];

const vip = ADMISSION_PRODUCTS.find((p) => p.slug === 'vip');
if (!vip) {
  console.error('FAIL: check-vip-computed-early-bird-price.mjs');
  console.error("  - no 'vip' entry in ADMISSION_PRODUCTS");
  process.exit(1);
}

if (vip.regularPrice !== undefined && vip.regularPrice !== null) {
  failures.push(`vip.regularPrice is ${JSON.stringify(vip.regularPrice)}, expected null/unset — no early-bird tier`);
}
if (vip.earlyBirdCutoff !== null) {
  failures.push(`vip.earlyBirdCutoff is ${JSON.stringify(vip.earlyBirdCutoff)}, expected null — no date-based mechanism`);
}
if (vip.price !== 300) {
  failures.push(`vip.price is ${JSON.stringify(vip.price)}, expected 300`);
}

// Three purchase dates spanning years either side of the show — including the OLD, now-
// irrelevant 90-day cutoff instant this check used to probe — must all resolve to the SAME
// flat price via the REAL runtime function. Proves no date can ever flip VIP onto a second
// tier, rather than just asserting the stored fields look right.
const PROBE_DATES = [
  new Date('2020-01-01T00:00:00Z'),
  new Date('2027-06-25T00:00:00+02:00'),
  new Date('2030-12-31T00:00:00Z'),
];
for (const now of PROBE_DATES) {
  const resolved = resolveEffectivePrice({
    price: vip.price,
    regularPrice: vip.regularPrice ?? null,
    earlyBirdCutoff: vip.earlyBirdCutoff,
    now,
  });
  if (resolved !== vip.price) {
    failures.push(
      `resolveEffectivePrice() at ${now.toISOString()} returned ${JSON.stringify(resolved)}, expected the flat ` +
        `price ${vip.price} — a purchase date is still able to change VIP's price`
    );
  }
}

// VIP's current figure is an explicit OVERRIDE of the superseded 2026-09-08 ruling, not a
// silent replacement — the citation must still name what it overrides.
if (
  typeof vip.sourceCitation !== 'string' ||
  !/override/i.test(vip.sourceCitation) ||
  !/2026-09-08/.test(vip.sourceCitation)
) {
  failures.push(
    `vip.sourceCitation is ${JSON.stringify(vip.sourceCitation)} — expected it to explicitly name this as an ` +
      'override of the 2026-09-08 ruling'
  );
}

if (failures.length > 0) {
  console.error('FAIL: check-vip-computed-early-bird-price.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  'PASS: VIP carries no regularPrice/earlyBirdCutoff, resolveEffectivePrice() (the real ' +
    'runtime mechanism) returns the flat R300 price for every probed purchase date, and the ' +
    "override of Brad's 2026-09-08 ruling is explicitly cited."
);

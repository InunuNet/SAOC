// A3 — planCapacity() (lib/checkout-reservation.ts, F1 of this contract) must decide
// capacity for the WHOLE cart at once, aggregated per ticket type, not line-item by
// line-item against a static count.
//
// THE DEFECT CLASS THIS TARGETS
// The naive port of the existing single-item gate ("alreadyHeld + 1 > capacity", checked
// once) to N line items is to loop over line items and re-check the SAME soldCounts
// snapshot for each one. That looks correct and passes a smoke test with two DIFFERENT
// ticket types, but oversells the moment a cart requests the SAME type twice: with
// capacity 1 and 0 already sold, two line items of type 'x' each individually pass
// "0 + 1 > 1? no" — approving both and reserving 2 seats against a capacity of 1. This is
// exactly the oversell shape @qa already reproduced once for concurrent buyers
// (contracts/golden/ticketing-hardening/capacity-transaction.golden.md); this check
// reproduces the single-request analogue of the same bug.
//
// Also proves the "all-or-nothing, and name every offending type" requirement from the
// architect brief: when two DIFFERENT types are requested and only one is short, the
// over-capacity result must name ONLY the short type — a defeating mutation that treats
// "any type over capacity" as "reject with no detail, or reject naming every requested
// type" fails this check.
//
// This check imports a function that does not exist on the current tree — it is expected
// to fail with a module-resolution error until @dev adds lib/checkout-reservation.ts's
// aggregateRequestedQuantities()/planCapacity() exports per this contract's F1.
//
// Run as: npx tsx contracts/checks/ticketing-multi-line-item-cart/check-plan-capacity-aggregates.mjs

import { aggregateRequestedQuantities, planCapacity } from '../../../lib/checkout-reservation.ts';

const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}: expected ${e}, got ${a}`);
}

// (1) Same type requested twice must sum to a requested quantity of 2, not 1.
{
  const requested = aggregateRequestedQuantities([
    { ticketType: 'early-bird' },
    { ticketType: 'early-bird' },
  ]);
  check('(1) aggregateRequestedQuantities sums repeated types', requested, { 'early-bird': 2 });
}

// (2) THE CORE DEFECT: capacity 1, one already sold, cart requests the same type twice.
// A per-line-item loop against a static soldCounts snapshot approves both (each
// individually looks like "0 held + 1 requested <= 1 capacity" if quantity is never
// accumulated within the request). The correct, aggregated decision must refuse the
// whole cart.
{
  const result = planCapacity({
    requestedQtyByType: { 'early-bird': 2 },
    soldCountsByType: { 'early-bird': 0 },
    capacityByType: { 'early-bird': 1 },
  });
  if (result.kind !== 'over-capacity') {
    failures.push(
      `(2) CORE DEFECT: requesting 2 seats of a type with capacity 1 and 0 already held must be ` +
        `'over-capacity', got '${result.kind}'. A per-line-item check against a static soldCounts ` +
        `snapshot (never accumulating same-request demand) would wrongly approve this.`
    );
  } else if (!result.ticketTypes.includes('early-bird')) {
    failures.push(`(2) over-capacity result did not name 'early-bird' in ticketTypes: ${JSON.stringify(result.ticketTypes)}`);
  }
}

// (3) Two DIFFERENT types, only one is short by exactly 1: must name ONLY the short type.
{
  const result = planCapacity({
    requestedQtyByType: { 'early-bird': 1, 'day-visitor': 1 },
    soldCountsByType: { 'early-bird': 5, 'day-visitor': 49 },
    capacityByType: { 'early-bird': 10, 'day-visitor': 49 },
  });
  if (result.kind !== 'over-capacity') {
    failures.push(`(3) expected over-capacity (day-visitor is full), got '${result.kind}'.`);
  } else {
    check('(3) only the short type is named', [...result.ticketTypes].sort(), ['day-visitor']);
  }
}

// (4) Fits exactly (requested + already-held == capacity): must be 'ok'.
{
  const result = planCapacity({
    requestedQtyByType: { 'weekend-pass': 3 },
    soldCountsByType: { 'weekend-pass': 47 },
    capacityByType: { 'weekend-pass': 50 },
  });
  check('(4) exact fit is ok', result, { kind: 'ok' });
}

// (5) Negative control: a type NOT referenced by the cart at all must never appear in
// requestedQtyByType and must never cause a false over-capacity, even if that unrelated
// type is itself sold out.
{
  const requested = aggregateRequestedQuantities([{ ticketType: 'vip' }]);
  const result = planCapacity({
    requestedQtyByType: requested,
    soldCountsByType: { vip: 1, 'sold-out-unrelated-type': 999 },
    capacityByType: { vip: 5, 'sold-out-unrelated-type': 10 },
  });
  check('(5) unrelated sold-out type does not leak into the decision', result, { kind: 'ok' });
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: planCapacity() aggregates per-type demand across the whole cart, all-or-nothing.');

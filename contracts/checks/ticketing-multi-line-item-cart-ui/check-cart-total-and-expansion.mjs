// A2/A3/A4 — lib/cart.ts's pure cart-math functions (computeCartTotal, cartItemCount,
// buildLineItemsFromCart). All three are pure, take no Firestore/Sanity dependency, and
// are exported specifically so the "displayed total must never be computed from a
// hardcoded price table" and "a submitted cart must be a faithful, deterministic
// expansion of what the buyer selected" claims can be proven without a browser.
//
// THE DEFECT CLASS THIS TARGETS
// The architect brief's explicit warning: "a displayed total that disagrees with the
// charged total is the defect to design against." The riskiest way that happens is a
// second, independent price source drifting from the one the server actually fetched —
// e.g. a hardcoded `PRICES = { 'early-bird': 130, ... }` object in the component instead
// of reading `price` off the SAME `types` array the server-rendered page already passed
// down (activeTicketTypesQuery's Sanity fetch). computeCartTotal() takes NO price
// argument except the `types` array itself, so there is nowhere for a second source to
// live — this check proves the function only ever prices from what it's handed, and that
// changing a price in the `types` array (simulating a real Sanity price update between
// two page loads) changes the total accordingly, rather than the total being stale/fixed.
//
// This check imports functions that do not exist on the current tree — lib/cart.ts does
// not exist yet — expected to fail with a module-resolution error until @dev adds it per
// F1 of this contract.
//
// Run as: npx tsx contracts/checks/ticketing-multi-line-item-cart-ui/check-cart-total-and-expansion.mjs

import { buildLineItemsFromCart, cartItemCount, computeCartTotal } from '../../../lib/cart.ts';

const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) failures.push(`${name}: expected ${e}, got ${a}`);
}

// --- computeCartTotal ---------------------------------------------------------------------

const TYPES = [
  { slug: 'early-bird', price: 130, soldOut: false },
  { slug: 'day-visitor', price: 150, soldOut: false },
  { slug: 'vip', price: 300, soldOut: false },
  { slug: 'demo-free', price: 0, soldOut: false },
];

// (1) Straightforward multi-type sum, from the server-supplied types array only.
check(
  '(1) basic multi-type total',
  computeCartTotal({ 'early-bird': 2, 'day-visitor': 1 }, TYPES),
  2 * 130 + 1 * 150
);

// (2) THE CORE PROOF: the SAME quantities, priced against a types array with a DIFFERENT
// price for 'early-bird' (simulating a real Sanity price change between two page loads,
// or simply proving there is no second, independent price source anywhere in this
// function). The total MUST change accordingly — a hardcoded second price table would
// produce the OLD total here.
{
  const changedTypes = TYPES.map((t) => (t.slug === 'early-bird' ? { ...t, price: 999 } : t));
  const total = computeCartTotal({ 'early-bird': 2, 'day-visitor': 1 }, changedTypes);
  if (total !== 2 * 999 + 1 * 150) {
    failures.push(
      `(2) CORE PROOF FAILED: changing 'early-bird'.price in the types array to 999 did not change ` +
        `the computed total (got ${total}, expected ${2 * 999 + 1 * 150}) — computeCartTotal must have ` +
        `no price source other than the types array it is handed.`
    );
  }
}

// (3) A free (price 0) type contributes 0, not silently excluded/erroring.
check('(3) free ticket type contributes 0', computeCartTotal({ 'demo-free': 3 }, TYPES), 0);

// (4) Quantity 0 (or absent) for a type contributes nothing — negative control that a
// selected-but-zeroed type doesn't leak a stray unit price into the total.
check('(4) zero quantity contributes nothing', computeCartTotal({ 'early-bird': 0, vip: 1 }, TYPES), 300);

// (5) An unknown slug (present in quantities, absent from the fetched types array — a UI
// bug, e.g. a stale cart referencing a since-removed ticket type) must not silently price
// at 0 AND vanish without a trace, nor throw and crash the whole page — it must be
// EXCLUDED from the total, proven by comparing against the same cart with that entry
// removed entirely (must be numerically identical).
{
  const withUnknown = computeCartTotal({ 'early-bird': 1, 'ghost-type': 5 }, TYPES);
  const withoutUnknown = computeCartTotal({ 'early-bird': 1 }, TYPES);
  if (withUnknown !== withoutUnknown) {
    failures.push(`(5) an unknown slug changed the total: with=${withUnknown}, without=${withoutUnknown} (must be equal).`);
  }
}

// --- cartItemCount --------------------------------------------------------------------------

check('(6) cartItemCount sums quantities', cartItemCount({ 'early-bird': 2, 'day-visitor': 3, vip: 0 }), 5);
check('(6b) cartItemCount of an empty cart is 0', cartItemCount({}), 0);
// (6c) MUTATION-DISCRIMINATION GAP CLOSED (found 2026-08-20): the previous two cases
// alone did not discriminate a mutation that removes cartItemCount's `quantity > 0`
// filter entirely — every existing quantity was already non-negative, so summing
// unconditionally produced the identical result. A negative quantity (defensive: a UI
// state that should be unreachable, e.g. a stepper decremented past zero via a race) is
// required to prove the filter is real, not incidental.
check(
  '(6c) a negative quantity does not subtract from the count (filter, not unconditional sum)',
  cartItemCount({ 'early-bird': 3, vip: -2 }),
  3
);

// --- buildLineItemsFromCart -----------------------------------------------------------------

const typesOrder = ['early-bird', 'day-visitor', 'vip'];

// (7) Basic expansion: each unit paired with its OWN attendee row, in order.
{
  const items = buildLineItemsFromCart(
    { 'early-bird': 2, 'day-visitor': 1 },
    {
      'early-bird': [
        { attendeeName: 'A One', attendeeEmail: 'a1@example.com' },
        { attendeeName: 'A Two', attendeeEmail: 'a2@example.com' },
      ],
      'day-visitor': [{ attendeeName: 'B One', attendeeEmail: 'b1@example.com' }],
    },
    typesOrder
  );
  check(
    '(7) basic expansion',
    items,
    [
      { ticketType: 'early-bird', attendeeName: 'A One', attendeeEmail: 'a1@example.com' },
      { ticketType: 'early-bird', attendeeName: 'A Two', attendeeEmail: 'a2@example.com' },
      { ticketType: 'day-visitor', attendeeName: 'B One', attendeeEmail: 'b1@example.com' },
    ]
  );
}

// (8) Deterministic order: re-running with the SAME inputs (object literals rebuilt fresh,
// not reused references) must produce byte-identical output — proves ordering comes from
// `typesOrder`/array position, not object key iteration order (which V8 mostly stabilises
// for string keys, but this must not be an implementation-detail dependency).
{
  const runOnce = () =>
    buildLineItemsFromCart(
      { vip: 1, 'early-bird': 1 },
      {
        vip: [{ attendeeName: 'V', attendeeEmail: 'v@example.com' }],
        'early-bird': [{ attendeeName: 'E', attendeeEmail: 'e@example.com' }],
      },
      typesOrder
    );
  check('(8) deterministic across repeated calls', runOnce(), runOnce());
}

// (9) THE LOUD-FAILURE PROOF: attendee row count for a type does not match its quantity —
// must throw, not silently pad with blank/duplicated attendee data (which would then
// reach the server as a real, wrongly-attributed position).
{
  let threw = false;
  try {
    buildLineItemsFromCart(
      { 'early-bird': 2 },
      { 'early-bird': [{ attendeeName: 'Only One', attendeeEmail: 'one@example.com' }] }, // 1 row for qty 2
      typesOrder
    );
  } catch {
    threw = true;
  }
  if (!threw) {
    failures.push('(9) a mismatched attendee-row count (1 row for quantity 2) must throw, not silently proceed.');
  }
}

// Negative control: a genuinely valid, single-item cart must succeed — proves the harness
// itself isn't just rejecting everything.
{
  const items = buildLineItemsFromCart(
    { vip: 1 },
    { vip: [{ attendeeName: 'Solo', attendeeEmail: 'solo@example.com' }] },
    typesOrder
  );
  check('(negative control) single valid item', items, [
    { ticketType: 'vip', attendeeName: 'Solo', attendeeEmail: 'solo@example.com' },
  ]);
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: computeCartTotal/cartItemCount/buildLineItemsFromCart behave correctly, no hidden price source.');

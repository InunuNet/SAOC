// A5 — parseLineItems() (app/api/tickets/checkout/route.ts, F1) must be a PURE request
// validator: it takes no Firestore/Sanity dependency, rejects an empty cart, rejects a
// cart above MAX_LINE_ITEMS (20 — a resource-exhaustion ceiling, NOT the council's 5-
// ticket-per-booking business rule, which is explicitly deferred to Stage 4 per the
// architect brief and this contract's README), and rejects the WHOLE request if ANY
// single line item is malformed — never silently drops the bad item and proceeds with
// the rest.
//
// WHY "NO EXTERNAL DEPENDENCY" IS PART OF WHAT THIS PROVES
// The cap exists to stop a single POST from holding capacity against, or opening
// positions for, an unbounded number of ticket types in one call — a resource-
// exhaustion vector independent of any business limit. That protection is worthless if
// the length check runs only AFTER a Sanity fetch or inside the Firestore transaction:
// the abuse cost has already been paid by the time the check fires. This function is
// exported specifically so it can be called and asserted against with ZERO network
// dependency — see case (5) below, which calls it with no `db`/`client` argument at all
// and would throw immediately if the function secretly reached for one.
//
// This check imports a function that does not exist on the current tree (route.ts has no
// exported parseLineItems today — validation is inline and single-item-shaped) — expected
// to fail with a module-resolution error until @dev adds it per F1.
//
// Run as: npx tsx contracts/checks/ticketing-multi-line-item-cart/check-parse-line-items-cap.mjs

import { MAX_LINE_ITEMS, parseLineItems } from '../../../app/api/tickets/checkout/route.ts';

const failures = [];

function validItem(n) {
  return { ticketType: 'early-bird', attendeeName: `Attendee ${n}`, attendeeEmail: `attendee${n}@example.com` };
}

if (MAX_LINE_ITEMS !== 20) {
  failures.push(
    `MAX_LINE_ITEMS is ${MAX_LINE_ITEMS}, expected 20 per the architect brief's pinned ceiling. If this ` +
      `was deliberately changed, the contract and this check must be updated together, not silently drifted.`
  );
}

// (1) Empty array: rejected.
if (parseLineItems([]) !== null) {
  failures.push('(1) an empty lineItems array must be rejected (null), not accepted as a zero-item order.');
}

// (2) Not an array at all.
if (parseLineItems('not-an-array') !== null) {
  failures.push('(2) a non-array lineItems value must be rejected.');
}
if (parseLineItems(undefined) !== null) {
  failures.push('(2b) a missing lineItems field must be rejected.');
}

// (3) Exactly at the cap: accepted.
{
  const items = Array.from({ length: MAX_LINE_ITEMS }, (_, i) => validItem(i));
  const result = parseLineItems(items);
  if (result === null || result.length !== MAX_LINE_ITEMS) {
    failures.push(`(3) exactly ${MAX_LINE_ITEMS} valid items must be accepted; got ${JSON.stringify(result)}`);
  }
}

// (4) One over the cap: rejected outright (not silently truncated to the cap).
{
  const items = Array.from({ length: MAX_LINE_ITEMS + 1 }, (_, i) => validItem(i));
  if (parseLineItems(items) !== null) {
    failures.push(
      `(4) ${MAX_LINE_ITEMS + 1} items (one over the cap) must be rejected outright, not silently truncated.`
    );
  }
}

// (5) THE ZERO-DEPENDENCY PROOF: called with a valid 3-item cart and nothing else in
// scope — no db, no client, no network. If this call throws or hangs, the validator is
// not actually pure and the cap cannot be trusted to run before external calls.
{
  const items = [validItem(1), validItem(2), validItem(3)];
  let result;
  let threw = false;
  try {
    result = parseLineItems(items);
  } catch {
    threw = true;
  }
  if (threw || result === null || result.length !== 3) {
    failures.push('(5) parseLineItems must succeed synchronously with zero external dependencies for a valid cart.');
  }
}

// (6) ANY single malformed item rejects the WHOLE request — a bad email in item 2 of 3
// must not silently drop item 2 and proceed with items 1 and 3.
{
  const items = [validItem(1), { ticketType: 'day-visitor', attendeeName: 'Bad Email', attendeeEmail: 'not-an-email' }, validItem(3)];
  if (parseLineItems(items) !== null) {
    failures.push('(6) a single malformed line item must reject the WHOLE cart, not be silently dropped.');
  }
}

// (7) Same, for a blank attendeeName mid-cart.
{
  const items = [validItem(1), { ticketType: 'day-visitor', attendeeName: '   ', attendeeEmail: 'ok@example.com' }];
  if (parseLineItems(items) !== null) {
    failures.push('(7) a blank attendeeName anywhere in the cart must reject the WHOLE cart.');
  }
}

// Negative control: the harness itself can detect acceptance — prove with an obviously
// valid single-item cart.
{
  const result = parseLineItems([validItem(1)]);
  if (result === null || result.length !== 1) {
    failures.push('(negative control) a single valid item must be accepted — if this fails, the harness itself is broken.');
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: parseLineItems() enforces the cap and per-item validity, with zero external dependencies.');

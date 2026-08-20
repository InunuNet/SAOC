// A4 — effectiveCapacity() (lib/checkout-reservation.ts, F4 of this contract) must take the
// TIGHTER of capacity/releasedQuantity, and must treat 0 as a real, usable releasedQuantity —
// never fall back to capacity via a `releasedQuantity || capacity` style falsy check.
//
// THE DEFECT CLASS THIS TARGETS
// `releasedQuantity: 0` is a legitimate state (schema note: "an early-bird pool that hasn't
// opened yet"). The laziest-looking correct implementation, `releasedQuantity || capacity`,
// silently treats 0 as "unset" (0 is falsy in JS) and returns the FULL physical capacity instead
// of the real answer, zero — reopening every seat this project's culture explicitly forbids
// ("treat every capacity as a ceiling to be lowered, never raised", provisional-figures.md). This
// is the same class of bug this codebase has already hardened against once: isUsableAmount()'s own
// header comment explains why `Number("50")` coercion looked fine and reproduced a real oversell.
//
// This check imports a function that does not exist on the current tree — expected to fail with
// a module-resolution error until @dev adds lib/checkout-reservation.ts's effectiveCapacity()
// export per this contract's brief.
//
// Run as: npx tsx contracts/checks/ticketing-f4-admission-products/check-effective-capacity.mjs

import { effectiveCapacity } from '../../../lib/checkout-reservation.ts';

const failures = [];

function check(name, actual, expected) {
  if (actual !== expected) {
    failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// (1) releasedQuantity strictly tighter than capacity -> use releasedQuantity.
check('(1) releasedQuantity tighter than capacity', effectiveCapacity(400, 150), 150);

// (2) releasedQuantity null -> falls back to capacity (non-early-bird products).
check('(2) null releasedQuantity falls back to capacity', effectiveCapacity(800, null), 800);

// (3) releasedQuantity undefined -> falls back to capacity (same as null).
check('(3) undefined releasedQuantity falls back to capacity', effectiveCapacity(120, undefined), 120);

// (4) CORE DEFECT: releasedQuantity is 0 -> must return 0, NEVER fall back to capacity. A
// `releasedQuantity || capacity` implementation returns `capacity` here because 0 is falsy.
check('(4) CORE DEFECT: releasedQuantity 0 is real, not "unset"', effectiveCapacity(400, 0), 0);

// (5) Misconfiguration: releasedQuantity GREATER than capacity must never raise the ceiling
// above the physical capacity — capacity always wins as the outer bound.
check('(5) releasedQuantity above capacity is capped at capacity', effectiveCapacity(100, 999), 100);

// (6) Equal values -> either number, same result.
check('(6) equal capacity and releasedQuantity', effectiveCapacity(300, 300), 300);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} failure(s).\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('PASS: effectiveCapacity() takes the tighter bound and treats 0 as a real value.');

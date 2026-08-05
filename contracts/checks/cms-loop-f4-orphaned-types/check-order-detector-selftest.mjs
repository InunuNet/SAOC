#!/usr/bin/env node
// F4 (cms-loop-and-wiring): A4 — fast, network-free negative/positive self-test of
// _order-detect.mjs's position-comparison logic, run BEFORE
// check-award-order-reaches-site.mjs (A2) is trusted against the real live page. This
// is the "prove the detector isn't rigged" step for a detector too complex for a
// plain substring match (F6/F2's negative control pattern doesn't directly apply to
// "is this code LAST", so this exercises the actual comparison logic against
// synthetic HTML instead of the live host).
//
// Four cases, all must behave correctly for a PASS:
//   1. AM/SAOC first in a full 6-code sequence -> isRenderedFirst(AM) true.
//   2. Same sequence -> isRenderedLast(AM) false (AM is first, not last).
//   3. AM/SAOC moved to the end of the same 6 codes -> isRenderedLast(AM) true.
//   4. A code missing from the HTML entirely -> both isRenderedFirst/isRenderedLast
//      return false (fail closed), never a false positive from an incomplete render.
//
// Run as: node contracts/checks/cms-loop-f4-orphaned-types/check-order-detector-selftest.mjs
// Exit codes: 0 = all four cases behave correctly. 1 = detector logic is broken.

import { isRenderedFirst, isRenderedLast, renderedOrder } from './_order-detect.mjs';
import { CURATED_AWARD_CODES } from './_award-target.mjs';

let failures = 0;
function check(label, actual, expected) {
  const pass = actual === expected;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: got ${actual}, expected ${expected}`);
  if (!pass) failures += 1;
}

// Synthetic HTML fragments — deliberately NOT the real page, so this test has zero
// network dependency and can never be affected by the live site's current state.
const curatedHtml = CURATED_AWARD_CODES.map((c) => `<p>${c}</p>`).join('');
const amLastHtml = CURATED_AWARD_CODES.filter((c) => c !== 'AM/SAOC')
  .concat('AM/SAOC')
  .map((c) => `<p>${c}</p>`)
  .join('');
const incompleteHtml = CURATED_AWARD_CODES.slice(1) // AM/SAOC deliberately omitted
  .map((c) => `<p>${c}</p>`)
  .join('');

console.log('Case 1+2: curated order (AM/SAOC first)');
check('isRenderedFirst(AM/SAOC)', isRenderedFirst(curatedHtml, 'AM/SAOC', CURATED_AWARD_CODES), true);
check('isRenderedLast(AM/SAOC)', isRenderedLast(curatedHtml, 'AM/SAOC', CURATED_AWARD_CODES), false);
check('renderedOrder matches CURATED_AWARD_CODES exactly', JSON.stringify(renderedOrder(curatedHtml, CURATED_AWARD_CODES)) === JSON.stringify(CURATED_AWARD_CODES), true);

console.log('Case 3: AM/SAOC moved to the end');
check('isRenderedLast(AM/SAOC)', isRenderedLast(amLastHtml, 'AM/SAOC', CURATED_AWARD_CODES), true);
check('isRenderedFirst(AM/SAOC)', isRenderedFirst(amLastHtml, 'AM/SAOC', CURATED_AWARD_CODES), false);

console.log('Case 4: AM/SAOC missing entirely (fail closed, no false positive)');
check('isRenderedFirst(AM/SAOC) on incomplete HTML', isRenderedFirst(incompleteHtml, 'AM/SAOC', CURATED_AWARD_CODES), false);
check('isRenderedLast(AM/SAOC) on incomplete HTML', isRenderedLast(incompleteHtml, 'AM/SAOC', CURATED_AWARD_CODES), false);

if (failures > 0) {
  console.error(`FAIL: ${failures} self-test case(s) failed — the order-detection logic itself is broken; do not trust A2's result.`);
  process.exit(1);
}
console.log('PASS: order-detection logic behaves correctly on all synthetic cases.');
process.exit(0);

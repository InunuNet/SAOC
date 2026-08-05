#!/usr/bin/env node
// F4 (cms-loop-and-wiring): A3 — fast, read-only, non-mutating negative control on
// the substring-detection mechanism for the /judging page, mirroring F6/F2's
// check-detects-absence.mjs. A never-written nonce must be reported absent — proves
// A1's "found" branch is reachable and meaningful, not hardcoded true.
//
// Run as: node contracts/checks/cms-loop-f4-orphaned-types/check-detects-absence.mjs
// Exit codes: 0 = nonce correctly reported absent. 1 = host unreachable, or (should
// never happen) the nonce is somehow found.

import { fetchPublicPageContains } from '../f6-prove-cms-loop/_shared.mjs';
import { AWARD_PAGE_PATH } from './_award-target.mjs';

const neverWrittenNonce = `F4-AWARD-NEGATIVE-CONTROL-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
console.log(`Checking that a never-written value is correctly reported absent: ${neverWrittenNonce}`);

const result = await fetchPublicPageContains(neverWrittenNonce, AWARD_PAGE_PATH);
console.log(`GET ${AWARD_PAGE_PATH} -> status ${result.status}, hasNeedle: ${result.hasNeedle}`);

if (result.status !== 200) {
  console.error(`FAIL: expected 200 from ${AWARD_PAGE_PATH}, got ${result.status}`);
  process.exit(1);
}
if (result.hasNeedle) {
  console.error('FAIL: a value that was never written anywhere was reported as present — the detection mechanism is broken (always-true).');
  process.exit(1);
}
console.log('PASS: detection mechanism correctly reports absence for content that was never published.');
process.exit(0);

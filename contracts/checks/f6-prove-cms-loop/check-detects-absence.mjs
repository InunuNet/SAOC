#!/usr/bin/env node
// F6 (cms-activation-deploy): fast, read-only, non-mutating negative control on the
// DETECTION MECHANISM itself (fetchPublicPageContains), separate from the slow, real
// round-trip in check-studio-edit-reaches-site.mjs. Generates a value that has
// certainly never been written anywhere (a fresh random nonce) and confirms the live
// public page genuinely does NOT contain it. Exists so the "sentinel found" result in
// the main check can be trusted as a real positive, not a detector that always reports
// true — this proves the negative branch is reachable and correct on every run of the
// gate, cheaply, without touching the Studio or the dataset.
//
// Run as: node contracts/checks/f6-prove-cms-loop/check-detects-absence.mjs
// Exit codes: 0 = the never-written nonce is correctly reported absent. 1 = the host
// is unreachable, or (should never happen) the nonce is somehow found.

import { fetchPublicPageContains, TARGET_PAGE_PATH } from './_shared.mjs';

const neverWrittenNonce = `F6-NEGATIVE-CONTROL-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
console.log(`Checking that a never-written value is correctly reported absent: ${neverWrittenNonce}`);

const result = await fetchPublicPageContains(neverWrittenNonce);
console.log(`GET ${TARGET_PAGE_PATH} -> status ${result.status}, hasNeedle: ${result.hasNeedle}`);

if (result.status !== 200) {
  console.error(`FAIL: expected 200 from ${TARGET_PAGE_PATH}, got ${result.status}`);
  process.exit(1);
}

if (result.hasNeedle) {
  console.error('FAIL: a value that was never written anywhere was reported as present — the detection mechanism is broken (always-true).');
  process.exit(1);
}

console.log('PASS: detection mechanism correctly reports absence for content that was never published.');
process.exit(0);

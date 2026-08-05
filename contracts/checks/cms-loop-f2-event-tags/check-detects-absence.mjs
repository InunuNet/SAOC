#!/usr/bin/env node
// F2 (cms-loop-and-wiring): fast, read-only, non-mutating negative control on the
// DETECTION MECHANISM itself, for the /events/[slug] target — mirrors F6's
// check-detects-absence.mjs exactly, retargeted at the event page. Generates a value
// that has certainly never been written anywhere (a fresh random nonce) and confirms
// the live public event page genuinely does NOT contain it. Exists so a "sentinel
// found" result in check-studio-edit-reaches-site.mjs can be trusted as a real
// positive, not a detector that always reports true.
//
// Run as: node contracts/checks/cms-loop-f2-event-tags/check-detects-absence.mjs
// Exit codes: 0 = the never-written nonce is correctly reported absent. 1 = the host
// is unreachable, or (should never happen) the nonce is somehow found.

import { fetchPublicPageContains } from '../f6-prove-cms-loop/_shared.mjs';
import { TARGET_EVENT_PAGE_PATH } from './_event-target.mjs';

const neverWrittenNonce = `F2-EVENT-NEGATIVE-CONTROL-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
console.log(`Checking that a never-written value is correctly reported absent: ${neverWrittenNonce}`);

const result = await fetchPublicPageContains(neverWrittenNonce, TARGET_EVENT_PAGE_PATH);
console.log(`GET ${TARGET_EVENT_PAGE_PATH} -> status ${result.status}, hasNeedle: ${result.hasNeedle}`);

if (result.status !== 200) {
  console.error(`FAIL: expected 200 from ${TARGET_EVENT_PAGE_PATH}, got ${result.status}`);
  process.exit(1);
}

if (result.hasNeedle) {
  console.error('FAIL: a value that was never written anywhere was reported as present — the detection mechanism is broken (always-true).');
  process.exit(1);
}

console.log('PASS: detection mechanism correctly reports absence for content that was never published.');
process.exit(0);

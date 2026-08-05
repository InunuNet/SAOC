#!/usr/bin/env node
// cms-loop-f3-national-show A4: negative control (mandatory per dispatch brief),
// same pattern as F6's A2 — proves the substring-match detection mechanism used by
// A1/A2/A3 is not vacuously true by asserting a freshly-generated nonce that was
// NEVER written anywhere is correctly reported ABSENT from both the deployed
// /national-show page and the deployed home page. Read-only, non-mutating, safe to
// run at any time.
//
// Exit codes: 0 = the nonce is genuinely absent from both pages. 1 = the nonce was
// found (detector is broken/rigged) or a host is unreachable — never a skip.

import { fetchPublicPageContains, TARGET_PAGE_PATH, HOME_PAGE_PATH } from './_shared.mjs';

const nonce = `F3-NEGATIVE-CONTROL-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
console.log(`Checking that a never-written value is correctly reported absent: ${nonce}`);

const nationalShow = await fetchPublicPageContains(nonce, TARGET_PAGE_PATH);
const home = await fetchPublicPageContains(nonce, HOME_PAGE_PATH);
console.log(`${TARGET_PAGE_PATH} -> status ${nationalShow.status}, hasNeedle: ${nationalShow.hasNeedle}`);
console.log(`${HOME_PAGE_PATH} -> status ${home.status}, hasNeedle: ${home.hasNeedle}`);

if (nationalShow.status === 200 && !nationalShow.hasNeedle && home.status === 200 && !home.hasNeedle) {
  console.log('PASS: detection mechanism correctly reports absence for content that was never published, on both pages.');
  process.exit(0);
}
console.error('FAIL: a value that was never written anywhere was reported present — the detection mechanism cannot be trusted.');
process.exit(1);

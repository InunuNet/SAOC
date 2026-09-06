#!/usr/bin/env node
// /refunds must not restate — or contradict — the vendor stand booking's own,
// already council-written cancellation clause (mission refunds-cancellation-terms, F1).
//
// docs/vendor-gated-registration-flow.md:435,668 records TWO numbers for the SAME vendor
// clause that disagree with each other: a verbal "2 months" and a written, binding "90
// days" (the written figure governs and is what the vendor registration form displays).
// The general ticket-refund page must scope itself to ticket products and must not
// restate either number — doing so risks publishing a THIRD, unauthorised figure against
// a council-approved document, or re-surfacing the already-resolved internal conflict.
//
// Two things must both be true:
//   1. Neither "90 days" nor "2 months" (nor "two months") appears anywhere on the page.
//   2. The page acknowledges vendor stand bookings exist and are out of its scope —
//      pointing the reader elsewhere — rather than silently saying nothing about them
//      (silence here would itself be a gap: a vendor reading the general refunds page
//      should not conclude ticket terms apply to their stand booking).
//
// Usage: node check-refunds-vendor-scope.mjs <url>

const url = process.argv[2];
if (!url) {
  console.error('usage: check-refunds-vendor-scope.mjs <url>');
  process.exit(2);
}

const res = await fetch(url);
if (res.status !== 200) {
  console.error(`FAIL: ${url} did not return HTTP 200 (got ${res.status})`);
  process.exit(1);
}
const html = await res.text();
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

let failed = false;

const FORBIDDEN_VENDOR_FIGURE = /90[\s ]*days|two[\s ]+months|2[\s ]*months/i;
const forbidden = text.match(FORBIDDEN_VENDOR_FIGURE);
if (forbidden) {
  console.error(
    `FAIL: page restates a vendor-stand-specific figure ("${forbidden[0]}") that belongs ` +
    `only to the vendor registration terms, not the general ticket refund page`
  );
  failed = true;
}

const VENDOR_SCOPE_MARKER = /vendor[^.]{0,120}(stand|booth|registration)[^.]{0,200}(own|separate|its own)[^.]{0,120}(terms|agreement|registration)/i;
if (!VENDOR_SCOPE_MARKER.test(text)) {
  console.error(
    'FAIL: page does not acknowledge that vendor stand bookings are out of scope and ' +
    'governed by their own separate terms'
  );
  failed = true;
}

if (!failed) {
  console.log(`OK: ${url} — scoped to tickets, does not restate vendor stand terms`);
}
process.exit(failed ? 1 : 0);

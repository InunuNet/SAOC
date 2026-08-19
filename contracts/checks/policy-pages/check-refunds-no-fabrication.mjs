#!/usr/bin/env node
// Property check for /refunds: proves the page is structurally a real
// refund/cancellation policy (has recognisable sections) WITHOUT
// fabricating specific windows, percentages, or amounts the council has
// not yet supplied — while still being honest that this is pending,
// not silently absent.
//
// Two things must both be true:
//   1. No concrete refund-window/amount claim appears anywhere in the
//      page text: a digit directly paired with a day/hour/week/percent
//      unit (e.g. "14 days", "50%", "72 hours") — these are exactly the
//      kind of number this feature is forbidden from inventing.
//   2. A plain-language marker is present saying the specific terms are
//      still to be confirmed by the council — so the gap is disclosed,
//      not hidden by omission.
//
// What this does NOT prove: that no fabricated fact of any other shape
// slipped in (e.g. a written-out number "fourteen days" would not match
// the digit-based pattern below) — it is a targeted regression guard
// for the numeric-fabrication failure mode named in the brief, not a
// general truthfulness check.
//
// Usage: node check-refunds-no-fabrication.mjs <url>

const url = process.argv[2];
if (!url) {
  console.error('usage: check-refunds-no-fabrication.mjs <url>');
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

const FABRICATION_PATTERN = /\b\d+\s*(?:day|days|hour|hours|week|weeks|%|percent)\b/i;
const fabricated = text.match(FABRICATION_PATTERN);
if (fabricated) {
  console.error(`FAIL: page contains a concrete unconfirmed figure: "${fabricated[0]}"`);
  failed = true;
}

const PENDING_MARKER = /(council|committee).{0,60}(has not|to be confirmed|not yet (?:been )?(?:confirmed|finalised|finalized|set|decided))|(?:to be confirmed|not yet (?:been )?(?:confirmed|finalised|finalized)).{0,60}(council|committee)/i;
if (!PENDING_MARKER.test(text)) {
  console.error('FAIL: no plain-language disclosure that specific refund terms are pending council confirmation');
  failed = true;
}

const SECTION_MARKERS = [/refund/i, /cancellation/i];
for (const re of SECTION_MARKERS) {
  if (!re.test(text)) {
    console.error(`FAIL: page missing expected section topic matching ${re}`);
    failed = true;
  }
}

if (!failed) {
  console.log(`OK: ${url} is structurally complete and free of fabricated figures`);
}
process.exit(failed ? 1 : 0);

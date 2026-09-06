#!/usr/bin/env node
// Cross-page consistency guard (mission refunds-cancellation-terms, F1).
//
// app/(marketing)/terms/page.tsx:83-85 already cross-links to /refunds ("Refunds and
// cancellations for ticket purchases are governed by our Refund & Cancellation Policy").
// This feature must not (a) break that link while touching adjacent pages, or (b)
// introduce a SECOND, independently-maintained refund figure on /terms that could drift
// from /refunds over time — /terms carries none today (verified by direct read), and it
// must still carry none after this feature ships; /refunds remains the single source.
//
// Usage: node check-refunds-terms-consistency.mjs <terms-url> <refunds-url>

const [termsUrl, refundsUrl] = process.argv.slice(2);
if (!termsUrl || !refundsUrl) {
  console.error('usage: check-refunds-terms-consistency.mjs <terms-url> <refunds-url>');
  process.exit(2);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (res.status !== 200) {
    throw new Error(`${url} did not return HTTP 200 (got ${res.status})`);
  }
  const html = await res.text();
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

let failed = false;
let termsText;
let refundsText;

try {
  termsText = await fetchText(termsUrl);
  refundsText = await fetchText(refundsUrl);
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
}

if (!/refund/i.test(termsText) || !/\/refunds/i.test(termsText)) {
  console.error('FAIL: /terms no longer links to /refunds (Refund & Cancellation Policy cross-link missing)');
  failed = true;
}

const FIGURE_PATTERN = /\b\d+\s*(?:day|days|hour|hours|week|weeks|%|percent)\b/i;
if (FIGURE_PATTERN.test(termsText)) {
  console.error(
    'FAIL: /terms now states its own digit+unit refund/cancellation figure — /refunds ' +
    'must remain the single source of truth for these numbers'
  );
  failed = true;
}

if (!/refund/i.test(refundsText) || !/cancellation/i.test(refundsText)) {
  console.error('FAIL: /refunds no longer contains recognisable refund/cancellation topics');
  failed = true;
}

if (!failed) {
  console.log(`OK: ${termsUrl} still links to ${refundsUrl}; no duplicated figures`);
}
process.exit(failed ? 1 : 0);

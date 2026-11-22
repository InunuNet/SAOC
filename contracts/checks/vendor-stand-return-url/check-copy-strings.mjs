#!/usr/bin/env node
// Every new user-facing string F4 introduces must be present, verbatim, in the file the golden
// copy-strings.json assigns it to (whitespace collapsed), so the list Brad reviews IS the shipped
// copy. Also bans promotional wording in the new page. Cannot prove no OTHER string was added;
// diff review covers that.
//
// Run as: node contracts/checks/vendor-stand-return-url/check-copy-strings.mjs

import { existsSync, readFileSync } from 'node:fs';

const golden = JSON.parse(readFileSync(new URL('../../../.agent/memory/project/specs/vendor-flow-fixes/goldens/f4/copy-strings.json', import.meta.url), 'utf8'));
const collapse = (s) => s.replace(/\s+/g, ' ');
const failures = [];
const cache = new Map();

// The golden (written before the NOS site split, commit 774029a3) names the page under
// app/(marketing)/national-show/; the split moved every national-show page to app/(nos)/. The
// golden stays untouched, so its path prefix is mapped here.
const GOLDEN_PAGE_PREFIX = 'app/(marketing)/national-show/';
const MOVED_PAGE_PREFIX = 'app/(nos)/national-show/';
const resolveGoldenFile = (file) => (file.startsWith(GOLDEN_PAGE_PREFIX) ? MOVED_PAGE_PREFIX + file.slice(GOLDEN_PAGE_PREFIX.length) : file);

// Golden strings that were deliberately reworded after F4 shipped. Each maps the golden text to
// the exact text now in the page, with the commit that changed it. Any golden string not listed
// here is still required verbatim.
const REWORDED_SINCE_GOLDEN = new Map([
  // The golden string was the page title / share-image text 'Vendor Stand Payment Status'.
  // 9d16cf96 (page titles follow their h1) dropped " Status" from the metadata title; 29c50aad
  // (sentence case) then made it 'Vendor stand payment', matching the hero title. The metadata
  // title string itself only exists in its current form since 29c50aad.
  ['Vendor Stand Payment Status — National Show', "title: 'Vendor stand payment',"],
  // 091b8ce5 (F17 naming sweep): "SAOC National Show" became "National Orchid Show".
  ['Payment status for your 2027 SAOC National Show vendor stand.', 'Payment status for your 2027 National Orchid Show vendor stand.'],
  ['Your stand payment for the SAOC National Show has been received.', 'Your stand payment for the National Orchid Show has been received.'],
  // 29c50aad (sentence case on NOS headings and titles).
  ['title="Vendor Stand Payment"', 'title="Vendor stand payment"'],
]);

for (const { file: goldenFile, text: goldenText } of golden.strings) {
  const file = resolveGoldenFile(goldenFile);
  const text = REWORDED_SINCE_GOLDEN.get(goldenText) ?? goldenText;
  if (!existsSync(file)) { failures.push(`missing file for string "${text}": ${file}`); continue; }
  if (!cache.has(file)) cache.set(file, collapse(readFileSync(file, 'utf8')));
  if (!cache.get(file).includes(collapse(text))) failures.push(`${file} does not contain: "${text}"`);
}
const PAGE = 'app/(nos)/national-show/vendors/payment/status/page.tsx';
if (existsSync(PAGE) && /!{2,}|\bamazing\b|\bexciting\b|\bawesome\b|\bwelcome\b|\bsorry\b|\boops\b/i.test(readFileSync(PAGE, 'utf8'))) {
  failures.push(`${PAGE} contains promotional/invented wording.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log(`PASS: all ${golden.strings.length} new copy strings are present verbatim.`);

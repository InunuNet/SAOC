#!/usr/bin/env node
// Every new user-facing string F2 introduces must be present, verbatim, in the file the golden
// copy-strings.json assigns it to (whitespace collapsed so JSX line-wraps do not matter), so
// the list Brad reviews IS the shipped copy. Also bans invented marketing words in the new
// files' text. It cannot prove no OTHER string was added; the diff review covers that.
//
// Run as: node contracts/checks/vendor-photo-resume/check-copy-strings.mjs

import { existsSync, readFileSync } from 'node:fs';

const golden = JSON.parse(
  readFileSync(new URL('../../../.agent/memory/project/specs/vendor-flow-fixes/goldens/f2/copy-strings.json', import.meta.url), 'utf8'),
);
const collapse = (s) => s.replace(/\s+/g, ' ');
const failures = [];
const cache = new Map();

for (const { file, text } of golden.strings) {
  if (!existsSync(file)) { failures.push(`missing file for string "${text}": ${file}`); continue; }
  if (!cache.has(file)) cache.set(file, collapse(readFileSync(file, 'utf8')));
  if (!cache.get(file).includes(collapse(text))) failures.push(`${file} does not contain: "${text}"`);
}

for (const file of ['app/(marketing)/national-show/vendors/photos/page.tsx', 'components/admin/VendorPhotoLinkControl.tsx']) {
  if (!existsSync(file)) continue;
  const src = readFileSync(file, 'utf8');
  if (/!{2,}|\bamazing\b|\bexciting\b|\bawesome\b|\bwelcome\b/i.test(src)) failures.push(`${file} contains promotional/invented wording.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log(`PASS: all ${golden.strings.length} new copy strings are present verbatim.`);

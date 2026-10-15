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

for (const { file, text } of golden.strings) {
  if (!existsSync(file)) { failures.push(`missing file for string "${text}": ${file}`); continue; }
  if (!cache.has(file)) cache.set(file, collapse(readFileSync(file, 'utf8')));
  if (!cache.get(file).includes(collapse(text))) failures.push(`${file} does not contain: "${text}"`);
}
const PAGE = 'app/(marketing)/national-show/vendors/payment/status/page.tsx';
if (existsSync(PAGE) && /!{2,}|\bamazing\b|\bexciting\b|\bawesome\b|\bwelcome\b|\bsorry\b|\boops\b/i.test(readFileSync(PAGE, 'utf8'))) {
  failures.push(`${PAGE} contains promotional/invented wording.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}
console.log(`PASS: all ${golden.strings.length} new copy strings are present verbatim.`);

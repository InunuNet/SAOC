#!/usr/bin/env node
// F17 follow-up (vendor-gated-registration-flow, M2) -- proves the tables/chairs charge
// disclosure is a real, rendered property, not merely absent-of-a-rand-figure (A31's own
// scope). @qa found tableCount/chairCount shipped with no copy telling a vendor a charge
// applies at all; @dev fixed it by adding, in components/vendors/VendorBoothPositionFieldset.tsx
// (the tableCount/chairCount fields were extracted out of VendorBoothFieldset.tsx -- see that
// file's own top-of-file comment -- so A31's grep of VendorBoothFieldset.tsx alone cannot see
// this copy either), a <p> reading "A charge applies for tables and chairs; the rate is to be
// confirmed by the Show Organising Committee." A31 cannot prove this exists: it only scans for
// the ABSENCE of an invented rand figure in a different file, so the disclosure could be
// deleted entirely and every existing check would stay green.
//
// This check proves BOTH halves of the real property, scoped to
// VendorBoothPositionFieldset.tsx (wherever the tableCount/chairCount inputs actually render):
// (1) the disclosure copy is PRESENT as rendered JSX content -- comments are stripped first,
// so text living only in a source comment does not count; (2) no rand figure ("R" followed by
// digits) appears in any JSX text content or string literal that mentions "table" or "chair" --
// the same technique A31 uses, run against the real rendering file this time.
//
// FAILS ON: the disclosure copy missing or present only inside a comment, or a rand figure
// (e.g. "R50 per table") appearing anywhere in rendered table/chair copy.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m2/check-table-chair-charge-disclosure.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TARGET_PATH = path.join(ROOT, 'components/vendors/VendorBoothPositionFieldset.tsx');

const failures = [];

let source;
try {
  source = readFileSync(TARGET_PATH, 'utf8');
} catch (err) {
  failures.push(`SETUP FAILURE: could not read ${TARGET_PATH} -- ${err.message}`);
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  process.exit(1);
}

// Strip comments (block and line) so anything living only in a comment -- e.g. a future dev
// "temporarily" commenting the disclosure out while leaving an explanatory comment behind that
// happens to reuse similar words -- cannot satisfy the presence check below.
const codeOnly = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

const normalize = (s) => s.replace(/\s+/g, ' ').trim();
const normalizedCode = normalize(codeOnly);

// --- (1) the disclosure copy is present, as rendered code, not just a comment. ---
const DISCLOSURE_PATTERN =
  /a charge applies for tables and chairs[;,]? the rate is to be confirmed by the show organising committee/i;
if (!DISCLOSURE_PATTERN.test(normalizedCode)) {
  failures.push(
    'the tables/chairs charge disclosure ("A charge applies for tables and chairs; the rate ' +
      'is to be confirmed by the Show Organising Committee.") is missing from rendered JSX in ' +
      `${path.relative(ROOT, TARGET_PATH)} (comments were stripped before this check ran, so a ` +
      'copy living only in a comment does not count).',
  );
}

// --- (2) no invented rand figure adjacent to "table"/"chair" copy, checked against BOTH
// quoted string literals (label="..."/placeholder="...") AND raw JSX text content (the
// disclosure itself is plain JSX children text, not a quoted attribute, so A31's
// quoted-literal-only scan would miss an injected figure placed the same way). ---
const CURRENCY_FIGURE_PATTERN = /R\s?\d/;

const quotedLiterals = Array.from(codeOnly.matchAll(/"([^"\n]{3,300})"/g), (m) => m[1]);
const jsxTextNodes = Array.from(codeOnly.matchAll(/>([^<>{}]{3,500})</g), (m) => normalize(m[1]));

for (const text of [...quotedLiterals, ...jsxTextNodes]) {
  if (!text) continue;
  if (/table|chair/i.test(text) && CURRENCY_FIGURE_PATTERN.test(text)) {
    failures.push(
      `a digit-only currency figure appears in table/chair copy: "${text}" -- the rate is ` +
        'council-blocked (M2 golden README) and must never be invented in the UI.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the tables/chairs charge disclosure is present as rendered JSX content in ' +
    'VendorBoothPositionFieldset.tsx, and no invented rand figure appears near table/chair copy.',
);
process.exit(0);

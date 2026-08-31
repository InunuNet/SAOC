#!/usr/bin/env node
// F13/F15 (vendor-gated-registration-flow, M2) — A28: every field listed in the M2 golden's
// removed-field ledger is still present in the VendorSubmission interface body in
// types/index.ts (deprecate-in-place, never delete). This is a regression guard runnable
// TODAY, independent of whether F15's own UI/validation deprecation work has landed yet --
// every one of these fields already existed pre-M2 (F15 only stops REQUIRING/RENDERING them,
// it never adds or removes them), so this check is meaningful right now and stays meaningful
// after F15 ships.
//
// FAILS ON: any ledger field missing from the VendorSubmission interface body.
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m2/check-deprecated-fields-present.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const ledgerPath = path.join(ROOT, 'contracts/golden/vendor-gated-registration-flow-m2/removed-field-ledger.expected.md');
const ledgerText = readFileSync(ledgerPath, 'utf8');

// Ledger entries are markdown bullet lines of the form: - `fieldName` (optional trailing prose)
const fields = Array.from(ledgerText.matchAll(/^- `([A-Za-z0-9]+)`/gm), (m) => m[1]);

if (fields.length === 0) {
  console.error('FAIL: no fields parsed out of the removed-field ledger -- ledger format changed?');
  process.exit(1);
}

const typesSource = readFileSync(path.join(ROOT, 'types/index.ts'), 'utf8');

const startIdx = typesSource.indexOf('export interface VendorSubmission');
if (startIdx === -1) {
  console.error('FAIL: "export interface VendorSubmission" not found in types/index.ts.');
  process.exit(1);
}
const closeIdx = typesSource.indexOf('\n}', startIdx);
const interfaceBody = typesSource.slice(startIdx, closeIdx === -1 ? undefined : closeIdx);

const failures = [];
for (const field of fields) {
  const fieldPattern = new RegExp(`^\\s*${field}[?:]`, 'm');
  if (!fieldPattern.test(interfaceBody)) {
    failures.push(`ledger field "${field}" is missing from the VendorSubmission interface body.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(`PASS: all ${fields.length} removed-field-ledger fields are present in the VendorSubmission interface.`);
process.exit(0);

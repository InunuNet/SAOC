#!/usr/bin/env node
// F7 (vendor-registration) -- A12: no-PII-in-logs proof for BOTH new routes, extending F6's
// check-no-pii-in-logs.mjs discipline (contracts/checks/vendor-f6-review-workflow/
// check-no-pii-in-logs.mjs). A structural source check (not behavioural).
//
// Run as: node contracts/checks/vendor-f7-payment-path/check-no-pii-in-logs.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const PII_IDENTIFIERS = [
  'submissions',
  'snapshot',
  'docs',
  'businessName',
  'contactEmail',
  'contactPersonName',
  'contactCellPhone',
  'physicalAddress',
  'cipcNumber',
  'vatNumber',
  'fileBase64',
];

const TARGETS = [
  path.join(REPO_ROOT, 'app/api/admin/vendors/[id]/payment/route.ts'),
  path.join(REPO_ROOT, 'app/api/vendors/[id]/proof-of-payment/route.ts'),
];

const failures = [];

for (const target of TARGETS) {
  let source;
  try {
    source = readFileSync(target, 'utf8');
  } catch (error) {
    failures.push(`Could not read ${target}: ${error.message}`);
    continue;
  }

  if (/console\.log\(/.test(source)) {
    failures.push(`(1) ${target} contains a console.log call -- remove it, or replace with console.error if it is a genuine failure path.`);
  }

  const consoleCallPattern = /console\.(log|warn|error|info)\(([^;]*?)\)\s*;/gs;
  let match;
  while ((match = consoleCallPattern.exec(source)) !== null) {
    const argsWithoutStringLiterals = match[2]
      .replace(/`(?:[^`\\]|\\.)*`/gs, '')
      .replace(/'(?:[^'\\]|\\.)*'/gs, '')
      .replace(/"(?:[^"\\]|\\.)*"/gs, '');
    for (const identifier of PII_IDENTIFIERS) {
      const identifierPattern = new RegExp(`\\b${identifier}\\b`);
      if (identifierPattern.test(argsWithoutStringLiterals)) {
        failures.push(
          `(2) ${target}: a console.${match[1]}(...) call references '${identifier}' as a real expression -- ` +
            'a caught error must log a generic message and error.message only, never a submitted business/contact ' +
            'field or the raw uploaded file payload.',
        );
      }
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: neither app/api/admin/vendors/[id]/payment/route.ts nor ' +
    'app/api/vendors/[id]/proof-of-payment/route.ts contains a console.log call, and no ' +
    'console.* call in either file references a submitted business/contact field or the raw ' +
    'uploaded file payload.',
);
process.exit(0);

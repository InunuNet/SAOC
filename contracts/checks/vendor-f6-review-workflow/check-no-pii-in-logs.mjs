#!/usr/bin/env node
// F6 (vendor-registration) — A10: no-PII-in-logs proof for the vendor submissions list route.
// A structural source check (not behavioural — no live logging call to intercept without a
// running server and a triggered Firestore failure), mirroring the "no console.* call
// anywhere in this file's body" discipline lib/vendor-registration-confirmation.ts already
// carries (vendor-f5-register-route's A2/README).
//
// Run as: node contracts/checks/vendor-f6-review-workflow/check-no-pii-in-logs.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(__dirname, '../../../app/api/admin/vendors/route.ts');

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
];

const failures = [];

let source;
try {
  source = readFileSync(TARGET, 'utf8');
} catch (error) {
  failures.push(`Could not read ${TARGET}: ${error.message}`);
}

if (source !== undefined) {
  // (1) No console.log at all in this route — any logging here should be error-level only.
  if (/console\.log\(/.test(source)) {
    failures.push('(1) app/api/admin/vendors/route.ts contains a console.log call — remove it, or replace with console.error if it is a genuine failure path.');
  }

  // (2) Every console.* call's argument list must not reference any PII-bearing identifier
  // as a real expression -- string-literal message text (e.g. "...vendor submissions...")
  // is stripped first, so an English sentence mentioning "submissions" doesn't false-positive
  // against an actual `submissions`/`snapshot`/`docs` variable reference.
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
          `(2) A console.${match[1]}(...) call references '${identifier}' as a real expression — a caught ` +
            'error must log a generic message and error.message only, never the submissions array, a ' +
            'Firestore snapshot/docs identifier, or any submitted business/contact field.',
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
  'PASS: app/api/admin/vendors/route.ts contains no console.log call, and no console.* call ' +
    'references the submissions array, a Firestore snapshot/docs identifier, or any submitted ' +
    'business/contact field.',
);
process.exit(0);

#!/usr/bin/env node
// F8 (vendor-registration) — A7: no-PII-in-logs proof, extending F6's own
// check-no-pii-in-logs.mjs discipline (contracts/checks/vendor-f6-review-workflow/
// check-no-pii-in-logs.mjs) to F8's new email module and the review route's new call site.
// A structural source check (not behavioural).
//
// Run as: node contracts/checks/vendor-f8-approval-email/check-no-pii-in-logs.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const failures = [];

// (1) lib/vendor-approval-confirmation.ts must contain ZERO console.* calls of any kind —
// same absolute rule F5's lib/vendor-registration-confirmation.ts already follows.
{
  const target = path.join(REPO_ROOT, 'lib/vendor-approval-confirmation.ts');
  let source;
  try {
    source = readFileSync(target, 'utf8');
  } catch (error) {
    failures.push(`Could not read ${target}: ${error.message}`);
    source = null;
  }
  if (source !== null && /console\.\w+\(/.test(source)) {
    failures.push(`${target} contains a console.* call — this module must contain none at all (PII-bearing fields).`);
  }
}

// (2) The review route's onError callback for the F8 email call must log only a generic
// message plus error.message — never a submitted business/contact/logistics field.
{
  const target = path.join(REPO_ROOT, 'app/api/admin/vendors/[id]/review/route.ts');
  let source;
  try {
    source = readFileSync(target, 'utf8');
  } catch (error) {
    failures.push(`Could not read ${target}: ${error.message}`);
    source = null;
  }

  if (source !== null) {
    const piiIdentifiers = [
      'businessName',
      'contactEmail',
      'contactPersonName',
      'boothNumber',
      'boothType',
      'staffPerDay',
      'waterRequired',
      'loadInSlot',
      'loadOutSlot',
      'data',
    ];

    const consoleCallPattern = /console\.(log|warn|error|info)\(([^;]*?)\)\s*;/gs;
    let match;
    while ((match = consoleCallPattern.exec(source)) !== null) {
      const argsWithoutStringLiterals = match[2]
        .replace(/`(?:[^`\\]|\\.)*`/gs, '')
        .replace(/'(?:[^'\\]|\\.)*'/gs, '')
        .replace(/"(?:[^"\\]|\\.)*"/gs, '');
      for (const identifier of piiIdentifiers) {
        const identifierPattern = new RegExp(`\\b${identifier}\\b`);
        if (identifierPattern.test(argsWithoutStringLiterals)) {
          failures.push(
            `${target}: a console.${match[1]}(...) call references '${identifier}' as a real expression — ` +
              'a caught email-send error must log a generic message and error.message only.',
          );
        }
      }
    }

    if (/console\.log\(/.test(source)) {
      failures.push(`${target} contains a console.log call — use console.error for a genuine failure path.`);
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: lib/vendor-approval-confirmation.ts contains zero console.* calls, and ' +
    "app/api/admin/vendors/[id]/review/route.ts's F8 email-failure handler logs only a generic " +
    'message plus error.message — never a submitted business/contact/logistics field.',
);
process.exit(0);

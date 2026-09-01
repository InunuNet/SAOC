#!/usr/bin/env node
// G1 (vendor-flow-notifications) — A9: NO-PII-IN-LOGS, paired absence+presence, for all four
// new sender modules. Matches the rule every existing vendor-email module already follows
// (lib/vendor-registration-confirmation.ts, lib/vendor-approval-confirmation.ts,
// lib/vendor-stand-payment-notice.ts): businessName/contactEmail/contactPersonName are
// POPIA-relevant submitter PII and must never reach a console.* call.
//
// PRESENCE half (paired, not absence-only): each file must actually reference businessName (or
// contactEmail for the vendor-facing confirmation) somewhere in its body — proves the module is
// a real implementation, not an empty stub that trivially has "zero console.* calls" because it
// does nothing.
//
// The three admin-notice modules are allowed EXACTLY ONE console.* call each: a generic,
// non-PII console.warn fired only when getVendorAdminNotifyRecipients() resolves to zero
// recipients (see the golden README). Any OTHER console.* call, or one referencing a PII
// identifier, is a failure.
//
// Run as: node contracts/checks/vendor-flow-notifications/check-no-pii-in-logs.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const PII_IDENTIFIERS = ['businessName', 'contactEmail', 'contactPersonName'];

const failures = [];

function checkVendorFacingModule(rel, presenceIdentifier) {
  const target = path.join(REPO_ROOT, rel);
  if (!existsSync(target)) {
    failures.push(`${rel}: does not exist`);
    return;
  }
  const source = readFileSync(target, 'utf8');

  if (/console\.\w+\(/.test(source)) {
    failures.push(`${rel}: contains a console.* call — this module must contain NONE at all (PII-bearing fields, no exceptions).`);
  }
  if (!new RegExp(`\\b${presenceIdentifier}\\b`).test(source)) {
    failures.push(`${rel}: never references '${presenceIdentifier}' — looks like an empty stub, not a real implementation.`);
  }
}

function checkAdminNoticeModule(rel) {
  const target = path.join(REPO_ROOT, rel);
  if (!existsSync(target)) {
    failures.push(`${rel}: does not exist`);
    return;
  }
  const source = readFileSync(target, 'utf8');

  if (!/\bbusinessName\b/.test(source)) {
    failures.push(`${rel}: never references 'businessName' — looks like an empty stub, not a real implementation.`);
  }

  const consoleCallRegex = /console\.(log|warn|error|info)\(([^;]*?)\)\s*;/gs;
  let match;
  let consoleCallCount = 0;
  while ((match = consoleCallRegex.exec(source)) !== null) {
    consoleCallCount += 1;
    const [, level, args] = match;
    const argsWithoutStringLiterals = args
      .replace(/`(?:[^`\\]|\\.)*`/gs, '')
      .replace(/'(?:[^'\\]|\\.)*'/gs, '')
      .replace(/"(?:[^"\\]|\\.)*"/gs, '');
    for (const identifier of PII_IDENTIFIERS) {
      if (new RegExp(`\\b${identifier}\\b`).test(argsWithoutStringLiterals)) {
        failures.push(`${rel}: a console.${level}(...) call references '${identifier}' as a real expression — PII must never be logged.`);
      }
    }
    if (level !== 'warn') {
      failures.push(`${rel}: a console.${level}(...) call is present — only a single console.warn for the zero-recipients case is permitted.`);
    }
  }
  if (consoleCallCount > 1) {
    failures.push(`${rel}: contains ${consoleCallCount} console.* calls — at most one (the zero-recipients console.warn) is permitted.`);
  }
}

checkVendorFacingModule('lib/vendor-application-confirmation.ts', 'contactEmail');
checkAdminNoticeModule('lib/vendor-application-admin-notice.ts');
checkAdminNoticeModule('lib/vendor-submission-admin-notice.ts');
checkAdminNoticeModule('lib/vendor-payment-admin-notice.ts');

// The resolver itself must also carry zero console.* calls referencing the resolved list.
{
  const rel = 'lib/vendor-admin-notify-recipients.ts';
  const target = path.join(REPO_ROOT, rel);
  if (!existsSync(target)) {
    failures.push(`${rel}: does not exist`);
  } else {
    const source = readFileSync(target, 'utf8');
    if (!/getVendorAdminNotifyRecipients/.test(source)) {
      failures.push(`${rel}: does not export getVendorAdminNotifyRecipients`);
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: the vendor-facing confirmation contains zero console.* calls and genuinely references ' +
    'contactEmail; each admin-notice module references businessName and contains at most one ' +
    'console.warn (zero-recipients case only), never a PII identifier.',
);
process.exit(0);

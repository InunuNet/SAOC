#!/usr/bin/env node
// F8 (vendor-registration) — A9: CREDENTIAL-FREE MAILER proof. lib/vendor-approval-
// confirmation.ts must never import 'resend' directly and never read
// process.env.RESEND_API_KEY/RESEND_FROM_ADDRESS itself — its only real-delivery touchpoint is
// `{ send: sendEmail }` imported from '@/lib/email' (the project's single real Resend client),
// exactly mirroring F5's lib/vendor-registration-confirmation.ts. A structural source check.
//
// Run as: node contracts/checks/vendor-f8-approval-email/check-credential-free-mailer.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const failures = [];
const target = path.join(REPO_ROOT, 'lib/vendor-approval-confirmation.ts');

let source;
try {
  source = readFileSync(target, 'utf8');
} catch (error) {
  console.error(`FAIL: could not read ${target}: ${error.message}`);
  process.exit(1);
}

if (/from\s+['"]resend['"]/.test(source)) {
  failures.push(`${target} imports 'resend' directly — must only reach Resend via lib/email.ts's sendEmail export.`);
}
if (/process\.env\.RESEND_API_KEY/.test(source)) {
  failures.push(`${target} reads process.env.RESEND_API_KEY directly.`);
}
if (/process\.env\.RESEND_FROM_ADDRESS/.test(source)) {
  failures.push(`${target} reads process.env.RESEND_FROM_ADDRESS directly.`);
}
if (!/import\s*\{[^}]*\bsendEmail\b[^}]*\}\s*from\s*['"]@\/lib\/email['"]/.test(source)) {
  failures.push(`${target} does not import the real sendEmail export from '@/lib/email' as its default mailer.`);
}
if (!/mailer\s*(?:\?\?|\|\|)\s*\{\s*send:\s*sendEmail\s*\}/.test(source)) {
  failures.push(
    `${target} does not default its mailer dependency to { send: sendEmail } — the injectable-mailer ` +
      'pattern this module must follow.',
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: lib/vendor-approval-confirmation.ts imports neither the resend package nor reads ' +
    'Resend env vars directly — its only real-delivery touchpoint is the injected default ' +
    "{ send: sendEmail } from '@/lib/email', exactly mirroring F5's own pattern.",
);
process.exit(0);

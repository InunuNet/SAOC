#!/usr/bin/env node
// F8 (vendor-registration) -- A11: F7 regression gate. Re-runs F7's own real check scripts
// (check-f6-regression.mjs, which itself re-runs F6's full suite, and
// check-admin-payment-route-wiring.mjs) completely unchanged, proving F8 -- which touches only
// app/api/admin/vendors/[id]/review/route.ts, never app/api/admin/vendors/[id]/payment/
// route.ts or lib/vendor-payment.ts -- leaves F7's booth-allocation/payment path fully intact.
//
// This is a thin runner, not a re-implementation: it shells out to the exact same F7 scripts
// this contract must not fork or duplicate logic from.
//
// Run as: node contracts/checks/vendor-f8-approval-email/check-f7-regression.mjs

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const F7_CHECKS = [
  {
    label: 'check-f6-regression.mjs',
    cmd: 'node',
    args: [path.join(REPO_ROOT, 'contracts/checks/vendor-f7-payment-path/check-f6-regression.mjs')],
  },
  {
    label: 'check-admin-payment-route-wiring.mjs',
    cmd: 'node',
    args: [
      '--import',
      'tsx/esm',
      path.join(REPO_ROOT, 'contracts/checks/vendor-f7-payment-path/check-admin-payment-route-wiring.mjs'),
    ],
  },
];

const failures = [];

for (const check of F7_CHECKS) {
  try {
    execFileSync(check.cmd, check.args, { cwd: REPO_ROOT, stdio: 'pipe' });
  } catch (error) {
    const output = [error.stdout?.toString(), error.stderr?.toString()].filter(Boolean).join('\n');
    failures.push(`${check.label} FAILED after F8's changes:\n${output}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} F7 check(s) regressed.`);
  process.exit(1);
}

console.log(
  "PASS: F7's own F6-regression suite and its admin-payment-route-wiring discriminator both " +
    "still pass, unchanged, after F8's review-route edit -- F8 did not touch the payment route " +
    'or lib/vendor-payment.ts, and this proves it.',
);
process.exit(0);

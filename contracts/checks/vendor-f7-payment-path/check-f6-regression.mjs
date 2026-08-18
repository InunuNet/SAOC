#!/usr/bin/env node
// F7 (vendor-registration) -- A9: F6 regression gate. Re-runs F6's own real check scripts
// completely unchanged, proving F7's additive VendorSubmission fields (proofOfPaymentPath,
// proofOfPaymentUploadedAt, boothNumber, paymentReceived, paymentConfirmedBy,
// paymentConfirmedAt) do not silently alter F6's closed status-transition machine, its
// additive-only patch shape, or its zero-authorization carry-through. Mirrors F6's own A4
// (re-running F3's checks unchanged) exactly, one level up the chain.
//
// This is a thin runner, not a re-implementation: it shells out to the exact same F6 scripts
// this contract must not fork or duplicate logic from.
//
// Run as: node contracts/checks/vendor-f7-payment-path/check-f6-regression.mjs

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const F6_CHECKS = [
  {
    label: 'check-closed-transition-machine.mjs',
    cmd: 'node',
    args: [
      '--import',
      'tsx/esm',
      path.join(REPO_ROOT, 'contracts/checks/vendor-f6-review-workflow/check-closed-transition-machine.mjs'),
    ],
  },
  {
    label: 'check-additive-patch-injected-time.mjs',
    cmd: 'node',
    args: [
      '--import',
      'tsx/esm',
      path.join(REPO_ROOT, 'contracts/checks/vendor-f6-review-workflow/check-additive-patch-injected-time.mjs'),
    ],
  },
  {
    label: 'check-zero-authorization-carrythrough.mjs',
    cmd: 'node',
    args: [
      '--import',
      'tsx/esm',
      path.join(REPO_ROOT, 'contracts/checks/vendor-f6-review-workflow/check-zero-authorization-carrythrough.mjs'),
    ],
  },
  {
    label: 'check-no-pii-in-logs.mjs',
    cmd: 'node',
    args: [path.join(REPO_ROOT, 'contracts/checks/vendor-f6-review-workflow/check-no-pii-in-logs.mjs')],
  },
];

const failures = [];

for (const check of F6_CHECKS) {
  try {
    execFileSync(check.cmd, check.args, { cwd: REPO_ROOT, stdio: 'pipe' });
  } catch (error) {
    const output = [error.stdout?.toString(), error.stderr?.toString()].filter(Boolean).join('\n');
    failures.push(`${check.label} FAILED after F7's additive changes:\n${output}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} F6 check(s) regressed.`);
  process.exit(1);
}

console.log(
  "PASS: F6's closed-transition-machine, additive-patch/injected-time, " +
    'zero-authorization-carrythrough, and no-PII-in-logs checks all still pass, unchanged, ' +
    "after F7's additive VendorSubmission payment fields exist.",
);
process.exit(0);

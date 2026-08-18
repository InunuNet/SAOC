#!/usr/bin/env node
// F8 (vendor-registration) -- A10: F6 regression gate. Re-runs F6's own real check scripts
// completely unchanged, proving F8's edit to app/api/admin/vendors/[id]/review/route.ts does
// not alter F6's closed status-transition machine, its additive-only patch shape, its
// capability-gate wiring, or its zero-authorization carry-through. Mirrors F7's own
// check-f6-regression.mjs exactly, one level up the chain.
//
// This is a thin runner, not a re-implementation: it shells out to the exact same F6 scripts
// this contract must not fork or duplicate logic from.
//
// Run as: node contracts/checks/vendor-f8-approval-email/check-f6-regression.mjs

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
    label: 'check-route-wiring.mjs',
    cmd: 'node',
    args: [
      '--import',
      'tsx/esm',
      path.join(REPO_ROOT, 'contracts/checks/vendor-f6-review-workflow/check-route-wiring.mjs'),
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
    failures.push(`${check.label} FAILED after F8's changes:\n${output}`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} F6 check(s) regressed.`);
  process.exit(1);
}

console.log(
  "PASS: F6's closed-transition-machine, additive-patch/injected-time, " +
    'zero-authorization-carrythrough, route-wiring, and no-PII-in-logs checks all still pass, ' +
    "unchanged, after F8's edit to the review route adds the approval-email side effect.",
);
process.exit(0);

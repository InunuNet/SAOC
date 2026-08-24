// ozow-sandbox-toggle F1 — proves 'manage-payment-settings' is added to CAPABILITIES (so owner
// inherits it via the file's own documented derivation, `new Set(CAPABILITIES)`) but is NOT
// added to manager's hand-listed capability set. manager is Lee-Ann's day-of-show role; a
// payment-test-mode toggle is owner-tier, same risk class as issue-refund (see
// lib/admin-roles.ts's own comment on why manager is hand-listed and owner is derived).
//
// See contracts/golden/ozow-sandbox-toggle-f1/README.md §4.
//
// Run as: node contracts/checks/ozow-sandbox-toggle-f1/check-capability-owner-only.mjs

import { readFileSync } from 'node:fs';

const src = readFileSync('lib/admin-roles.ts', 'utf8');

let FAIL = false;
function fail(msg) {
  console.error(`FAIL: ${msg}`);
  FAIL = true;
}

const capabilitiesBlockMatch = src.match(/export const CAPABILITIES = \[([\s\S]*?)\] as const;/);
if (!capabilitiesBlockMatch) {
  fail('could not locate the CAPABILITIES array in lib/admin-roles.ts');
} else if (!/['"]manage-payment-settings['"]/.test(capabilitiesBlockMatch[1])) {
  fail("'manage-payment-settings' is not present in the CAPABILITIES array");
}

const managerBlockMatch = src.match(/manager:\s*new Set\(\[([\s\S]*?)\]\)/);
if (!managerBlockMatch) {
  fail('could not locate the hand-listed manager: new Set([...]) block');
} else if (/['"]manage-payment-settings['"]/.test(managerBlockMatch[1])) {
  fail("'manage-payment-settings' must NOT be hand-listed in manager's capability set — owner-only");
}

// owner must still be the derived form, not a hand-listed literal that could go stale.
if (!/owner:\s*new Set\(CAPABILITIES\)/.test(src)) {
  fail("owner's capability set is no longer `new Set(CAPABILITIES)` — the derivation this feature relies on to grant it the new capability automatically was changed");
}

if (FAIL) {
  process.exit(1);
}
console.log("PASS: 'manage-payment-settings' is owner-only (derived), never hand-listed for manager.");

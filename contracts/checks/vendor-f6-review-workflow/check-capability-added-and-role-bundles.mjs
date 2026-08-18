#!/usr/bin/env node
// F6 (vendor-registration) — A3: behavioural proof (real resolve() calls, never a source-grep)
// that 'review-vendor-applications' lands exactly where the mission brief specifies: manager
// and owner hold it, door-staff does not. Mirrors ticketing-f3's
// check-door-staff-negative-control.mjs pattern — checked against ALL eight capabilities
// individually per role, not just the new one, so a mutation that widens door-staff's bundle
// elsewhere is also caught.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f6-review-workflow/check-capability-added-and-role-bundles.mjs

import { CAPABILITIES, resolve } from '../../../lib/admin-roles.ts';

const failures = [];
const NEW_CAPABILITY = 'review-vendor-applications';

// (1) CAPABILITIES has exactly 8 members, the new one last, per F6's spec.
if (CAPABILITIES.length !== 8) {
  failures.push(`(1) CAPABILITIES has ${CAPABILITIES.length} members, expected exactly 8.`);
}
if (CAPABILITIES[CAPABILITIES.length - 1] !== NEW_CAPABILITY) {
  failures.push(
    `(1) CAPABILITIES' last member is '${CAPABILITIES[CAPABILITIES.length - 1]}', expected '${NEW_CAPABILITY}'.`,
  );
}
if (!CAPABILITIES.includes(NEW_CAPABILITY)) {
  failures.push(`(1) CAPABILITIES does not include '${NEW_CAPABILITY}' at all.`);
}

// (2) manager holds it.
{
  const managerCaps = resolve(['manager']);
  if (!managerCaps.has(NEW_CAPABILITY)) {
    failures.push(`(2) resolve(['manager']) does not include '${NEW_CAPABILITY}'.`);
  }
}

// (3) owner holds it (owner is derived from the full CAPABILITIES set, so this should follow
// automatically — a failure here means owner's derivation broke).
{
  const ownerCaps = resolve(['owner']);
  if (!ownerCaps.has(NEW_CAPABILITY)) {
    failures.push(`(3) resolve(['owner']) does not include '${NEW_CAPABILITY}'.`);
  }
}

// (4) THE critical negative control: door-staff does NOT hold it, checked against every one
// of the 8 real capabilities individually (not just the new one) — a not-vacuous check that
// door-staff still resolves to exactly its intended two-member bundle.
{
  const doorStaffCaps = resolve(['door-staff']);
  const expected = new Set(['scan-checkin', 'lookup-booking-ref']);

  for (const capability of CAPABILITIES) {
    const shouldHold = expected.has(capability);
    const actuallyHolds = doorStaffCaps.has(capability);
    if (shouldHold !== actuallyHolds) {
      failures.push(
        `(4) resolve(['door-staff']).has('${capability}') was ${actuallyHolds}, expected ${shouldHold}.`,
      );
    }
  }
  if (doorStaffCaps.size !== expected.size) {
    failures.push(
      `(4) resolve(['door-staff']) has ${doorStaffCaps.size} members, expected exactly ${expected.size}.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: CAPABILITIES gained exactly one new 8th member ('review-vendor-applications'); " +
    'manager and owner both resolve to include it; door-staff resolves to exactly its ' +
    'original two-member bundle and does NOT include the new capability.',
);
process.exit(0);

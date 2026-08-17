#!/usr/bin/env node
// F5 (ticketing-foundation) — negative-control-on-the-negative-control. A18/brief's "guard
// against vacuous 403": check-buyer-empty-capability-set.mjs proves buyer tokens are refused.
// On its own that is not proof of anything — a hasCapability() that always returns false
// (e.g. broken, or accidentally hard-coded `return false`) would also pass every one of those
// checks. This file is the positive control: it proves, using the SAME harness shape and the
// SAME real hasCapability()/resolveRoleCapabilitiesForShow() functions, that a genuinely
// admin-shaped token DOES resolve to a non-empty capability set and IS granted. If this file
// fails while check-buyer-empty-capability-set.mjs passes, the buyer refusal proof is vacuous.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f5-buyers/check-admin-token-not-vacuous.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'admin@example.com';

import { hasCapability, resolveRoleCapabilitiesForShow } from '../../../lib/admin-auth.ts';
import { CAPABILITIES } from '../../../lib/admin-roles.ts';

const failures = [];
const NOW = new Date('2027-01-05T00:00:00Z');
const GENEROUS_LOOKUP = (showId) =>
  showId === 'nationalShow'
    ? { startDate: new Date('2026-01-01'), endDate: new Date('2028-01-01') }
    : null;

const ADMIN_TOKEN = {
  uid: 'admin-uid-001',
  email: 'admin@example.com',
  email_verified: true,
  admin: true,
  roles: { '*': ['owner'] },
};

const caps = resolveRoleCapabilitiesForShow(ADMIN_TOKEN.roles, 'nationalShow', {
  now: NOW,
  lookupShowWindow: GENEROUS_LOOKUP,
});
if (caps.size !== CAPABILITIES.length) {
  failures.push(
    `resolveRoleCapabilitiesForShow(ownerRoles, 'nationalShow', ...) returned ${caps.size} capabilities, expected all ${CAPABILITIES.length} (owner holds every capability).`,
  );
}

for (const capability of CAPABILITIES) {
  const actual = hasCapability(ADMIN_TOKEN, 'nationalShow', capability, {
    now: NOW,
    lookupShowWindow: GENEROUS_LOOKUP,
  });
  if (actual !== true) {
    failures.push(`hasCapability(ownerAdminToken, 'nationalShow', '${capability}') returned false, expected true.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: an admin-shaped token with an owner role grant resolves to the full capability set and ' +
    'is granted every one of the seven defined capabilities — proving the harness used to refuse ' +
    "buyer tokens is capable of granting, so that refusal is not vacuous.",
);
process.exit(0);

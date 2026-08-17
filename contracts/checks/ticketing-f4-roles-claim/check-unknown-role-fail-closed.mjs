#!/usr/bin/env node
// F4 (ticketing-foundation) — fail-closed proof for unknown role names inside the `roles`
// claim (spec §5.4: "a role name not present in the mapping resolves to the empty capability
// set — not an error, not a special case"). Real resolveRoleCapabilitiesForShow() and
// hasCapability() calls, not a grep. This is the composition-layer counterpart to F3's
// lib/admin-roles.ts resolve() fail-closed proof — F4 must not silently re-introduce an
// "unknown role throws" or "unknown role defaults to something" branch at the claim layer.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-roles-claim/check-unknown-role-fail-closed.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'test@example.com';

import { hasCapability, resolveRoleCapabilitiesForShow } from '../../../lib/admin-auth.ts';
import { CAPABILITIES, resolve } from '../../../lib/admin-roles.ts';

const failures = [];
const NOW = new Date('2027-01-05T00:00:00Z');
const NO_WINDOW_LOOKUP = () => null;
const BASE = { email: 'test@example.com', email_verified: true, admin: true };

// A sole unrecognised role name resolves to the empty set.
const soleUnknown = resolveRoleCapabilitiesForShow(
  { '*': ['ticketing-secretary'] },
  'nationalShow',
  { now: NOW, lookupShowWindow: NO_WINDOW_LOOKUP },
);
if (soleUnknown.size !== 0) {
  failures.push(
    `resolveRoleCapabilitiesForShow with only an unknown role returned ${soleUnknown.size} ` +
      `capabilities (${[...soleUnknown].join(', ')}), expected the empty set.`,
  );
}

// An unrecognised name alongside a real one does not disturb resolution of the real one.
const mixed = resolveRoleCapabilitiesForShow(
  { '*': ['ticketing-secretary', 'owner'] },
  'nationalShow',
  { now: NOW, lookupShowWindow: NO_WINDOW_LOOKUP },
);
const realOwner = resolve(['owner']);
if (mixed.size !== realOwner.size || [...realOwner].some((c) => !mixed.has(c))) {
  failures.push(
    "resolveRoleCapabilitiesForShow with ['ticketing-secretary', 'owner'] did not equal " +
      "resolve(['owner']) — an unknown role name must not disturb resolution of a real one " +
      'listed alongside it.',
  );
}

// hasCapability with only an unrecognised role held refuses every one of the seven
// capabilities.
for (const capability of CAPABILITIES) {
  const actual = hasCapability(
    { ...BASE, roles: { '*': ['ticketing-secretary'] } },
    'nationalShow',
    capability,
    { now: NOW, lookupShowWindow: NO_WINDOW_LOOKUP },
  );
  if (actual !== false) {
    failures.push(
      `hasCapability() with only 'ticketing-secretary' held granted '${capability}' — expected refusal.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: an unrecognised role name inside the roles claim resolves to the empty capability ' +
    'set and never disturbs resolution of a real role alongside it — proven live.',
);
process.exit(0);

#!/usr/bin/env node
// F4 (ticketing-foundation) — admin-list.ts's orphan-role flagging (spec §5.6: "flags any role
// name held by a live account that no longer exists in lib/admin-roles.ts's mapping"), proven
// by real findOrphanRoles() calls against lib/admin-roles.ts's LIVE ROLE_NAMES — not a
// hard-coded expected list, so a future role rename is caught by this same check without
// editing it.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-roles-claim/check-list-orphan-roles.mjs

import { findOrphanRoles } from '../../../lib/admin-orphan-roles.ts';

const failures = [];

// Only recognised role names — zero orphans.
const clean = findOrphanRoles({ nationalShow: ['manager', 'door-staff'], '*': ['owner'] });
if (clean.length !== 0) {
  failures.push(`clean claim: expected zero orphans, got ${JSON.stringify(clean)}.`);
}

// A role name absent from ROLE_NAMES — the exact post-rename scenario spec §5.6's rename
// procedure describes (an account still holding 'manager' after it's renamed elsewhere would
// look like this from the account's point of view, with the OLD name now unrecognised).
const renamed = findOrphanRoles({
  nationalShow: ['ticketing-secretary'],
  '*': ['owner'],
});
if (renamed.length !== 1 || renamed[0] !== 'ticketing-secretary') {
  failures.push(
    `post-rename claim: expected exactly ['ticketing-secretary'], got ${JSON.stringify(renamed)}.`,
  );
}

// No claim at all — zero orphans, not an error.
const empty = findOrphanRoles(undefined);
if (empty.length !== 0) {
  failures.push(`undefined claim: expected zero orphans, got ${JSON.stringify(empty)}.`);
}

// The same orphan name held under two different show keys is reported once, not twice.
const dedupe = findOrphanRoles({
  nationalShow: ['ticketing-secretary'],
  'show-19-2027': ['ticketing-secretary'],
});
if (dedupe.length !== 1 || dedupe[0] !== 'ticketing-secretary') {
  failures.push(
    `duplicate-orphan-across-shows claim: expected exactly one entry, got ${JSON.stringify(dedupe)}.`,
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: findOrphanRoles() flags role names absent from the live ROLE_NAMES mapping, dedupes ' +
    'across shows, and reports zero orphans for a clean or empty claim — proven live.',
);
process.exit(0);

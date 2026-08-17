#!/usr/bin/env node
// F4 (ticketing-foundation) — the door-staff/manager-never-'*' scoping rule (spec §5.6:
// "door-staff and manager may only be granted scoped to a specific show, never *"), proven by
// invoking validateGrantArgs() — the grant script's real validation path — not by grepping
// admin-grant.ts's source for the string '*'.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-roles-claim/check-grant-scope-restriction.mjs

import { validateGrantArgs } from '../../../lib/admin-grant-validation.ts';

const failures = [];

function expectOk(label, args) {
  const result = validateGrantArgs(args);
  if (!result.ok) {
    failures.push(`${label}: expected ok:true, got ok:false (reason: ${result.reason}).`);
  }
}

function expectRefused(label, args) {
  const result = validateGrantArgs(args);
  if (result.ok) {
    failures.push(`${label}: expected ok:false, got ok:true.`);
  }
}

expectRefused("door-staff scoped to '*'", { roles: ['door-staff'], show: '*' });
expectRefused("manager scoped to '*'", { roles: ['manager'], show: '*' });
expectOk("owner scoped to '*'", { roles: ['owner'], show: '*' });
expectOk('door-staff scoped to a real showId', { roles: ['door-staff'], show: 'nationalShow' });

// A mixed role list containing door-staff alongside owner, requested against '*', is refused
// as a whole — one scope-restricted role in the batch is enough to refuse the batch, rather
// than silently granting door-staff org-wide because owner was also in the list.
expectRefused("mixed [door-staff, owner] scoped to '*'", {
  roles: ['door-staff', 'owner'],
  show: '*',
});

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: validateGrantArgs() refuses door-staff or manager scoped to '*' (alone or mixed with " +
    "a permitted role), and accepts owner scoped to '*' — proven live.",
);
process.exit(0);

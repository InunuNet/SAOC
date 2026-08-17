#!/usr/bin/env node
// F3 (ticketing-foundation) — behavioural proof of the fail-closed guarantee for unknown
// role names, via a REAL call to lib/admin-roles.ts's resolve(), not a grep of the source.
// F4's custom-claim resolution will pass whatever role-name strings are stored in a
// Firebase custom claim — untrusted, mutable-by-a-future-editor data, not a TypeScript
// literal — so this must be proven at runtime, not only at the type level.
//
// Three calls, all against the real resolve():
//   1. resolve(['unknown-role'])            -> empty set (a single unrecognised name)
//   2. resolve([])                          -> empty set (no roles at all)
//   3. resolve(['unknown-role', 'manager']) -> exactly manager's capabilities, unaffected
//      by the unknown name sitting alongside a real one — proves an unknown role is
//      silently ignored (contributes nothing) rather than corrupting or short-circuiting
//      resolution of the real roles in the same call.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f3-admin-roles/check-unknown-role-empty.mjs

import { resolve } from '../../../lib/admin-roles.ts';

const failures = [];

const soleUnknown = resolve(['unknown-role']);
if (soleUnknown.size !== 0) {
  failures.push(
    `resolve(['unknown-role']) returned ${soleUnknown.size} capabilities ` +
      `(${[...soleUnknown].join(', ')}), expected the empty set.`
  );
}

const noRoles = resolve([]);
if (noRoles.size !== 0) {
  failures.push(`resolve([]) returned ${noRoles.size} capabilities, expected the empty set.`);
}

const mixedManager = resolve(['unknown-role', 'manager']);
const realManager = resolve(['manager']);
if (mixedManager.size !== realManager.size || [...realManager].some((c) => !mixedManager.has(c))) {
  failures.push(
    "resolve(['unknown-role', 'manager']) did not equal resolve(['manager']) — an unknown " +
      'role name must contribute nothing and must not disturb resolution of real roles ' +
      'listed alongside it.'
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: resolve() returns the empty capability set for unknown role names, alone or mixed ' +
    'in with real ones — fail-closed by construction, proven live.'
);
process.exit(0);

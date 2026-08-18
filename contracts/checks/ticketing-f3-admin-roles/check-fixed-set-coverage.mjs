#!/usr/bin/env node
// F3 (ticketing-foundation) — behavioural proof of spec §5.2/§5.3's coverage guarantee,
// via REAL calls to lib/admin-roles.ts's exported resolve(), not a grep of the source.
//
// Two things are proved, both from actual resolve() return values:
//
// 1. Every capability in the fixed CAPABILITIES set is granted by at least one role — the
//    union of resolve(['door-staff']), resolve(['manager']), resolve(['owner']) covers the
//    whole fixed set. A capability nobody's bundle ever grants would be dead, unreachable
//    code — this check would fail if one existed.
//
// 2. No role's resolved capability set contains anything outside the fixed CAPABILITIES
//    set. This guards against a hand-typo'd string in a bundle that happens to satisfy the
//    type checker via an `as Capability` cast (a compile-time-only guarantee can be
//    silently bypassed at runtime by exactly that pattern) — only a real call proves the
//    actual Set contents at runtime, which is why this can't be a type-only check.
//
// If lib/admin-roles.ts were deleted, the import below throws at module-load time and this
// script exits non-zero before any assertion runs — the gate fails loudly, not silently.
// If ROLE_TO_CAPABILITIES were emptied (each role mapped to an empty set), assertion 1
// fails immediately: the union of three empty sets is empty, not the seven-member fixed
// set. Both failure modes are caught structurally, not by a separate "does the file exist"
// check.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f3-admin-roles/check-fixed-set-coverage.mjs

import { CAPABILITIES, ROLE_NAMES, resolve } from '../../../lib/admin-roles.ts';

const failures = [];

const fixedSet = new Set(CAPABILITIES);
if (fixedSet.size !== 8) {
  failures.push(`CAPABILITIES has ${fixedSet.size} members, expected exactly 8 (spec §5.2).`);
}

const covered = new Set();
for (const role of ROLE_NAMES) {
  for (const cap of resolve([role])) {
    covered.add(cap);
    if (!fixedSet.has(cap)) {
      failures.push(
        `resolve(['${role}']) returned '${cap}', which is not in the fixed CAPABILITIES set — ` +
          'a role bundle must never reference a capability outside the fixed set.'
      );
    }
  }
}

for (const cap of fixedSet) {
  if (!covered.has(cap)) {
    failures.push(
      `Capability '${cap}' is not granted by resolve() of any role in ROLE_NAMES (${ROLE_NAMES.join(', ')}) — dead capability.`
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: every fixed capability is granted by at least one real role via resolve(), and no ' +
    'role bundle grants a capability outside the fixed set.'
);
process.exit(0);

#!/usr/bin/env node
// F4 (ticketing-foundation) — the one-time admin->owner migration is dry-run by default (a
// hard live-migration-safety requirement — see golden/README.md, migration decision 1: "it is
// dry-run by default; mutating requires an explicit flag"). Proven by real
// parseMigrationArgs() calls.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-roles-claim/check-migration-dry-run-default.mjs

import { parseMigrationArgs } from '../../../lib/admin-migrate-roles-plan.ts';

const failures = [];

function expectApply(label, argv, expected) {
  const { apply } = parseMigrationArgs(argv);
  if (apply !== expected) {
    failures.push(`${label}: parseMigrationArgs(${JSON.stringify(argv)}).apply === ${apply}, expected ${expected}.`);
  }
}

// No flags at all — dry-run.
expectApply('no args', [], false);

// A positional email-like argument alone (mistakenly typed instead of the flag) — still
// dry-run, not a silent mutate. Mistyping an argument must never accidentally flip the mutate
// switch on a script that touches the sole live admin account.
expectApply('positional arg, no --apply', ['brad@inunu.net'], false);

// Only the explicit --apply flag mutates.
expectApply('--apply present', ['--apply'], true);
expectApply('--apply alongside other args', ['brad@inunu.net', '--apply'], true);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: parseMigrationArgs() only ever mutates when --apply is explicitly present — proven live.',
);
process.exit(0);

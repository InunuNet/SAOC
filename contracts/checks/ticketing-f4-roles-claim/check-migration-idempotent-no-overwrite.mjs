#!/usr/bin/env node
// F4 (ticketing-foundation) — the one-time admin->owner migration is idempotent and never
// overwrites an existing richer roles claim (golden/README.md, migration decisions 1-2).
// Proven by real computeMigrationPlan() calls against a FABRICATED in-memory account list —
// never live Firebase. This is the contract's proof for the live-migration constraint the
// mission brief calls out by name: brad@inunu.net is the sole live admin today, and this
// function is what scripts/admin-migrate-roles.ts's --apply path acts on.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-roles-claim/check-migration-idempotent-no-overwrite.mjs

import { computeMigrationPlan } from '../../../lib/admin-migrate-roles-plan.ts';

const failures = [];

const accounts = [
  { uid: 'a-no-roles-yet', admin: true },
  { uid: 'b-already-migrated', admin: true, roles: { '*': ['owner'] } },
  { uid: 'c-richer-claim', admin: true, roles: { nationalShow: ['manager'] } },
  { uid: 'd-not-admin', admin: false },
];

const plan = computeMigrationPlan(accounts);

function actionFor(uid) {
  return plan.find((a) => a.uid === uid);
}

const a = actionFor('a-no-roles-yet');
if (!a || a.action !== 'grant' || JSON.stringify(a.newRoles) !== JSON.stringify({ '*': ['owner'] })) {
  failures.push(
    `admin:true, no roles claim: expected {action:'grant', newRoles:{'*':['owner']}}, got ${JSON.stringify(a)}.`,
  );
}

const b = actionFor('b-already-migrated');
if (!b || b.action !== 'skip') {
  failures.push(
    `admin:true, already holds {'*':['owner']} (simulating a second run): expected 'skip', got ${JSON.stringify(b)}.`,
  );
}

const c = actionFor('c-richer-claim');
if (!c || c.action !== 'skip') {
  failures.push(
    `admin:true, holds a different existing roles claim: expected 'skip' (never overwritten), got ${JSON.stringify(c)}.`,
  );
}

const d = actionFor('d-not-admin');
if (!d || d.action !== 'skip' || !/not-admin|admin/i.test(d.reason ?? '')) {
  failures.push(`admin:false: expected 'skip' with a reason identifying non-admin status, got ${JSON.stringify(d)}.`);
}

// No returned action of either kind carries a revokeRefreshTokens key — the migration path
// cannot express a revoke. Runtime counterpart to the typecheck fixture's compile-time proof
// of the same property on the 'grant' variant.
for (const action of plan) {
  if (Object.prototype.hasOwnProperty.call(action, 'revokeRefreshTokens')) {
    failures.push(
      `action for '${action.uid}' carries a revokeRefreshTokens key — the migration path must ` +
        `never be able to express a revoke instruction.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: computeMigrationPlan() grants only admin:true accounts with no existing roles claim, ' +
    'skips already-migrated and richer-claim accounts (idempotent, never overwrites), skips ' +
    'non-admins with a reason, and never attaches a revokeRefreshTokens key — proven live ' +
    'against a fabricated in-memory account list.',
);
process.exit(0);

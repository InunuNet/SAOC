#!/usr/bin/env node
// F4 (ticketing-foundation) — every revoke path calls revokeRefreshTokens() (spec §5.5: "must
// call revokeRefreshTokens() at the moment of the change... a hard requirement on the
// tooling, not an edge case to accept"). Proven by real computeRevokePlan() calls —
// admin-revoke.ts's real planning function — covering both the full-revoke and partial-revoke
// paths.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-roles-claim/check-revoke-always-revokes-tokens.mjs

import { computeRevokePlan } from '../../../lib/admin-revoke-plan.ts';

const failures = [];

// Full revoke (no target) — no existing roles.
const fullNoExisting = computeRevokePlan(undefined);
if (fullNoExisting.revokeRefreshTokens !== true || fullNoExisting.fullRevoke !== true) {
  failures.push(
    `full revoke (no existing roles): expected {revokeRefreshTokens:true, fullRevoke:true}, ` +
      `got ${JSON.stringify(fullNoExisting)}.`,
  );
}

// Full revoke (no target) — existing roles present.
const fullWithExisting = computeRevokePlan({ '*': ['owner'] });
if (fullWithExisting.revokeRefreshTokens !== true || fullWithExisting.fullRevoke !== true) {
  failures.push(
    `full revoke (existing roles present): expected {revokeRefreshTokens:true, fullRevoke:true}, ` +
      `got ${JSON.stringify(fullWithExisting)}.`,
  );
}

// Partial revoke — remove one role, sibling role at the same show remains.
const partialWithSibling = computeRevokePlan(
  { nationalShow: ['manager', 'door-staff'] },
  { role: 'door-staff', show: 'nationalShow' },
);
if (
  partialWithSibling.revokeRefreshTokens !== true ||
  partialWithSibling.fullRevoke !== false ||
  JSON.stringify(partialWithSibling.newRoles.nationalShow) !== JSON.stringify(['manager'])
) {
  failures.push(
    `partial revoke with sibling role: expected revokeRefreshTokens:true, fullRevoke:false, ` +
      `newRoles.nationalShow === ['manager'], got ${JSON.stringify(partialWithSibling)}.`,
  );
}

// Partial revoke — removing the only role held at a show prunes that show's key entirely,
// keeping the ~1000-byte custom-claim budget (spec §5.4) from accumulating empty entries.
const partialPrunes = computeRevokePlan(
  { nationalShow: ['door-staff'] },
  { role: 'door-staff', show: 'nationalShow' },
);
if (
  partialPrunes.revokeRefreshTokens !== true ||
  Object.prototype.hasOwnProperty.call(partialPrunes.newRoles, 'nationalShow')
) {
  failures.push(
    `partial revoke pruning the last role at a show: expected revokeRefreshTokens:true and no ` +
      `'nationalShow' key remaining, got ${JSON.stringify(partialPrunes)}.`,
  );
}

// Partial revoke targeting a role/show pairing the account never held — still returns
// revokeRefreshTokens:true; the plan always instructs a revoke, independent of whether
// anything actually changed.
const partialNoOp = computeRevokePlan(
  { nationalShow: ['manager'] },
  { role: 'door-staff', show: 'nationalShow' },
);
if (partialNoOp.revokeRefreshTokens !== true) {
  failures.push(
    `partial revoke of a role/show the account never held: expected revokeRefreshTokens:true ` +
      `regardless, got ${JSON.stringify(partialNoOp)}.`,
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: computeRevokePlan() returns revokeRefreshTokens:true on every path (full, partial, ' +
    'pruning, and no-op-target), and prunes an emptied show key — proven live.',
);
process.exit(0);

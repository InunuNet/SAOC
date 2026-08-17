#!/usr/bin/env node
// F6 (ticketing-foundation) — design constraint 6: possessing a recovery token grants access to
// that ONE order's tickets and NOTHING else. It must never resolve to a capability, an admin
// surface, or a role. Proven two ways, mirroring F5's A3
// (contracts/checks/ticketing-f5-buyers/check-buyer-empty-capability-set.mjs) — the SAME real
// functions, applied to a recovery-token-holder's identity shape instead of a buyer account's:
//
//   1. A DecodedIdToken-shaped object representing "the only identity information a recovery-
//      link visitor could plausibly carry if a future edit mistakenly tried to bridge them into
//      the admin auth system" (the verified token's orderId/an associated buyer email, no
//      `admin` claim, no `roles` claim) resolves to the EMPTY capability set under the REAL
//      hasCapability()/resolveRoleCapabilitiesForShow() (lib/admin-auth.ts, F4), across all
//      seven live capabilities, against a deliberately generous show-window lookup.
//   2. verifyRecoveryToken()'s own success shape is checked at runtime to carry exactly
//      { ok, orderId, expiresAt } — no roles/admin/capabilities key ever present, so there is
//      nothing on the verification result itself a future caller could accidentally forward
//      into an authorization check and have it do something.
//
// No live Firebase, no network, no Firestore write.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f6-recovery-token/check-zero-authorization-meaning.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'admin@example.com';

import { randomBytes } from 'node:crypto';
import { hasCapability, resolveRoleCapabilitiesForShow } from '../../../lib/admin-auth.ts';
import { CAPABILITIES } from '../../../lib/admin-roles.ts';
import { mintRecoveryToken, verifyRecoveryToken } from '../../../lib/recovery-token.ts';

const failures = [];
const NOW = new Date('2027-03-01T00:00:00Z');
const SECRET = randomBytes(32).toString('hex');

const GENEROUS_LOOKUP = (showId) =>
  showId === 'nationalShow'
    ? { startDate: new Date('2026-01-01'), endDate: new Date('2028-01-01') }
    : null;

// A real, successfully-verified recovery token — the strongest possible starting point for a
// future edit that mistakenly reused it as an identity.
const minted = mintRecoveryToken({ orderId: 'order-zero-auth-1', secret: SECRET, now: NOW });
const verification = verifyRecoveryToken({ token: minted.token, secret: SECRET, now: NOW });

if (!verification.ok) {
  console.error(`FAIL: (setup) A freshly minted token failed to verify: ${JSON.stringify(verification)}.`);
  process.exit(1);
}

// (1) The verification result's own shape carries nothing admin-flavoured.
const allowedKeys = new Set(['ok', 'orderId', 'expiresAt']);
for (const key of Object.keys(verification)) {
  if (!allowedKeys.has(key)) {
    failures.push(`(1) verifyRecoveryToken()'s success result carries an unexpected key '${key}' — expected only ok/orderId/expiresAt.`);
  }
}
for (const dangerousKey of ['roles', 'admin', 'capabilities', 'capability', 'role']) {
  if (dangerousKey in verification) {
    failures.push(`(1) verifyRecoveryToken()'s success result carries a '${dangerousKey}' key — a recovery token must never resolve to anything authorization-shaped.`);
  }
}

// (2) A DecodedIdToken-shaped object built from ONLY what a recovery-link visitor's identity
// could plausibly carry (their verified orderId re-purposed as a uid-like field, no admin
// claim, no roles claim — since minting/verifying a recovery token never touches Firebase Auth
// at all) refuses every one of the seven capabilities under the real decision functions.
function recoveryTokenHolderToken(overrides = {}) {
  return {
    uid: `recovery-token-holder-${verification.orderId}`,
    email: 'recovered-buyer@example.com',
    email_verified: true,
    ...overrides,
  };
}

const capsWildcard = resolveRoleCapabilitiesForShow(undefined, '*', { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
const capsShow = resolveRoleCapabilitiesForShow(undefined, 'nationalShow', { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
if (capsWildcard.size !== 0) {
  failures.push(`(2a) resolveRoleCapabilitiesForShow(undefined, '*', ...) returned ${capsWildcard.size} capabilities for a recovery-token-holder identity, expected 0.`);
}
if (capsShow.size !== 0) {
  failures.push(`(2b) resolveRoleCapabilitiesForShow(undefined, 'nationalShow', ...) returned ${capsShow.size} capabilities for a recovery-token-holder identity, expected 0.`);
}

for (const capability of CAPABILITIES) {
  const decoded = recoveryTokenHolderToken();
  const actual = hasCapability(decoded, 'nationalShow', capability, { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
  if (actual !== false) {
    failures.push(`(2c) hasCapability(recoveryTokenHolderToken, 'nationalShow', '${capability}') returned true, expected false.`);
  }
}

// (3) The gap F5's own A3 case (5) was strengthened to close (see
// contracts/checks/ticketing-f5-buyers/check-buyer-empty-capability-set.mjs) applies equally
// here: a mutant that grants capabilities whenever a `roles` claim happens to be present,
// without actually requiring `admin === true` first, would pass (1)-(2c) unchanged, because none
// of them gives such a mutant a `roles` claim to act on. This case gives it exactly that — a
// recovery-token-holder-shaped identity with admin ABSENT but a live `{'*': ['owner']}` roles
// claim, checked against a generous show window. Any grant here means the admin gate was
// bypassed by roles-claim presence alone.
{
  const decodedWithRoles = recoveryTokenHolderToken({ roles: { '*': ['owner'] } });
  for (const capability of CAPABILITIES) {
    const actual = hasCapability(decodedWithRoles, 'nationalShow', capability, { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
    if (actual !== false) {
      failures.push(
        `(3) hasCapability(recoveryTokenHolderToken with admin absent but roles {'*':['owner']}, 'nationalShow', '${capability}') returned true, expected false — the admin gate was bypassed by roles-claim presence alone.`,
      );
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: a verified recovery token's own result carries no roles/admin/capabilities field, " +
    "and an identity shaped like a recovery-link visitor's resolves to the empty capability " +
    'set and is refused every one of the seven defined capabilities under the real ' +
    'hasCapability()/resolveRoleCapabilitiesForShow() — including when a live owner roles ' +
    'claim is present but the admin claim is absent — a recovery token carries zero ' +
    'authorization meaning.',
);
process.exit(0);

#!/usr/bin/env node
// F7 (ticketing-foundation) — design constraint 5, the same rule F5's A3 and F6's A8 already
// established for buyer accounts and recovery tokens: writing or holding a checkinAttempts
// record must never grant a capability. Proven two ways against the REAL functions:
//   1. buildCheckinAttemptRecord()'s own output carries no roles/admin/capabilities key.
//   2. A DecodedIdToken-shaped object built from ONLY what a checkinAttempts record's
//      scannedByUid could plausibly seed (a uid-like field, no admin claim, no roles claim)
//      resolves to the EMPTY capability set under the REAL hasCapability()/
//      resolveRoleCapabilitiesForShow() (lib/admin-auth.ts, F4), across all seven live
//      capabilities, against a deliberately generous show-window lookup — including the
//      case(5)-style combo (admin absent, allowlisted email, a live owner roles claim) F5/F6
//      needed to add before a real admin-gate-bypass mutation was actually caught.
//
// No live Firebase, no network, no Firestore write.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f7-checkin-audit/check-zero-authorization-meaning.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'admin@example.com';

import { hasCapability, resolveRoleCapabilitiesForShow } from '../../../lib/admin-auth.ts';
import { CAPABILITIES } from '../../../lib/admin-roles.ts';
import { buildCheckinAttemptRecord } from '../../../lib/checkin-audit.ts';

const failures = [];
const NOW = new Date('2027-03-01T09:00:00Z');

const GENEROUS_LOOKUP = (showId) =>
  showId === 'nationalShow'
    ? { startDate: new Date('2026-01-01'), endDate: new Date('2028-01-01') }
    : null;

// (1) The record's own shape carries nothing admin-flavoured.
{
  const record = buildCheckinAttemptRecord({
    bookingRef: 'SAOC-2027-ABC123',
    showId: 'nationalShow',
    orderId: 'order-1',
    outcome: 'admit',
    refusalReason: null,
    scannedByUid: 'door-staff-uid-1',
    now: NOW,
  });

  for (const dangerousKey of ['roles', 'admin', 'capabilities', 'capability', 'role']) {
    if (dangerousKey in record) {
      failures.push(`(1) CheckinAttemptRecord carries a '${dangerousKey}' key — a checkinAttempts record must never resolve to anything authorization-shaped.`);
    }
  }
}

// (2) A DecodedIdToken-shaped object built from ONLY what a checkinAttempts record's
// scannedByUid could plausibly seed — exactly what a future edit mistakenly bridging audit-log
// identity into the admin auth system would produce.
function scannedByIdentityToken(overrides = {}) {
  return {
    uid: 'door-staff-uid-from-audit-log',
    email: 'someone@example.com',
    email_verified: true,
    ...overrides,
  };
}

const capsWildcard = resolveRoleCapabilitiesForShow(undefined, '*', { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
const capsShow = resolveRoleCapabilitiesForShow(undefined, 'nationalShow', { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
if (capsWildcard.size !== 0) {
  failures.push(`(2a) resolveRoleCapabilitiesForShow(undefined, '*', ...) returned ${capsWildcard.size} capabilities for a scannedByUid-derived identity, expected 0.`);
}
if (capsShow.size !== 0) {
  failures.push(`(2b) resolveRoleCapabilitiesForShow(undefined, 'nationalShow', ...) returned ${capsShow.size} capabilities for a scannedByUid-derived identity, expected 0.`);
}

for (const capability of CAPABILITIES) {
  const decoded = scannedByIdentityToken();
  const actual = hasCapability(decoded, 'nationalShow', capability, { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
  if (actual !== false) {
    failures.push(`(2c) hasCapability(scannedByIdentityToken, 'nationalShow', '${capability}') returned true, expected false.`);
  }
}

// (3) The case(5)-style combo F5/F6 needed to add before an admin-gate-bypass mutation was
// actually caught: admin absent, email_verified true, an email that IS on
// ADMIN_EMAIL_ALLOWLIST, AND a live {'*': ['owner']} roles claim, checked against the same
// generous show window, across all seven capabilities — must still refuse every one.
{
  process.env.ADMIN_EMAIL_ALLOWLIST = 'someone@example.com';
  const decodedWithRoles = scannedByIdentityToken({ roles: { '*': ['owner'] } });
  for (const capability of CAPABILITIES) {
    const actual = hasCapability(decodedWithRoles, 'nationalShow', capability, { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
    if (actual !== false) {
      failures.push(
        `(3) hasCapability(scannedByIdentityToken with admin absent, allowlisted email, and roles {'*':['owner']}, 'nationalShow', '${capability}') returned true, expected false — the admin gate was bypassed by roles-claim presence alone.`,
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
  'PASS: a CheckinAttemptRecord carries no roles/admin/capabilities field, and an identity ' +
    "shaped like one built from a checkinAttempts record's scannedByUid resolves to the empty " +
    'capability set and is refused every one of the seven defined capabilities under the real ' +
    'hasCapability()/resolveRoleCapabilitiesForShow() — including when a live owner roles ' +
    'claim and an allowlisted email are both present but the admin claim is absent — a ' +
    'checkin-audit record carries zero authorization meaning.',
);
process.exit(0);

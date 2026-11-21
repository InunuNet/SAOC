import assert from 'node:assert/strict';
import test from 'node:test';

import type { DecodedIdToken } from 'firebase-admin/auth';

process.env['ADMIN_EMAIL_ALLOWLIST'] = 'staff@example.org';

import { adminHasCapability } from './admin-capability-gate';
import type { Capability } from './admin-roles';

// Minimal verified, allowlisted admin token; `roles` is the only thing each case varies.
function token(roles?: Record<string, string[]> | null): DecodedIdToken {
  return {
    uid: 'staff',
    email: 'staff@example.org',
    email_verified: true,
    admin: true,
    ...(roles === undefined ? {} : { roles }),
  } as unknown as DecodedIdToken; // test fixture: only the claims the gate reads
}

const ROUTE_CAPABILITIES: Record<string, Capability> = {
  'export-csv': 'export-buyer-data',
  'newsletter export-csv': 'export-buyer-data',
  'tickets list': 'search-buyers',
  checkin: 'scan-checkin',
};

for (const [route, capability] of Object.entries(ROUTE_CAPABILITIES)) {
  test(`${route}: a legacy admin with no roles claim keeps access`, async () => {
    assert.equal(await adminHasCapability(token(), capability), true);
    assert.equal(await adminHasCapability(token(null), capability), true);
  });
}

test('door-staff is refused both exports and the tickets list, and allowed check-in', async () => {
  const doorStaff = token({ '*': ['door-staff'] });
  assert.equal(await adminHasCapability(doorStaff, 'export-buyer-data'), false);
  assert.equal(await adminHasCapability(doorStaff, 'search-buyers'), false);
  assert.equal(await adminHasCapability(doorStaff, 'scan-checkin'), true);
});

test('manager is allowed all four routes', async () => {
  const manager = token({ '*': ['manager'] });
  for (const capability of Object.values(ROUTE_CAPABILITIES)) {
    assert.equal(await adminHasCapability(manager, capability), true, capability);
  }
});

test('an empty roles claim (left by a revoke) is strict, not legacy', async () => {
  assert.equal(await adminHasCapability(token({}), 'export-buyer-data'), false);
});

test('a non-admin token never passes, roles or not', async () => {
  const notAdmin = { ...token({ '*': ['owner'] }), admin: false } as unknown as DecodedIdToken;
  assert.equal(await adminHasCapability(notAdmin, 'scan-checkin'), false);
  const legacyNotAdmin = { ...token(), admin: false } as unknown as DecodedIdToken;
  assert.equal(await adminHasCapability(legacyNotAdmin, 'scan-checkin'), false);
});

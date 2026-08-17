#!/usr/bin/env node
// F7 (ticketing-foundation) — design constraint 2: no checkinAttempts record can ever carry a
// raw QR payload, a signed token, or attendee/buyer PII beyond bookingRef — a leaked
// checkinAttempts collection must never become a ticket-minting oracle or a POPIA-sensitive
// data dump. Proven against the REAL buildCheckinAttemptRecord(), not a re-implementation.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f7-checkin-audit/check-record-shape-and-pii-minimization.mjs

import { buildCheckinAttemptRecord } from '../../../lib/checkin-audit.ts';

const failures = [];
const NOW = new Date('2027-03-01T09:00:00Z');

const EXPECTED_KEYS = new Set([
  'bookingRef',
  'showId',
  'orderId',
  'outcome',
  'refusalReason',
  'scannedByUid',
  'deviceId',
  'scannedAt',
  'source',
  'syncedAt',
]);

const FORBIDDEN_KEYS = ['qrPayload', 'rawToken', 'signedToken', 'token', 'attendeeEmail', 'buyerEmail', 'attendeeName'];

// (1) A caller passing exactly the documented fields — baseline shape check.
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

  const keys = new Set(Object.keys(record));
  if (keys.size !== EXPECTED_KEYS.size || [...EXPECTED_KEYS].some((k) => !keys.has(k))) {
    failures.push(`(1) record key set mismatch: expected exactly {${[...EXPECTED_KEYS].join(', ')}}, got {${[...keys].join(', ')}}.`);
  }
}

// (2) A careless/future caller whose input object carries extra, PII/secret-shaped properties
// alongside the legitimate fields — simulating a loosely-typed call site (e.g. one that spreads
// the whole scan request body into the input) or a future refactor that widened the input type
// without updating this module. The type assertion below exists ONLY to let this test construct
// an input shape a correctly-typed caller could never produce — it is not a production pattern.
{
  const smuggledInput = /** @type {import('../../../lib/checkin-audit.ts').BuildCheckinAttemptInput} */ ({
    bookingRef: 'SAOC-2027-ABC123',
    showId: 'nationalShow',
    orderId: 'order-1',
    outcome: 'admit',
    refusalReason: null,
    scannedByUid: 'door-staff-uid-1',
    now: NOW,
    // Smuggled, out-of-shape fields a careless caller might pass through:
    qrPayload: 'raw-scanned-qr-blob-that-must-never-be-stored',
    rawToken: 'signed.jwt.looking.token',
    signedToken: 'another-signed-secret',
    token: 'yet-another-token-shaped-field',
    attendeeEmail: 'attendee@example.com',
    buyerEmail: 'buyer@example.com',
    attendeeName: 'A Real Person',
  });

  const record = buildCheckinAttemptRecord(smuggledInput);
  const keys = new Set(Object.keys(record));

  if (keys.size !== EXPECTED_KEYS.size || [...EXPECTED_KEYS].some((k) => !keys.has(k))) {
    failures.push(`(2) smuggled-input record key set mismatch: expected exactly {${[...EXPECTED_KEYS].join(', ')}}, got {${[...keys].join(', ')}} — a wider key set here means smuggled fields leaked through.`);
  }
  for (const forbidden of FORBIDDEN_KEYS) {
    if (forbidden in record) {
      failures.push(`(2) record carries forbidden key '${forbidden}' — buildCheckinAttemptRecord() must never pass through unrecognised input fields.`);
    }
  }
}

// (3) The 'admit'-forces-refusalReason-null invariant, deliberately supplying a non-null value
// to prove the force is unconditional, not merely never exercised.
{
  const record = buildCheckinAttemptRecord({
    bookingRef: 'SAOC-2027-ABC123',
    showId: 'nationalShow',
    orderId: 'order-1',
    outcome: 'admit',
    refusalReason: 'a refusal reason that must be discarded',
    scannedByUid: 'door-staff-uid-1',
    now: NOW,
  });
  if (record.refusalReason !== null) {
    failures.push(`(3) outcome 'admit' with a non-null refusalReason input: expected forced null, got ${JSON.stringify(record.refusalReason)}.`);
  }
}

// (4) syncedAt is always null, regardless of what the (mistyped) caller supplies.
{
  const inputWithSyncedAt = /** @type {import('../../../lib/checkin-audit.ts').BuildCheckinAttemptInput} */ ({
    bookingRef: 'SAOC-2027-ABC123',
    showId: 'nationalShow',
    orderId: 'order-1',
    outcome: 'admit',
    refusalReason: null,
    scannedByUid: 'door-staff-uid-1',
    now: NOW,
    syncedAt: new Date('2027-03-02T00:00:00Z'),
  });
  const record = buildCheckinAttemptRecord(inputWithSyncedAt);
  if (record.syncedAt !== null) {
    failures.push(`(4) syncedAt with a non-null input value: expected forced null, got ${JSON.stringify(record.syncedAt)}.`);
  }
}

// (5) A non-'admit' outcome's refusalReason is passed through unmodified (proves (3) is a
// forcing rule specific to 'admit', not a blanket "always null" that would make (3) meaningless).
{
  const record = buildCheckinAttemptRecord({
    bookingRef: null,
    showId: null,
    orderId: null,
    outcome: 'not-found',
    refusalReason: 'Ticket not found',
    scannedByUid: 'door-staff-uid-1',
    now: NOW,
  });
  if (record.refusalReason !== 'Ticket not found') {
    failures.push(`(5) outcome 'not-found': expected refusalReason to pass through as 'Ticket not found', got ${JSON.stringify(record.refusalReason)}.`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: buildCheckinAttemptRecord() returns exactly the ten documented fields and nothing ' +
    'else, even when the caller\'s input carries smuggled PII/secret-shaped properties; ' +
    "refusalReason is forced to null on 'admit' (and only on 'admit') and syncedAt is always " +
    'null, both proven with non-null inputs to show the forcing is unconditional.',
);
process.exit(0);

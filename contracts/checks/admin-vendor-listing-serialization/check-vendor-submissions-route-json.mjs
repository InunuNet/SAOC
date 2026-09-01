#!/usr/bin/env node
// P0 contract admin-vendor-listing-serialization -- A9. Mirrors
// check-vendor-applications-route-json.mjs exactly, for
// app/api/admin/vendors/route.ts:34 -- `snapshot.docs.map((doc) => ({ id: doc.id,
// ...doc.data() }))`, GET /api/admin/vendors -- the fourth and last blast-radius instance.
// Also orphaned today (no caller round-trips through it) but live and reachable with a valid
// admin session.
//
// THE FIX, reusing A2's exact unit: the route's map body calls
// `serializeVendorSubmission(doc.id, doc.data())` -- the same function A2 proves converts
// Timestamp -> Date -- and relies on `NextResponse.json()`'s native `Date.prototype.toJSON()`
// call to produce the ISO 8601 string, matching app/api/admin/export-csv/route.ts:27-28's and
// components/admin/TicketsTable.tsx:13's existing convention. No second conversion function.
//
// RED proof (run against HEAD before the fix lands): same import failure as A2/A9's sibling.
//
// Run as: node --import tsx/esm contracts/checks/admin-vendor-listing-serialization/check-vendor-submissions-route-json.mjs

import { Timestamp } from 'firebase-admin/firestore';

const failures = [];

const submittedAtSource = new Date('2027-02-10T08:00:00.000Z');

const seededData = {
  businessName: 'Stellenbosch Orchid Nursery',
  status: 'approved',
  submittedAt: Timestamp.fromDate(submittedAtSource),
};
const seededId = 'sub-route-fixture-1';

// (1) CONTROL -- reproduces the route's current defective line and its JSON.stringify output.
const naiveDoc = { id: seededId, ...seededData };
const naiveJson = JSON.parse(JSON.stringify({ submissions: [naiveDoc] }));
const naiveSubmittedAt = naiveJson.submissions[0].submittedAt;
const leaksInternalShape =
  naiveSubmittedAt && typeof naiveSubmittedAt === 'object' && '_seconds' in naiveSubmittedAt;
if (!leaksInternalShape) {
  failures.push(
    'CONTROL INVALID: the naive `{ id, ...doc.data() }` shape, JSON-serialized, did not leak ' +
      `Firestore's internal {_seconds, _nanoseconds} shape (got ${JSON.stringify(naiveSubmittedAt)}) -- ` +
      'this check\'s premise no longer holds; re-verify against the current firebase-admin version.',
  );
} else {
  console.log(`CONTROL OK: naive route response leaks Firestore's internal shape: ${JSON.stringify(naiveSubmittedAt)}`);
}

// (2) THE GATE.
let serializeVendorSubmission;
try {
  ({ serializeVendorSubmission } = await import('../../../lib/firestore-serialization.ts'));
} catch (err) {
  failures.push(
    `GATE IMPORT FAILED: lib/firestore-serialization.ts's serializeVendorSubmission could not ` +
      `be imported -- ${err instanceof Error ? err.message : String(err)}`,
  );
}

if (serializeVendorSubmission) {
  let fixedResponseBody;
  try {
    const submissions = [seededData].map((data) => serializeVendorSubmission(seededId, data));
    fixedResponseBody = JSON.parse(JSON.stringify({ submissions }));
  } catch (err) {
    failures.push(
      `GATE THREW while building the fixed route's JSON response -- ${err instanceof Error ? err.stack : String(err)}`,
    );
  }

  if (fixedResponseBody) {
    const gotSubmittedAt = fixedResponseBody.submissions[0]?.submittedAt;
    const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    if (typeof gotSubmittedAt !== 'string' || !ISO_8601.test(gotSubmittedAt)) {
      failures.push(
        `GATE FAILED: fixed route's submittedAt did not JSON-serialize to an ISO 8601 string -- got ${JSON.stringify(gotSubmittedAt)}.`,
      );
    } else if (new Date(gotSubmittedAt).getTime() !== submittedAtSource.getTime()) {
      failures.push(
        `GATE FAILED: fixed route's submittedAt is not millisecond-exact -- expected ${submittedAtSource.toISOString()}, got ${gotSubmittedAt}.`,
      );
    } else {
      console.log(`GATE OK: fixed route's submittedAt JSON-serializes to an ISO 8601 string: ${gotSubmittedAt}`);
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL: admin-vendor-listing-serialization A9 (GET /api/admin/vendors JSON boundary)');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log('PASS: the fixed vendor-submissions route response has no Firestore-internal-shape leak.');
process.exit(0);

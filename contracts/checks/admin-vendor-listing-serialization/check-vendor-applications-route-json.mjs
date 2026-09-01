#!/usr/bin/env node
// P0 contract admin-vendor-listing-serialization -- A8.
//
// Blast-radius widening (team-lead sweep, 2026-09-01): GET /api/admin/vendors/applications
// (app/api/admin/vendors/applications/route.ts:33) does
// `snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))` -- the identical raw spread
// as the page instances (A1), but at a JSON response boundary instead of an RSC prop
// boundary. `JSON.stringify` does NOT throw on a class instance the way RSC serialization
// does -- it silently calls the Firestore Timestamp's own internal shape and emits
// `{"_seconds": N, "_nanoseconds": N}` for every timestamp field, leaking Firestore's wire
// format and disagreeing with every other date this project's API surface emits (see
// app/api/admin/export-csv/route.ts:27-28 and components/admin/TicketsTable.tsx:13, both of
// which produce an ISO 8601 string). This is the MORE dangerous version of the same defect
// class precisely because nothing crashes to tell you -- confirmed directly:
//
//   $ node -e "const {Timestamp}=require('firebase-admin/firestore');
//     console.log(JSON.stringify({submittedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'))}))"
//   {"submittedAt":{"_seconds":1767225600,"_nanoseconds":0}}
//
// This route is orphaned today (no caller round-trips through it -- the admin page reads
// Firestore directly) but is live and reachable with a valid admin session, so it is fixed in
// the same pass rather than left as a known-wrong endpoint behind a now-fixed UI.
//
// THE FIX, reusing A1's exact unit, not a parallel one: app/api/admin/vendors/applications/
// route.ts's map body calls the SAME `serializeVendorApplication(doc.id, doc.data())` A1
// already proves converts Timestamp -> Date. No second conversion function is introduced --
// `JSON.stringify`/`NextResponse.json()` calls `Date.prototype.toJSON()` natively for any
// Date value, which returns `.toISOString()` -- the exact string shape the CSV route and
// TicketsTable already establish as this project's one convention for a date crossing a
// boundary. Confirmed directly: `JSON.stringify({submittedAt: new Date(...)})` ->
// `{"submittedAt":"...T...Z"}`.
//
// RED proof (run against HEAD before the fix lands): the route file still does the raw spread
// (grep-verified by A11), and this check's gate -- constructing the exact response shape the
// route should produce and JSON-round-tripping it -- fails via the same
// lib/firestore-serialization.ts import that A1 fails on.
//
// Run as: node --import tsx/esm contracts/checks/admin-vendor-listing-serialization/check-vendor-applications-route-json.mjs

import { Timestamp } from 'firebase-admin/firestore';

const failures = [];

const submittedAtSource = new Date('2027-01-05T12:00:00.000Z');

// A real vendorApplications document, matching A1's fixture shape -- populated, not empty.
const seededData = {
  businessName: 'Cape Orchid Traders',
  status: 'approved',
  submittedAt: Timestamp.fromDate(submittedAtSource),
};
const seededId = 'app-route-fixture-1';

// (1) CONTROL -- reproduces the route's current defective line and its JSON.stringify output.
const naiveDoc = { id: seededId, ...seededData };
const naiveJson = JSON.parse(JSON.stringify({ applications: [naiveDoc] }));
const naiveSubmittedAt = naiveJson.applications[0].submittedAt;
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

// (2) THE GATE -- the fixed route's response shape: map each doc through the same
// serializeVendorApplication A1 already proves, JSON-round-trip the whole response the way
// NextResponse.json() would, and assert a proper ISO 8601 string comes out.
let serializeVendorApplication;
try {
  ({ serializeVendorApplication } = await import('../../../lib/firestore-serialization.ts'));
} catch (err) {
  failures.push(
    `GATE IMPORT FAILED: lib/firestore-serialization.ts's serializeVendorApplication could not ` +
      `be imported -- ${err instanceof Error ? err.message : String(err)}`,
  );
}

if (serializeVendorApplication) {
  let fixedResponseBody;
  try {
    const applications = [seededData].map((data) => serializeVendorApplication(seededId, data));
    fixedResponseBody = JSON.parse(JSON.stringify({ applications }));
  } catch (err) {
    failures.push(
      `GATE THREW while building the fixed route's JSON response -- ${err instanceof Error ? err.stack : String(err)}`,
    );
  }

  if (fixedResponseBody) {
    const gotSubmittedAt = fixedResponseBody.applications[0]?.submittedAt;
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
  console.error('FAIL: admin-vendor-listing-serialization A8 (GET /api/admin/vendors/applications JSON boundary)');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log('PASS: the fixed vendor-applications route response has no Firestore-internal-shape leak.');
process.exit(0);

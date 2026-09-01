#!/usr/bin/env node
// P0 contract admin-vendor-listing-serialization -- A1.
//
// Production crash (Cloud Logging, project saoc-webapp, service saoc-prod, revision
// saoc-prod-build-2026-09-01-002, 2026-09-01T19:38:50Z): "Only plain objects, and a few
// built-ins, can be passed to Client Components from Server Components. Classes or null
// prototypes are not supported." app/admin/vendors/applications/page.tsx's
// fetchVendorApplications() does `{ id: doc.id, ...data } as VendorApplication`, spreading
// raw Firestore document data whose submittedAt/reviewedAt/registrationToken*/
// registrationCode* fields arrive as `Timestamp` CLASS INSTANCES, straight into a prop
// handed to the 'use client' VendorApplicationReviewTable. Invisible while the collection
// was empty (an empty array serializes fine); activated the moment a real document existed.
//
// REVISION (2026-09-01, post-Codex GPT-5.5 finding): an earlier version of this check seeded
// only 3 of the 9 Timestamp-shaped fields VendorApplication actually carries
// (types/index.ts:857-888: submittedAt, reviewedAt, registrationTokenIssuedAt/ExpiresAt/
// ConsumedAt, registrationCodeIssuedAt/ExpiresAt/ConsumedAt/LockedAt) -- an implementation
// that only converts the fields it happens to know about would have passed that check while
// still crashing on any of the other 6. This fixture now seeds ALL NINE, every one non-null,
// so an allowlist implementation missing even one is caught. A2's fixture had the analogous
// gap for VendorSubmission (only submittedAt/reviewedAt of 8) and is fixed the same way.
//
// This check proves the REAL property against the REAL Timestamp class (firebase-admin's own
// export -- Timestamp.fromDate() needs no credential, no app init, no network; it is a pure
// value class), not a hand-rolled stand-in:
//
//   (1) CONTROL -- byte-identical to the current defective line in page.tsx (`{ id: doc.id,
//       ...data } as VendorApplication`). Asserts the naive spread DOES still carry real
//       Timestamp instances -- if this ever stops being true (e.g. a future firebase-admin
//       version changes Timestamp's shape), the check's whole premise is stale and this line
//       fails loudly rather than the check silently proving nothing.
//   (2) THE GATE -- imports the real, exported `serializeVendorApplication` from
//       lib/firestore-serialization.ts (relative import, explicit .ts extension, no `@/`
//       alias) and asserts its output for the SAME seeded document is Timestamp-instance-free
//       everywhere (recursive walk), has EVERY ONE of the 9 Timestamp-shaped fields as a real
//       `Date` instance, and is millisecond-exact against the source Timestamp (no precision
//       loss / no accidental timezone-string round-trip corruption).
//
// SEEDING, not an empty array, and not a representative subset: every Timestamp-shaped field
// on VendorApplication is populated and non-null in this fixture, specifically so a
// hardcoded-field-list implementation (this mission's actual, already-shipped defect --
// see lib/firestore-serialization.ts's own doc comment) cannot pass by converting only the
// fields it happens to name.
//
// RED proof (run against HEAD before the fix lands): lib/firestore-serialization.ts does not
// exist yet, so step (2)'s import throws `ERR_MODULE_NOT_FOUND` -- exit 1. Separately
// re-verified (architect pass, 2026-09-01) against a reconstruction of the actual shipped
// allowlist bug (VENDOR_APPLICATION_TIMESTAMP_FIELDS naming only 5 of the 9 fields) -- this
// widened fixture goes RED against it (registrationCodeIssuedAt etc. still Timestamp
// instances in the output), where the old 3-field fixture would have passed it.
//
// Run as: node --import tsx/esm contracts/checks/admin-vendor-listing-serialization/check-vendor-application-serialization.mjs

import { Timestamp } from 'firebase-admin/firestore';

const failures = [];

// Every Timestamp-shaped field VendorApplication carries (types/index.ts:857-888), each given
// its own source Date so a field-swap bug (e.g. reviewedAt accidentally reused for
// registrationCodeIssuedAt) would also be caught by the per-field millisecond-exact checks
// below.
const sourceDates = {
  submittedAt: new Date('2027-01-05T12:00:00.000Z'),
  reviewedAt: new Date('2027-01-06T09:30:00.000Z'),
  registrationTokenIssuedAt: new Date('2027-01-06T09:31:00.000Z'),
  registrationTokenExpiresAt: new Date('2027-01-13T09:31:00.000Z'),
  registrationTokenConsumedAt: new Date('2027-01-07T10:00:00.000Z'),
  registrationCodeIssuedAt: new Date('2027-01-06T09:32:00.000Z'),
  registrationCodeExpiresAt: new Date('2027-01-13T09:32:00.000Z'),
  registrationCodeConsumedAt: new Date('2027-01-07T10:05:00.000Z'),
  registrationCodeLockedAt: new Date('2027-01-06T09:40:00.000Z'),
};

// A real vendorApplications document as it actually arrives from `doc.data()` -- every
// Timestamp-shaped field POPULATED (not absent, not a representative subset), matching a
// genuinely reviewed, code-issued, code-locked application.
const seededData = {
  businessName: 'Cape Orchid Traders',
  tradingName: 'Cape Orchids',
  contactPersonName: 'Jane Vendor',
  contactEmail: 'jane@example.com',
  contactCellPhone: '0821234567',
  vendorCategory: ['orchids'],
  indicativeBoothCount: 2,
  status: 'approved',
  submittedAt: Timestamp.fromDate(sourceDates.submittedAt),
  reviewedBy: 'admin@saoc.co.za',
  reviewedAt: Timestamp.fromDate(sourceDates.reviewedAt),
  registrationTokenIssuedAt: Timestamp.fromDate(sourceDates.registrationTokenIssuedAt),
  registrationTokenExpiresAt: Timestamp.fromDate(sourceDates.registrationTokenExpiresAt),
  registrationTokenConsumedAt: Timestamp.fromDate(sourceDates.registrationTokenConsumedAt),
  registrationCodeId: 'cape-orchid-traders-4821',
  registrationCodeNameSlug: 'cape-orchid-traders',
  registrationCodeIssuedAt: Timestamp.fromDate(sourceDates.registrationCodeIssuedAt),
  registrationCodeExpiresAt: Timestamp.fromDate(sourceDates.registrationCodeExpiresAt),
  registrationCodeConsumedAt: Timestamp.fromDate(sourceDates.registrationCodeConsumedAt),
  registrationCodeFailedAttempts: 2,
  registrationCodeLockedAt: Timestamp.fromDate(sourceDates.registrationCodeLockedAt),
  registrationCodeGeneration: 1,
};
const seededId = 'app-fixture-1';

function findTimestampInstances(value, pathLabel, hits) {
  if (value === null || value === undefined) return;
  if (value instanceof Timestamp) {
    hits.push(pathLabel);
    return;
  }
  if (value instanceof Date) return; // supported built-in, not a defect
  if (Array.isArray(value)) {
    value.forEach((entry, i) => findTimestampInstances(entry, `${pathLabel}[${i}]`, hits));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      findTimestampInstances(entry, `${pathLabel}.${key}`, hits);
    }
  }
}

// (1) CONTROL -- reproduces page.tsx's current defective line exactly.
const naiveSpread = { id: seededId, ...seededData };
const controlHits = [];
findTimestampInstances(naiveSpread, 'naiveSpread', controlHits);
if (controlHits.length !== Object.keys(sourceDates).length) {
  failures.push(
    `CONTROL INVALID: expected the naive spread to carry all ${Object.keys(sourceDates).length} ` +
      `seeded Timestamp instances, found ${controlHits.length}: ${controlHits.join(', ')} -- ` +
      'this check\'s premise no longer holds; re-verify against the current firebase-admin version before trusting the gate below.',
  );
} else {
  console.log(`CONTROL OK: naive spread carries all ${controlHits.length} seeded Timestamp instances: ${controlHits.join(', ')}`);
}

// (2) THE GATE.
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
  let result;
  try {
    result = serializeVendorApplication(seededId, seededData);
  } catch (err) {
    failures.push(
      `GATE THREW: serializeVendorApplication(seededId, seededData) threw -- ${err instanceof Error ? err.stack : String(err)}`,
    );
  }

  if (result) {
    const gateHits = [];
    findTimestampInstances(result, 'result', gateHits);
    if (gateHits.length > 0) {
      failures.push(
        `GATE FAILED: serializeVendorApplication() output still carries Timestamp instance(s) at: ${gateHits.join(', ')} -- ` +
          'this would still throw crossing the Server->Client Component boundary. This is exactly the ' +
          'hardcoded-allowlist defect class Codex GPT-5.5 flagged -- a field this fixture seeds that the ' +
          'implementation does not know to convert.',
      );
    }

    for (const [field, sourceDate] of Object.entries(sourceDates)) {
      const got = result[field];
      if (!(got instanceof Date)) {
        failures.push(`GATE FAILED: result.${field} is not a Date instance (got ${typeof got}).`);
      } else if (got.getTime() !== sourceDate.getTime()) {
        failures.push(
          `GATE FAILED: result.${field} is not millisecond-exact -- expected ${sourceDate.toISOString()}, got ${got.toISOString()}.`,
        );
      }
    }

    if (result.id !== seededId) {
      failures.push(`GATE FAILED: result.id !== seededId (got ${JSON.stringify(result.id)}).`);
    }
    if (result.businessName !== seededData.businessName) {
      failures.push('GATE FAILED: non-Timestamp fields (e.g. businessName) were not preserved.');
    }
  }
}

if (failures.length > 0) {
  console.error('FAIL: admin-vendor-listing-serialization A1 (vendor applications listing)');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log(`PASS: serializeVendorApplication() converts all ${Object.keys(sourceDates).length} Timestamp-shaped fields, Timestamp-free, millisecond-exact.`);
process.exit(0);

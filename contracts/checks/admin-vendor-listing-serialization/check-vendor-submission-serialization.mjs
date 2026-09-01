#!/usr/bin/env node
// P0 contract admin-vendor-listing-serialization -- A2.
//
// The SECOND, unfixed, unexercised instance of the same defect proven by A1. Team-lead
// briefing: app/admin/vendors/page.tsx's fetchVendorSubmissions() has the identical
// `{ id: doc.id, ...data } as VendorSubmission` pattern, passed to the 'use client'
// VendorReviewTable. `vendorSubmissions` is empty today, so this page currently renders --
// but it will crash the instant the first vendor completes full registration, which is
// precisely the middle of the flow being demoed. Fixing only the crashing applications-list
// page and leaving this one would ship a landmine at the very next step of the same flow.
//
// REVISION (2026-09-01, post-Codex GPT-5.5 finding): Codex reviewed the landed diff and found
// `lib/firestore-serialization.ts` shipped with `VENDOR_SUBMISSION_TIMESTAMP_FIELDS =
// ['submittedAt', 'reviewedAt'] as const` -- a hardcoded allowlist that silently missed SEVEN
// more Date-typed fields VendorSubmission actually carries (types/index.ts:765-807):
// logoUploadedAt, productPhoto1UploadedAt, productPhoto2UploadedAt, productPhoto3UploadedAt,
// proofOfPaymentUploadedAt, paymentConfirmedAt. Any submission with one of THOSE populated --
// marketing uploads, proof of payment, payment confirmed: precisely the middle of the
// registration flow being demoed -- would still crash VendorReviewTable. The prior version of
// this check seeded only submittedAt/reviewedAt and could not have caught this: an
// implementation shaped exactly like the check's own fixture passes trivially regardless of
// what it does with fields the fixture never exercises. This fixture now seeds ALL EIGHT.
//
// Same three-part structure as check-vendor-application-serialization.mjs: (1) a control that
// reproduces the current defective spread and proves it still carries every seeded Timestamp
// instance; (2) the gate, against the real `serializeVendorSubmission` export from
// lib/firestore-serialization.ts (relative import, explicit .ts extension); (3) millisecond-
// exact Date fidelity for every one of the 8 Timestamp-shaped fields.
//
// RED proof (run against HEAD before the fix lands): lib/firestore-serialization.ts does not
// exist yet, so step (2)'s import throws `ERR_MODULE_NOT_FOUND` -- exit 1. Separately
// re-verified (architect pass, 2026-09-01) against a reconstruction of the actual shipped
// allowlist bug: this widened fixture goes RED against it (logoUploadedAt etc. still
// Timestamp instances in the output), where the old 2-field fixture would have passed it.
//
// Run as: node --import tsx/esm contracts/checks/admin-vendor-listing-serialization/check-vendor-submission-serialization.mjs

import { Timestamp } from 'firebase-admin/firestore';

const failures = [];

// Every Timestamp-shaped field VendorSubmission carries (types/index.ts:765-807), each given
// its own source Date so a field-swap bug would also be caught by the per-field checks below.
const sourceDates = {
  submittedAt: new Date('2027-02-10T08:00:00.000Z'),
  reviewedAt: new Date('2027-02-11T14:15:00.000Z'),
  logoUploadedAt: new Date('2027-02-09T10:00:00.000Z'),
  productPhoto1UploadedAt: new Date('2027-02-09T10:05:00.000Z'),
  productPhoto2UploadedAt: new Date('2027-02-09T10:06:00.000Z'),
  productPhoto3UploadedAt: new Date('2027-02-09T10:07:00.000Z'),
  proofOfPaymentUploadedAt: new Date('2027-02-12T09:00:00.000Z'),
  paymentConfirmedAt: new Date('2027-02-12T11:00:00.000Z'),
};

// A real vendorSubmissions document as it actually arrives from `doc.data()` -- every
// Timestamp-shaped field POPULATED, matching a genuinely reviewed, fully-uploaded, paid
// registration (the exact document shape the flow reaches at demo time).
const seededData = {
  businessName: 'Stellenbosch Orchid Nursery',
  contactPersonName: 'Pieter Vendor',
  contactCellPhone: '0837654321',
  contactEmail: 'pieter@example.com',
  physicalAddress: '1 Show Road, Stellenbosch',
  emergencyContactName: 'Anna Vendor',
  emergencyContactCellPhone: '0821112222',
  vendorCategory: ['orchids'],
  productDescription: 'Cattleya and vanda hybrids.',
  powerRequired: true,
  status: 'approved',
  submittedAt: Timestamp.fromDate(sourceDates.submittedAt),
  reviewedBy: 'admin@saoc.co.za',
  reviewedAt: Timestamp.fromDate(sourceDates.reviewedAt),
  logoUploadedAt: Timestamp.fromDate(sourceDates.logoUploadedAt),
  productPhoto1UploadedAt: Timestamp.fromDate(sourceDates.productPhoto1UploadedAt),
  productPhoto2UploadedAt: Timestamp.fromDate(sourceDates.productPhoto2UploadedAt),
  productPhoto3UploadedAt: Timestamp.fromDate(sourceDates.productPhoto3UploadedAt),
  proofOfPaymentUploadedAt: Timestamp.fromDate(sourceDates.proofOfPaymentUploadedAt),
  paymentConfirmedAt: Timestamp.fromDate(sourceDates.paymentConfirmedAt),
};
const seededId = 'sub-fixture-1';

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
      'this check\'s premise no longer holds; re-verify against the current firebase-admin version.',
  );
} else {
  console.log(`CONTROL OK: naive spread carries all ${controlHits.length} seeded Timestamp instances: ${controlHits.join(', ')}`);
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
  let result;
  try {
    result = serializeVendorSubmission(seededId, seededData);
  } catch (err) {
    failures.push(
      `GATE THREW: serializeVendorSubmission(seededId, seededData) threw -- ${err instanceof Error ? err.stack : String(err)}`,
    );
  }

  if (result) {
    const gateHits = [];
    findTimestampInstances(result, 'result', gateHits);
    if (gateHits.length > 0) {
      failures.push(
        `GATE FAILED: serializeVendorSubmission() output still carries Timestamp instance(s) at: ${gateHits.join(', ')} -- ` +
          'this would still throw crossing the Server->Client Component boundary. This is exactly the ' +
          'hardcoded-allowlist defect Codex GPT-5.5 found -- a field this fixture seeds that the ' +
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

// A reviewedAt of null (a submission awaiting first review) must stay null, never become an
// Invalid Date or crash the serializer -- separate seed, same gate, run inline rather than as
// a third file for speed (P0).
if (serializeVendorSubmission) {
  const pendingData = { ...seededData, reviewedBy: null, reviewedAt: null };
  let pendingResult;
  try {
    pendingResult = serializeVendorSubmission('sub-fixture-2', pendingData);
  } catch (err) {
    failures.push(
      `GATE THREW on a null reviewedAt (pending submission): ${err instanceof Error ? err.stack : String(err)}`,
    );
  }
  if (pendingResult && pendingResult.reviewedAt !== null) {
    failures.push(
      `GATE FAILED: a null-valued reviewedAt should stay null, got ${JSON.stringify(pendingResult.reviewedAt)}.`,
    );
  }
}

if (failures.length > 0) {
  console.error('FAIL: admin-vendor-listing-serialization A2 (vendor submissions listing -- the unexercised landmine)');
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log(`PASS: serializeVendorSubmission() converts all ${Object.keys(sourceDates).length} Timestamp-shaped fields, Timestamp-free, millisecond-exact.`);
process.exit(0);

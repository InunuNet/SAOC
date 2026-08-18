#!/usr/bin/env node
// F4 (vendor-registration) — buildVendorSubmission() must ALWAYS set status:'submitted' and
// submittedAt:now, even when a maliciously-crafted raw input object (simulated with an `as any`
// -equivalent JS call, since a real HTTP POST body arrives as `unknown` regardless of what the
// TypeScript signature says) contains status:'approved' and an unrelated submittedAt/id. Proves
// a submitter cannot self-approve or backdate their own submission by including those keys.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f4-submissions-model/check-status-cannot-be-forged.mjs

import { buildVendorSubmission } from '../../../lib/vendor-submissions.ts';

const failures = [];
const NOW = new Date('2027-02-14T09:30:00Z');

const MINIMAL_DRAFT = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

// Simulates a raw POST body that includes keys VendorSubmissionDraft does not declare — the JS
// runtime does not enforce TypeScript's structural typing, so this is exactly what a crafted
// HTTP request body would look like by the time it reaches buildVendorSubmission().
const FORGED_INPUT = {
  ...MINIMAL_DRAFT,
  status: 'approved',
  submittedAt: new Date('2020-01-01T00:00:00Z'),
  id: 'attacker-chosen-id',
};

const built = buildVendorSubmission(FORGED_INPUT, NOW);

if (built.status !== 'submitted') {
  failures.push(`status: expected "submitted" regardless of forged input, got ${JSON.stringify(built.status)}.`);
}

if (!(built.submittedAt instanceof Date) || built.submittedAt.getTime() !== NOW.getTime()) {
  failures.push(
    `submittedAt: expected the injected now (${NOW.toISOString()}), got ${JSON.stringify(built.submittedAt)} ` +
      '-- a forged submittedAt in the raw input must never survive into the built document.',
  );
}

if ('id' in built) {
  failures.push(
    `id: buildVendorSubmission()'s return value must not carry an "id" field at all (Firestore assigns it on ` +
      `.add()) -- got ${JSON.stringify(built.id)}, a forged id from the raw input may have leaked through.`,
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: buildVendorSubmission() always forces status:"submitted" and submittedAt:now and never ' +
    'produces an "id" field, even when the raw input object is crafted to contain status:"approved", ' +
    'a backdated submittedAt, and an attacker-chosen id.',
);
process.exit(0);

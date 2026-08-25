#!/usr/bin/env node
// F4 (vendor-registration) — proves regulatory permit fields (phytosanitary, CITES, food
// handling) carry NO format validation and NO cross-field conditional requirement against
// vendorCategory, per the mission's F9 scope note ("collected, not validated" is a deliberate
// posture, not an oversight). Also statically confirms no verification/lookup function or
// outbound HTTP call was added to lib/vendor-submissions.ts.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f4-submissions-model/check-regulatory-fields-unvalidated.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { validateVendorSubmissionInput, buildVendorSubmission } from '../../../lib/vendor-submissions.ts';

const failures = [];
const NOW = new Date('2027-02-14T09:30:00Z');

const MINIMAL = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  emergencyContactName: 'Peter Vendor',
  emergencyContactCellPhone: '0829876543',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

// (a) A 'books'-only vendor submitting an arbitrary, non-numeric CITES permit string must be
// accepted unchanged -- no "books don't need CITES" rejection, no format check.
{
  const input = {
    ...MINIMAL,
    vendorCategory: ['books'],
    citesPermitNumber: 'this is not a permit number at all, just free text ###',
  };
  const validation = validateVendorSubmissionInput(input);
  if (validation.valid !== true) {
    failures.push(
      `(a) books-only vendor with arbitrary citesPermitNumber text: expected valid:true, got ` +
        `valid:${validation.valid}, errors:${JSON.stringify(validation.errors)}.`,
    );
  }
  const built = buildVendorSubmission(input, NOW);
  if (built.citesPermitNumber !== input.citesPermitNumber) {
    failures.push(
      `(a) citesPermitNumber was altered: got ${JSON.stringify(built.citesPermitNumber)}, expected the ` +
        `verbatim input string (no sanitize-and-continue reformatting).`,
    );
  }
}

// (b) All three permit fields omitted entirely, for a rare-exotic-plants + food-retailer
// vendor (the categories that would most plausibly need them), must still be accepted -- none
// of the three is a required field regardless of category.
{
  const input = { ...MINIMAL, vendorCategory: ['rare-exotic-plants', 'food-retailer'] };
  const validation = validateVendorSubmissionInput(input);
  if (validation.valid !== true) {
    failures.push(
      `(b) rare-exotic-plants + food-retailer vendor omitting all three permit fields: expected valid:true, ` +
        `got valid:${validation.valid}, errors:${JSON.stringify(validation.errors)}.`,
    );
  }
}

// (c) Static source check: lib/vendor-submissions.ts must contain no verification/lookup
// function targeting the permit fields, and no outbound HTTP call.
{
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sourcePath = join(__dirname, '../../../lib/vendor-submissions.ts');
  const source = readFileSync(sourcePath, 'utf8');

  const verbPattern = /(verify|lookup|check)\w*(phytosanitary|cites|permit)/i;
  if (verbPattern.test(source)) {
    failures.push(
      '(c) lib/vendor-submissions.ts contains a function name matching verify/lookup/check paired with ' +
        'phytosanitary/cites/permit -- no verification integration should exist in F4.',
    );
  }

  if (/\bfetch\s*\(/.test(source) || /\baxios\b/.test(source)) {
    failures.push(
      '(c) lib/vendor-submissions.ts makes an outbound fetch()/axios call -- this module must remain pure, ' +
        'no network, per the golden README.',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: regulatory permit fields accept arbitrary unvalidated text regardless of vendorCategory, ' +
    'are never required, and lib/vendor-submissions.ts contains no verification/lookup logic or ' +
    'outbound HTTP call.',
);
process.exit(0);

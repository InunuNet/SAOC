#!/usr/bin/env node
// F4 (vendor-registration-form-rebuild) — THE BREAKING-RENAME PROOF for the boothType enum
// correction. Real calls to validateVendorSubmissionInput() (never a source-grep of
// VENDOR_BOOTH_TYPES, which isn't exported) prove:
//
//   (a) both UNRENAMED values ('corner', 'end-of-row') still validate with ZERO errors,
//       individually and combined -- proving neither was accidentally touched by the rename;
//   (b) both NEW/renamed-target values ('standard-in-row', 'no-preference') now validate with
//       zero errors -- proving the correction actually happened;
//   (c) the OLD value ('standard') is now REJECTED, naming "boothType" in the error -- the
//       deliberate breaking-change proof, the mirror image of F3's old-value-preservation
//       proof. This is what makes this a RENAME, not a widening: F3's own check proves its old
//       values keep validating; this check proves this feature's old value stops validating.
//   (d) a full payload combining 'standard-in-row' with every one of F1's ten already-staged
//       Section 4/6 fields validates as valid:true with zero errors;
//   (e) the two golden VendorRegisterFormState JSON fixtures already living in this repo
//       (contracts/checks/vendor-form-ui/fixtures/form-state-full.fixture.json, using
//       boothType:'corner', and form-state-minimal.fixture.json, using boothType:''), run
//       through the REAL buildVendorRegistrationPayload() then validateVendorSubmissionInput(),
//       still validate as valid:true with zero errors after this feature -- the concrete
//       ripple-sweep proof that neither already-shipped golden payload used the renamed
//       'standard' value, so this feature's rename did not collaterally break either.
//
// Defeating mutation: keeping 'standard' alive alongside the new values (a non-breaking
// widening masquerading as the required rename), failing to add 'no-preference', or
// renaming/removing 'corner' or 'end-of-row'.
//
// Run as:
//   node --import tsx/esm .agent/memory/project/specs/vendor-registration-form-rebuild/checks/check-f4-boothtype-renamed-and-validated.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { validateVendorSubmissionInput } from '../../../../../../lib/vendor-submissions.ts';
import { buildVendorRegistrationPayload } from '../../../../../../lib/vendor-register-form-payload.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../../..');

const failures = [];
function fail(msg) {
  failures.push(msg);
}

const MINIMAL = {
  businessName: 'Cape Orchid Nursery',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  emergencyContactName: 'Sipho Dlamini',
  emergencyContactCellPhone: '0834445555',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  boothCount: 1,
  powerRequired: true,
  termsAccepted: true,
};

const UNRENAMED_VALUES = ['corner', 'end-of-row'];
const NEW_VALUES = ['standard-in-row', 'no-preference'];

// (a) Every unrenamed value, individually, must still validate.
for (const value of UNRENAMED_VALUES) {
  const result = validateVendorSubmissionInput({ ...MINIMAL, boothType: value });
  if (!result.valid) {
    fail(
      `(a) pre-existing, unrenamed boothType "${value}" must still validate with zero errors -- got: ${result.errors.join('; ')}`,
    );
  }
}

// (b) Both new values, individually, must now validate.
for (const value of NEW_VALUES) {
  const result = validateVendorSubmissionInput({ ...MINIMAL, boothType: value });
  if (!result.valid) {
    fail(
      `(b) new boothType "${value}" must validate with zero errors -- got: ${result.errors.join('; ')}`,
    );
  }
}

// (c) THE BREAKING-CHANGE PROOF: the OLD value 'standard' must now be REJECTED.
{
  const result = validateVendorSubmissionInput({ ...MINIMAL, boothType: 'standard' });
  if (result.valid) {
    fail(
      "(c) the OLD boothType value 'standard' must be REJECTED after this feature's rename -- validateVendorSubmissionInput returned valid:true instead. This proves the change stayed a non-breaking widening rather than the required rename.",
    );
  } else if (!result.errors.some((e) => e.toLowerCase().includes('boothtype'))) {
    fail(
      `(c) rejecting the old boothType value 'standard' must name "boothType" in the error -- got: ${result.errors.join('; ')}`,
    );
  }
}

// (d) A full Section 4/6 payload, using the renamed 'standard-in-row' value plus every one of
// F1's ten already-staged optional fields, must validate as valid:true with zero errors.
{
  const full = {
    ...MINIMAL,
    boothType: 'standard-in-row',
    boothPositionRequest: 'Prefer near the entrance if possible.',
    adjacentBoothRequested: true,
    adjacentBoothVendorName: 'Stellenbosch Orchid Growers',
    specialDisplayRequirements: 'Need a raised display shelf for hanging baskets.',
    electricalOutletsRequired: 3,
    electricalEquipmentList: '2x display lights, 1x small fridge',
    electricalEquipmentContinuousOperation: true,
    electricalEquipmentContinuousDetails: 'Fridge runs continuously for cut-flower stock.',
    waterIntendedUse: 'Rinsing cut flowers and topping up display vases.',
    wastewaterDrainageRequired: true,
    wastewaterDrainageDetails: 'Small basin, emptied manually into venue drain point.',
  };
  const result = validateVendorSubmissionInput(full);
  if (!result.valid) {
    fail(
      `(d) a full Section 4/6 payload using 'standard-in-row' plus every F1-staged field must validate with zero errors -- got: ${result.errors.join('; ')}`,
    );
  }
}

// (e) The two golden VendorRegisterFormState JSON fixtures (contracts/checks/vendor-form-ui),
// run through the REAL buildVendorRegistrationPayload() then validateVendorSubmissionInput(),
// must still validate as valid:true -- neither uses the renamed 'standard' value, so this is the
// concrete ripple-sweep proof this feature's rename did not break either.
{
  const fixtureNames = ['form-state-full.fixture.json', 'form-state-minimal.fixture.json'];
  for (const fixtureName of fixtureNames) {
    const fixturePath = path.join(
      REPO_ROOT,
      'contracts/checks/vendor-form-ui/fixtures',
      fixtureName,
    );
    const state = JSON.parse(readFileSync(fixturePath, 'utf8'));
    if (state.boothType === 'standard') {
      fail(
        `(e) ${fixtureName} unexpectedly uses the renamed-away boothType value 'standard' -- this golden fixture needs updating as part of a deliberate, separate change, not silently by this check.`,
      );
      continue;
    }
    const payload = buildVendorRegistrationPayload(state);
    const result = validateVendorSubmissionInput(payload);
    if (!result.valid) {
      fail(
        `(e) golden fixture ${fixtureName} (boothType: ${JSON.stringify(state.boothType)}) must still validate as valid:true after F4's boothType rename -- got: ${result.errors.join('; ')}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL (${failures.length}):\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(
  'PASS: VendorBoothType was renamed (not widened) -- corner/end-of-row survive, standard-in-row/no-preference validate, the old "standard" value is rejected, and both golden vendor-form-ui fixtures still validate end-to-end.',
);

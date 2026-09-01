#!/usr/bin/env node
// M2 follow-up (vendor-gated-registration-flow) -- proves electricalEquipmentEntries and
// gasEquipmentEntries are not mass-assignable at the row level. Codex found, architect
// confirmed at lib/vendor-submissions.ts:1107-1108: buildVendorSubmission() persists
// `input.electricalEquipmentEntries` / `input.gasEquipmentEntries` straight from raw input,
// while validateElectricalEquipmentEntries/validateGasEquipmentEntries (~lines 714-782) only
// inspect the known per-row keys (equipment/wattage/runningTimePerDay/quantity and
// equipmentType/gasType/cylinderSize/cylinderCount) -- they check that those keys are present
// and well-formed, but never strip a row down to only those keys. An unauthenticated caller on
// the public POST /api/vendors/register route can attach arbitrary extra keys to each row
// (e.g. a forged "priority" or "internalNote" field) and have them written verbatim to
// Firestore. This is the SAME defect class check-status-cannot-be-forged.mjs and
// check-zero-authorization.mjs already guard for at the top level of the submission -- this
// check is the one-level-of-nesting sibling, run through the REAL validate + build pipeline
// end to end (not a source grep), exactly as those two do.
//
// FAILS ON: a forged extra key on any electricalEquipmentEntries or gasEquipmentEntries row
// surviving into the object buildVendorSubmission() returns.
//
// Run as: npx tsx contracts/checks/vendor-f4-submissions-model/check-equipment-entries-mass-assignment.mjs

import {
  validateVendorSubmissionInput,
  buildVendorSubmission,
} from '../../../lib/vendor-submissions.ts';

const failures = [];
const NOW = new Date('2027-02-14T09:30:00Z');

// A minimal, otherwise-fully-valid raw input -- every field validateVendorSubmissionInput
// actually requires, per lib/vendor-submissions.ts, mirroring
// check-water-required-validated.mjs's baseInput().
function baseInput() {
  return {
    businessName: 'Test Orchid Traders',
    contactPersonName: 'Jane Test',
    contactCellPhone: '0821234567',
    contactEmail: 'jane.test@example.com',
    productDescription: 'Assorted cymbidium and cattleya orchids.',
    physicalAddress: '123 Orchid Lane, Cape Town',
    emergencyContactName: 'John Test',
    emergencyContactCellPhone: '0837654321',
    vendorCategory: ['orchids'],
    boothCount: 1,
    boothSize: 'single',
    powerRequired: false,
    termsAccepted: true,
    // Legitimate, well-formed rows -- every key each validator actually checks, plus one
    // forged extra key per row that neither validator names anywhere.
    electricalEquipmentEntries: [
      {
        equipment: 'Fridge',
        quantity: 1,
        wattage: '150W',
        runningTimePerDay: '8 hours',
        priority: 'attacker-injected', // forged -- not a real field on this row shape
        internalNote: 'should never persist', // forged -- not a real field on this row shape
      },
    ],
    gasEquipmentEntries: [
      {
        equipmentType: 'Gas burner',
        gasType: 'LPG',
        cylinderSize: '9kg',
        cylinderCount: 2,
        approved: true, // forged -- attempts to smuggle an approval-flavoured flag onto a row
        vendorNotes: 'should never persist', // forged -- not a real field on this row shape
      },
    ],
  };
}

const input = baseInput();

// (1) The real validator must accept this input -- if it rejects, the forged-key proof below
// is meaningless (nothing would ever reach buildVendorSubmission in production either).
const validation = validateVendorSubmissionInput(input);
if (validation.valid !== true) {
  failures.push(
    'SETUP FAILURE: validateVendorSubmissionInput rejected an otherwise well-formed input -- ' +
      `errors: ${JSON.stringify(validation.errors)}. Cannot prove the mass-assignment property ` +
      'against an input the real pipeline would never accept in the first place.',
  );
} else {
  const built = buildVendorSubmission(input, NOW);

  const electricalRow = Array.isArray(built.electricalEquipmentEntries)
    ? built.electricalEquipmentEntries[0]
    : undefined;
  if (!electricalRow) {
    failures.push(
      'SETUP FAILURE: built.electricalEquipmentEntries[0] is missing -- cannot inspect the row ' +
        'for forged keys.',
    );
  } else {
    for (const forgedKey of ['priority', 'internalNote']) {
      if (Object.prototype.hasOwnProperty.call(electricalRow, forgedKey)) {
        failures.push(
          `electricalEquipmentEntries[0] carries forged key "${forgedKey}" ` +
            `(value ${JSON.stringify(electricalRow[forgedKey])}) in the built submission -- ` +
            'buildVendorSubmission() must persist only the validated per-row keys ' +
            '(equipment/quantity/wattage/runningTimePerDay), not the raw row object.',
        );
      }
    }
  }

  const gasRow = Array.isArray(built.gasEquipmentEntries)
    ? built.gasEquipmentEntries[0]
    : undefined;
  if (!gasRow) {
    failures.push(
      'SETUP FAILURE: built.gasEquipmentEntries[0] is missing -- cannot inspect the row for ' +
        'forged keys.',
    );
  } else {
    for (const forgedKey of ['approved', 'vendorNotes']) {
      if (Object.prototype.hasOwnProperty.call(gasRow, forgedKey)) {
        failures.push(
          `gasEquipmentEntries[0] carries forged key "${forgedKey}" ` +
            `(value ${JSON.stringify(gasRow[forgedKey])}) in the built submission -- ` +
            'buildVendorSubmission() must persist only the validated per-row keys ' +
            '(equipmentType/gasType/cylinderSize/cylinderCount), not the raw row object.',
        );
      }
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: forged extra keys on electricalEquipmentEntries/gasEquipmentEntries rows do not ' +
    'survive into the object buildVendorSubmission() returns.',
);
process.exit(0);

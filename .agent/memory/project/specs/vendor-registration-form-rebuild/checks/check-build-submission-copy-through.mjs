#!/usr/bin/env node
// F1 (vendor-registration-form-rebuild) — real calls to buildVendorSubmission(): every one of
// F1's forty-five new fields, when present on the input, survives into the built document
// verbatim (proves an explicit field-by-field copy was extended, not that a `{ ...input }`
// spread happens to work); a field OMITTED from the input is `undefined` on the output, never
// silently defaulted to some other value; and status/submittedAt are still forced by the
// function regardless of anything the raw input claims (F4's own forgery-resistance property,
// unweakened by F1's additions).
//
// Run as:
//   node --import tsx/esm .agent/memory/project/specs/vendor-registration-form-rebuild/checks/check-build-submission-copy-through.mjs

import { buildVendorSubmission } from '../../../../../../lib/vendor-submissions.ts';

const failures = [];
function fail(msg) {
  failures.push(msg);
}

const NOW = new Date('2027-01-15T10:00:00.000Z');

const BASE = {
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

// (1) Every new field present on the input must survive verbatim onto the built document.
const NEW_FIELD_VALUES = {
  tradingNameSameAsBusiness: true,
  businessEntityType: 'sole-proprietor',
  businessEntityTypeOther: undefined,
  vatRegistered: false,
  countryOfBusinessRegistration: 'South Africa',
  postalAddressSameAsPhysical: false,
  postalAddress: '2 Fern Street, Cape Town',
  contactPosition: 'Director',
  alternativeContactNumber: '0219876543',
  accountsContactName: 'John Accounts',
  accountsContactEmail: 'accounts@capeorchid.example',
  emergencyContactName: 'Sipho Dlamini',
  emergencyContactRelationship: 'Business partner',
  emergencyContactCellPhone: '0834445555',
  sellsLivePlants: true,
  livePlantTypes: ['orchids', 'seeds'],
  livePlantTypesOther: undefined,
  plantsImportedForEvent: true,
  importCountryOfOrigin: 'Thailand',
  citesListedSpecies: true,
  foodHealthTradingDocumentation: 'On file.',
  boothPositionRequest: 'Near the main entrance',
  adjacentBoothRequested: true,
  adjacentBoothVendorName: 'Orchid Supplies Co.',
  specialDisplayRequirements: 'Overhead hanging rail.',
  electricalOutletsRequired: 2,
  electricalEquipmentList: 'Misting fan (1x)',
  electricalEquipmentContinuousOperation: true,
  electricalEquipmentContinuousDetails: 'Runs continuously.',
  waterIntendedUse: 'Watering can refills',
  wastewaterDrainageRequired: false,
  wastewaterDrainageDetails: undefined,
  gasOrHeatEquipmentUsed: true,
  gasEquipmentType: 'Gas burner',
  gasFuelType: 'LPG',
  gasCylinderSize: '9kg',
  gasCylinderCount: 2,
  gasSafetyInformation: 'SANS-compliant regulator fitted.',
  foodPreparationOnSite: true,
  foodCookingOnSite: false,
  staffCountSetupDay: 2,
  staffCountDay1: 3,
  staffCountDay2: 3,
  staffCountDay3: 3,
  staffCountBreakdownDay: 2,
  exhibitorPassesRequired: true,
  exhibitorPassesCount: 3,
  vehicleType: 'panel-van',
  vehicleTypeOther: undefined,
  vehicleHeight: '2.1m',
  vehicleLength: '5.5m',
  trailerAttached: false,
  storageRiskAcknowledged: true,
  wasteTypes: ['plant-material', 'cardboard-packaging'],
  wasteTypesOther: undefined,
  specialWasteRequirements: 'Compost bin required.',
  hasPublicLiabilityInsurance: true,
  productLiabilityInsuranceStatus: 'not-applicable',
};

const input = { ...BASE, ...NEW_FIELD_VALUES };
const built = buildVendorSubmission(input, NOW);

for (const [key, expected] of Object.entries(NEW_FIELD_VALUES)) {
  const actual = built[key];
  const match = Array.isArray(expected)
    ? JSON.stringify(actual) === JSON.stringify(expected)
    : actual === expected;
  if (!match) {
    fail(`(1) field "${key}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
}

// (2) A field genuinely OMITTED from the input must be `undefined` on the output -- proves the
// copy is field-by-field (each key independently `input.x`), not a default-filling spread.
{
  const minimalBuilt = buildVendorSubmission(BASE, NOW);
  const omittedKeys = Object.keys(NEW_FIELD_VALUES);
  for (const key of omittedKeys) {
    if (minimalBuilt[key] !== undefined) {
      fail(`(2) field "${key}" omitted from input but built document has ${JSON.stringify(minimalBuilt[key])}, expected undefined.`);
    }
  }
}

// (3) status/submittedAt are still forced by the function, and a forged status/submittedAt/id
// on the raw input is still ignored -- F4's own forgery-resistance property, re-proven after
// F1's additions to make sure the explicit-copy list wasn't accidentally swapped for a spread.
{
  const forged = {
    ...BASE,
    status: 'approved',
    submittedAt: new Date('2020-01-01T00:00:00.000Z'),
    id: 'forged-id',
  };
  const builtForged = buildVendorSubmission(forged, NOW);
  if (builtForged.status !== 'submitted') {
    fail(`(3a) status: expected forced 'submitted', got ${JSON.stringify(builtForged.status)}.`);
  }
  if (builtForged.submittedAt?.getTime() !== NOW.getTime()) {
    fail(`(3b) submittedAt: expected the injected NOW, got ${JSON.stringify(builtForged.submittedAt)}.`);
  }
  if ('id' in builtForged) {
    fail('(3c) built document must never carry an "id" key at all.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: every new F1 field present on the input survives verbatim into the built document; ' +
    'an omitted new field is undefined on the output, never defaulted; status/submittedAt stay ' +
    "forced and a forged id/status/submittedAt on the raw input is still ignored.",
);
process.exit(0);

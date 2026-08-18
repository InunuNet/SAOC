#!/usr/bin/env node
// F4 (vendor-registration) — a real call to buildVendorSubmission() with all 31 form fields
// populated with DISTINCT, non-placeholder values must round-trip every one of them unchanged.
// Each field is asserted individually against its own distinct input value — not a single
// deep-equal against a pre-baked expected object, which could share the same bug as the
// implementation (e.g. both forget the same field).
//
// Run as: node --import tsx/esm contracts/checks/vendor-f4-submissions-model/check-full-round-trip.mjs

import { buildVendorSubmission } from '../../../lib/vendor-submissions.ts';

const failures = [];
const NOW = new Date('2027-02-14T09:30:00Z');

const FULL_DRAFT = {
  businessName: 'Cape Orchid Nursery',
  tradingName: 'Cape Orchids',
  contactPersonName: 'Jane Vendor',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  cipcNumber: '2020/123456/07',
  vatNumber: '4123456789',
  website: 'https://capeorchid.example',
  socialMediaHandle: '@capeorchidnursery',
  vendorCategory: ['plant-sales', 'rare-exotic-plants', 'other'],
  productDescription: 'Cattleya and Cymbidium hybrids, plus rare Asian species.',
  phytosanitaryPermitNumber: 'PHYTO-2027-001',
  citesPermitNumber: 'CITES-2027-002',
  foodHandlingCertificateNumber: 'FOOD-2027-003',
  foodItemList: 'Coffee, biltong, koeksisters',
  boothCount: 2,
  boothType: 'corner',
  tableCount: 2,
  chairCount: 4,
  powerRequired: true,
  electricalLoad: '15A single phase',
  waterRequired: false,
  staffPerDay: 3,
  vehicleRegistrations: 'CA 123-456',
  loadInSlot: 'Friday 07:00-09:00',
  loadOutSlot: 'Sunday 17:00-19:00',
  bio: 'Cape Orchid Nursery has grown award-winning Cattleya hybrids since 1998.',
  paymentMethodsAccepted: ['card', 'eft'],
  paymentReference: 'EFT-REF-00123',
  termsAccepted: true,
};

const built = buildVendorSubmission(FULL_DRAFT, NOW);

function expectField(field, expected) {
  const actual = built[field];
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures.push(`field "${field}": got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}.`);
  }
}

for (const [field, expected] of Object.entries(FULL_DRAFT)) {
  expectField(field, expected);
}

expectField('status', 'submitted');
expectField('submittedAt', NOW);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: buildVendorSubmission() round-trips all 31 form fields unchanged from a fully-' +
    'populated draft, and sets status:"submitted" and submittedAt to the injected now.',
);
process.exit(0);

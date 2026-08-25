#!/usr/bin/env node
// F2 (vendor-registration-form-rebuild) — real calls to buildVendorRegistrationPayload() prove
// the three new leak-proof render-gate + payload-exclusion guards actually exclude their
// dependent field's value from the wire payload when the "same as" / "not registered" condition
// is set, even when the dependent field still holds a stale typed value. This is the same
// leak-proofing property isElectricalLoadApplicable/isFoodRetailer already have; this check
// proves the three NEW gates (isTradingNameFieldApplicable, isPostalAddressFieldApplicable,
// isVatNumberFieldApplicable) have it too.
//
// Run as:
//   node --import tsx/esm .agent/memory/project/specs/vendor-registration-form-rebuild/checks/check-f2-payload-gates.mjs

import { buildVendorRegistrationPayload } from '../../../../../../lib/vendor-register-form-payload.ts';

const failures = [];

function fail(msg) {
  failures.push(msg);
}

const BASE_STATE = {
  businessName: 'Cape Orchid Nursery',
  tradingName: 'Cape Orchids',
  tradingNameSameAsBusiness: false,
  contactPersonName: 'Jane Vendor',
  contactPosition: 'Owner',
  contactCellPhone: '0821234567',
  contactEmail: 'jane@capeorchid.example',
  alternativeContactNumber: '0839876543',
  accountsContactName: 'Accounts Person',
  accountsContactEmail: 'accounts@capeorchid.example',
  physicalAddress: '1 Orchid Way, Stellenbosch',
  postalAddress: '2 Orchid Way, Stellenbosch',
  postalAddressSameAsPhysical: false,
  businessEntityType: 'sole-proprietor',
  businessEntityTypeOther: '',
  cipcNumber: '2020/123456/07',
  vatRegistered: 'true',
  vatNumber: '4123456789',
  countryOfBusinessRegistration: 'South Africa',
  website: '',
  socialMediaHandle: '',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  phytosanitaryPermitNumber: '',
  citesPermitNumber: '',
  foodHandlingCertificateNumber: '',
  foodItemList: '',
  boothCount: '1',
  boothType: '',
  tableCount: '',
  chairCount: '',
  powerRequired: 'true',
  electricalLoad: '',
  waterRequired: '',
  staffPerDay: '',
  vehicleRegistrations: '',
  loadInSlot: '',
  loadOutSlot: '',
  bio: '',
  paymentMethodsAccepted: [],
  paymentReference: '',
  termsAccepted: true,
  emergencyContactName: 'John Vendor',
  emergencyContactRelationship: 'Spouse',
  emergencyContactCellPhone: '0827654321',
};

// (1) tradingNameSameAsBusiness:true must omit tradingName from the payload even though the
// state still holds a stale typed value -- proves the gate is checked at build time, not merely
// used to clear the input on the client.
{
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, tradingNameSameAsBusiness: true });
  if (payload.tradingName !== undefined) {
    fail(
      `tradingNameSameAsBusiness:true must omit tradingName from the payload; got ${JSON.stringify(payload.tradingName)}.`,
    );
  }
  if (payload.tradingNameSameAsBusiness !== true) {
    fail('tradingNameSameAsBusiness:true must still be sent as true on the payload.');
  }
}

// (2) tradingNameSameAsBusiness:false must still send the real typed tradingName.
{
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, tradingNameSameAsBusiness: false });
  if (payload.tradingName !== 'Cape Orchids') {
    fail(`tradingNameSameAsBusiness:false must send the typed tradingName; got ${JSON.stringify(payload.tradingName)}.`);
  }
}

// (3) postalAddressSameAsPhysical:true must omit postalAddress despite a stale typed value.
{
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, postalAddressSameAsPhysical: true });
  if (payload.postalAddress !== undefined) {
    fail(
      `postalAddressSameAsPhysical:true must omit postalAddress from the payload; got ${JSON.stringify(payload.postalAddress)}.`,
    );
  }
}

// (4) postalAddressSameAsPhysical:false must still send the real typed postalAddress.
{
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, postalAddressSameAsPhysical: false });
  if (payload.postalAddress !== '2 Orchid Way, Stellenbosch') {
    fail(`postalAddressSameAsPhysical:false must send the typed postalAddress; got ${JSON.stringify(payload.postalAddress)}.`);
  }
}

// (5) vatRegistered:'false' (Not VAT registered) must omit vatNumber despite a stale typed value.
{
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, vatRegistered: 'false' });
  if (payload.vatNumber !== undefined) {
    fail(`vatRegistered:'false' must omit vatNumber from the payload; got ${JSON.stringify(payload.vatNumber)}.`);
  }
  if (payload.vatRegistered !== false) {
    fail(`vatRegistered:'false' must coerce to boolean false on the payload; got ${JSON.stringify(payload.vatRegistered)}.`);
  }
}

// (6) vatRegistered:'' (unanswered) must also omit vatNumber -- the gate is "=== 'true'", not
// "!== 'false'", so an unanswered radio never leaks a stray typed VAT number.
{
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, vatRegistered: '' });
  if (payload.vatNumber !== undefined) {
    fail(`vatRegistered:'' must omit vatNumber from the payload; got ${JSON.stringify(payload.vatNumber)}.`);
  }
  if (payload.vatRegistered !== undefined) {
    fail(`vatRegistered:'' must coerce to undefined on the payload; got ${JSON.stringify(payload.vatRegistered)}.`);
  }
}

// (7) vatRegistered:'true' must send the real typed vatNumber.
{
  const payload = buildVendorRegistrationPayload({ ...BASE_STATE, vatRegistered: 'true' });
  if (payload.vatNumber !== '4123456789') {
    fail(`vatRegistered:'true' must send the typed vatNumber; got ${JSON.stringify(payload.vatNumber)}.`);
  }
}

// (8) Every new Section 1/2 field survives onto the payload when populated and not gated off.
{
  const payload = buildVendorRegistrationPayload(BASE_STATE);
  const expected = {
    businessEntityType: 'sole-proprietor',
    countryOfBusinessRegistration: 'South Africa',
    contactPosition: 'Owner',
    alternativeContactNumber: '0839876543',
    accountsContactName: 'Accounts Person',
    accountsContactEmail: 'accounts@capeorchid.example',
    emergencyContactName: 'John Vendor',
    emergencyContactRelationship: 'Spouse',
    emergencyContactCellPhone: '0827654321',
  };
  for (const [key, value] of Object.entries(expected)) {
    if (payload[key] !== value) {
      fail(`Expected payload.${key} === ${JSON.stringify(value)}, got ${JSON.stringify(payload[key])}.`);
    }
  }
}

if (failures.length > 0) {
  console.error(`FAIL (${failures.length}):\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('PASS: F2 payload gates (trading name / postal address / VAT number) are leak-proof.');

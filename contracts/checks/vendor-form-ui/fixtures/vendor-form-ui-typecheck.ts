// A11 — compiler-driven (not source-grep) proof of the exported shapes
// lib/vendor-register-form-payload.ts and lib/vendor-register-response.ts must add. Run via
// its own scoped tsconfig (see that file's header) because the root tsconfig.json excludes
// `contracts/` from `pnpm type-check`. Mirrors
// contracts/checks/vendor-f5-register-route/fixtures/vendor-f5-register-route-typecheck.ts's
// own pattern exactly.
//
// Proves, by real assignment (compiles or it doesn't), not by grep:
//   1. VendorRegisterFormState is a fully-keyed, all-string/boolean/array shape (every
//      form-bound value is a controlled-input-friendly primitive, never `number` — coercion
//      to the real VendorSubmissionDraft's numeric fields happens inside
//      buildVendorRegistrationPayload, never in component state).
//   2. buildVendorRegistrationPayload's return type is assignable to `unknown` (it must be —
//      it feeds validateVendorSubmissionInput, whose real signature takes `unknown`) while
//      still being independently checkable field-by-field here.
//   3. describeVendorRegistrationResponse's return type is the real four-member discriminated
//      union — a switch over `.kind` that exhaustively narrows without a `default` case
//      compiles only if all four members are present and correctly named.
//
// Run as: npx tsc --noEmit -p contracts/checks/vendor-form-ui/tsconfig.typecheck.json

import { validateVendorSubmissionInput } from '../../../../lib/vendor-submissions';
import {
  buildVendorRegistrationPayload,
  type VendorRegisterFormState,
} from '../../../../lib/vendor-register-form-payload';
import {
  describeVendorRegistrationResponse,
  formatRetryAfter,
  type VendorRegisterResponseDescription,
} from '../../../../lib/vendor-register-response';

const fullState: VendorRegisterFormState = {
  businessName: 'Highveld Orchid Nursery',
  tradingName: '',
  tradingNameSameAsBusiness: true,
  businessEntityType: 'sole-proprietor',
  businessEntityTypeOther: '',
  contactPersonName: 'Sipho Nkosi',
  contactPosition: 'Owner',
  contactCellPhone: '0821234567',
  alternativeContactNumber: '',
  contactEmail: 'sipho@highveldorchids.co.za',
  accountsContactName: '',
  accountsContactEmail: '',
  physicalAddress: '12 Jacaranda Street, Pretoria, 0181',
  postalAddressSameAsPhysical: true,
  postalAddress: '',
  cipcNumber: '',
  vatRegistered: 'false',
  vatNumber: '',
  countryOfBusinessRegistration: 'South Africa',
  website: '',
  socialMediaHandle: '',
  emergencyContactName: 'Thandiwe Nkosi',
  emergencyContactRelationship: 'Spouse',
  emergencyContactCellPhone: '0827654321',
  vendorCategory: ['plant-sales'],
  productDescription: 'Cattleya and Cymbidium hybrids.',
  phytosanitaryPermitNumber: '',
  citesPermitNumber: '',
  foodHandlingCertificateNumber: '',
  foodItemList: '',
  boothCount: '2',
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
};

const payload: unknown = buildVendorRegistrationPayload(fullState);
const validation = validateVendorSubmissionInput(payload);
const validationOk: boolean = validation.valid;

// Exhaustive narrowing with no `default` — compiles only if the union has exactly these four
// members, correctly discriminated on `.kind`.
function describe(d: VendorRegisterResponseDescription): string {
  switch (d.kind) {
    case 'success':
      return `${d.id} ${d.message}`;
    case 'validation-error':
      return `${d.message} ${d.fieldErrors.join(', ')}`;
    case 'rate-limited':
      return `${d.message} ${d.retryAfterMs} ${d.retryAfterLabel}`;
    case 'error':
      return d.message;
  }
}

const descriptor: VendorRegisterResponseDescription = describeVendorRegistrationResponse(201, {
  success: true,
  id: 'abc123',
});
const described: string = describe(descriptor);
const label: string = formatRetryAfter(3_600_000);

export { payload, validationOk, descriptor, described, label };

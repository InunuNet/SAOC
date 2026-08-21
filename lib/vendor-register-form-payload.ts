import type {
  VendorBoothType,
  VendorCategory,
  VendorPaymentMethod,
} from '@/types/index';

/**
 * Controlled-input-friendly state for the public vendor registration form
 * (app/(marketing)/national-show/vendors/register). Every value is a string, string[], or
 * boolean -- never `number` -- because HTML form controls only ever hand back strings; all
 * coercion to the real VendorSubmissionDraft shape happens inside
 * buildVendorRegistrationPayload(), never in component state. See
 * contracts/golden/vendor-form-ui/README.md for the full field-by-field mapping.
 */
export interface VendorRegisterFormState {
  businessName: string;
  tradingName: string;
  contactPersonName: string;
  contactCellPhone: string;
  contactEmail: string;
  physicalAddress: string;
  cipcNumber: string;
  vatNumber: string;
  website: string;
  socialMediaHandle: string;
  vendorCategory: string[];
  productDescription: string;
  phytosanitaryPermitNumber: string;
  citesPermitNumber: string;
  foodHandlingCertificateNumber: string;
  foodItemList: string;
  boothCount: string;
  boothType: string;
  tableCount: string;
  chairCount: string;
  powerRequired: '' | 'true' | 'false';
  electricalLoad: string;
  waterRequired: '' | 'true' | 'false';
  staffPerDay: string;
  vehicleRegistrations: string;
  loadInSlot: string;
  loadOutSlot: string;
  bio: string;
  paymentMethodsAccepted: string[];
  paymentReference: string;
  termsAccepted: boolean;
}

/** Shared field-change handler signature every fieldset component receives. */
export type VendorRegisterFieldChangeHandler = (
  key: keyof VendorRegisterFormState,
  value: string | string[] | boolean,
) => void;

function omitBlank(value: string): string | undefined {
  return value === '' ? undefined : value;
}

function toOptionalInt(value: string): number | undefined {
  if (value === '') {
    return undefined;
  }
  return Number.parseInt(value, 10);
}

function toOptionalBoolean(value: '' | 'true' | 'false'): boolean | undefined {
  if (value === '') {
    return undefined;
  }
  return value === 'true';
}

/**
 * Shared render-gate + payload-exclusion guard for electricalLoad. A hidden field can never
 * leak a stale value into the submitted document: both VendorBoothFieldset (render) and
 * buildVendorRegistrationPayload (payload) call this same function.
 */
export function isElectricalLoadApplicable(state: VendorRegisterFormState): boolean {
  return state.powerRequired === 'true';
}

/**
 * Shared render-gate + payload-exclusion guard for the two food-retailer-only fields
 * (foodHandlingCertificateNumber, foodItemList). Same leak-proofing rationale as
 * isElectricalLoadApplicable above.
 */
export function isFoodRetailer(state: VendorRegisterFormState): boolean {
  return state.vendorCategory.includes('food-retailer');
}

/**
 * Coerces a VendorRegisterFormState into the wire payload the real
 * validateVendorSubmissionInput() (lib/vendor-submissions.ts, F4) expects: string form values
 * become number/boolean where the API requires it, and every optional field left blank by the
 * submitter is omitted (undefined) rather than sent as an empty string. Returns `unknown`
 * because that is the real validator's own input type -- the caller must not assume this
 * output already satisfies VendorSubmissionDraft without running it through validation.
 */
export function buildVendorRegistrationPayload(state: VendorRegisterFormState): unknown {
  return {
    businessName: state.businessName,
    tradingName: omitBlank(state.tradingName),
    contactPersonName: state.contactPersonName,
    contactCellPhone: state.contactCellPhone,
    contactEmail: state.contactEmail.trim(),
    physicalAddress: omitBlank(state.physicalAddress),
    cipcNumber: omitBlank(state.cipcNumber),
    vatNumber: omitBlank(state.vatNumber),
    website: omitBlank(state.website),
    socialMediaHandle: omitBlank(state.socialMediaHandle),
    vendorCategory: state.vendorCategory as VendorCategory[],
    productDescription: state.productDescription,
    phytosanitaryPermitNumber: omitBlank(state.phytosanitaryPermitNumber),
    citesPermitNumber: omitBlank(state.citesPermitNumber),
    foodHandlingCertificateNumber: isFoodRetailer(state) ? omitBlank(state.foodHandlingCertificateNumber) : undefined,
    foodItemList: isFoodRetailer(state) ? omitBlank(state.foodItemList) : undefined,
    boothCount: Number.parseInt(state.boothCount, 10),
    boothType: omitBlank(state.boothType) as VendorBoothType | undefined,
    tableCount: toOptionalInt(state.tableCount),
    chairCount: toOptionalInt(state.chairCount),
    powerRequired: toOptionalBoolean(state.powerRequired),
    electricalLoad: isElectricalLoadApplicable(state) ? omitBlank(state.electricalLoad) : undefined,
    waterRequired: toOptionalBoolean(state.waterRequired),
    staffPerDay: toOptionalInt(state.staffPerDay),
    vehicleRegistrations: omitBlank(state.vehicleRegistrations),
    loadInSlot: omitBlank(state.loadInSlot),
    loadOutSlot: omitBlank(state.loadOutSlot),
    bio: omitBlank(state.bio),
    paymentMethodsAccepted: state.paymentMethodsAccepted as VendorPaymentMethod[],
    paymentReference: omitBlank(state.paymentReference),
    termsAccepted: state.termsAccepted,
  };
}

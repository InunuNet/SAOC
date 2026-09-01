import type {
  VendorBoothType,
  VendorBusinessEntityType,
  VendorCategory,
  VendorFoodCertification,
  VendorMarketingPermission,
  VendorPaymentMethod,
  VendorRegistrationBoothSize,
} from '@/types/index';

// M2 F14 (vendor-gated-registration-flow) -- controlled-input-friendly row shapes for the two
// repeating equipment tables. Every value is a string (HTML form controls never hand back
// anything else), including quantity/cylinderCount -- coerced to a real number only inside
// buildVendorRegistrationPayload(), matching this file's own toOptionalInt() convention for
// every other numeric field.
export interface VendorElectricalEquipmentEntryFormRow {
  equipment: string;
  quantity: string;
  wattage: string;
  runningTimePerDay: string;
}

export interface VendorGasEquipmentEntryFormRow {
  equipmentType: string;
  gasType: string;
  cylinderSize: string;
  cylinderCount: string;
}

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
  tradingNameSameAsBusiness: boolean;
  businessEntityType: string;
  businessEntityTypeOther: string;
  contactPersonName: string;
  contactPosition: string;
  contactCellPhone: string;
  alternativeContactNumber: string;
  contactEmail: string;
  accountsContactName: string;
  accountsContactEmail: string;
  physicalAddress: string;
  postalAddressSameAsPhysical: boolean;
  postalAddress: string;
  cipcNumber: string;
  vatRegistered: '' | 'true' | 'false';
  vatNumber: string;
  countryOfBusinessRegistration: string;
  website: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactCellPhone: string;

  // M2 F14/F16 (vendor-gated-registration-flow) -- Online Presence, replacing the single
  // socialMediaHandle above (deprecated in place on VendorSubmission, no longer rendered).
  facebookHandle: string;
  instagramHandle: string;
  tiktokHandle: string;
  youtubeHandle: string;
  otherSocialMediaHandle: string;

  vendorCategory: string[];
  vendorCategoryOther: string;
  productDescription: string;
  phytosanitaryPermitNumber: string;
  citesPermitNumber: string;
  foodHandlingCertificateNumber: string;
  foodItemList: string;
  citesListedSpecies: '' | 'true' | 'false';
  foodHealthTradingDocumentation: string;

  // M2 F14/F19 -- the 6-item Food Vendor certification checklist, gated isFoodRetailer(state).
  foodVendorCertifications: string[];

  // M2 F14/F17 -- boothSize replaces the free-numeric boothCount above (deprecated in place).
  boothSize: string;
  boothType: string;
  boothPositionRequest: string;
  adjacentBoothRequested: '' | 'true' | 'false';
  adjacentBoothVendorName: string;
  specialDisplayRequirements: string;
  tableCount: string;
  chairCount: string;
  powerRequired: '' | 'true' | 'false';
  electricalOutletsRequired: string;

  // M2 F14/F17 -- repeating electricity/gas tables, replacing the scalar electrical*/gas*
  // fields above (deprecated in place). gasEquipmentEntries is rendered only when
  // isFoodRetailer(state) -- see golden "Gas equipment gating".
  electricalEquipmentEntries: VendorElectricalEquipmentEntryFormRow[];
  gasEquipmentEntries: VendorGasEquipmentEntryFormRow[];

  waterRequired: '' | 'true' | 'false';
  waterIntendedUse: string;
  wastewaterDrainageRequired: '' | 'true' | 'false';
  wastewaterDrainageDetails: string;
  staffPerDay: string;

  // M2 F14/F17 -- 7 discrete vehicle registration fields, replacing the single free-text
  // vehicleRegistrations above (deprecated in place).
  carRegistrationNumber: string;
  suvBakkieRegistrationNumber: string;
  panelVanRegistrationNumber: string;
  deliveryVanRegistrationNumber: string;
  truckRegistrationNumber: string;
  trailerRegistrationNumber: string;
  otherVehicleRegistrationNumber: string;
  otherVehicleDescription: string;

  loadInSlot: string;
  loadOutSlot: string;
  bio: string;

  // M2 F14/F18 -- marketing permission radio. Logo/product-photo uploads are handled by their
  // own dedicated upload widgets (VendorMarketingUploadField), not this string/boolean/array
  // state shape -- they POST directly to /api/vendors/[id]/marketing-asset once a submission
  // id exists, mirroring the F7 proof-of-payment upload's own out-of-band posture.
  marketingPermission: string;

  // M2 F14/F19 -- two new insurance policy-number fields, alongside the unmodified M1
  // hasPublicLiabilityInsurance/productLiabilityInsuranceStatus fields (not yet rendered by any
  // fieldset -- pre-existing gap, out of M2's scope to fix).
  publicLiabilityInsurancePolicyNumber: string;
  productLiabilityInsurancePolicyNumber: string;

  paymentMethodsAccepted: string[];
  paymentReference: string;
  termsAccepted: boolean;

  // M2 F14/F20 -- the signature block's Full Name. Position/Business Name/Date are read-only
  // reflections rendered directly from contactPosition/businessName/submittedAt -- see golden
  // "The signature block" -- so they need no new state field here.
  signatureFullName: string;
}

/** Shared field-change handler signature every fieldset component receives. */
export type VendorRegisterFieldChangeHandler = (
  key: keyof VendorRegisterFormState,
  value:
    | string
    | string[]
    | boolean
    | VendorElectricalEquipmentEntryFormRow[]
    | VendorGasEquipmentEntryFormRow[],
) => void;

function omitBlank(value: string): string | undefined {
  return value === '' ? undefined : value;
}

function toOptionalInt(value: string | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  return Number.parseInt(value, 10);
}

function toOptionalBoolean(value: ('' | 'true' | 'false') | undefined): boolean | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  return value === 'true';
}

/**
 * Shared render-gate + payload-exclusion guard for the repeating electricalEquipmentEntries
 * table (M2 F14/F17 -- replaces the deprecated-in-place electricalLoad text input, same gate).
 * A hidden field can never leak a stale value into the submitted document: both
 * VendorBoothFieldset (render) and buildVendorRegistrationPayload (payload) call this same
 * function.
 */
export function isElectricalEquipmentApplicable(state: VendorRegisterFormState): boolean {
  return state.powerRequired === 'true';
}

/**
 * Shared render-gate + payload-exclusion guard for the two food-retailer-only fields
 * (foodHandlingCertificateNumber, foodItemList). Same leak-proofing rationale as
 * isElectricalLoadApplicable above. M2 F13 (vendor-gated-registration-flow) — gate value
 * updated from the retired 'food-retailer' VendorCategory member to its replacement,
 * 'food-beverage-retailer'; without this fix the food-only fields would become permanently
 * unreachable once VENDOR_CATEGORY_OPTIONS stopped offering the old value.
 */
export function isFoodRetailer(state: VendorRegisterFormState): boolean {
  return state.vendorCategory.includes('food-beverage-retailer');
}

/**
 * M2 F14/F17 (vendor-gated-registration-flow) — shared render-gate + payload-exclusion guard
 * for the repeating gasEquipmentEntries table. Gated on isFoodRetailer(state), same as the
 * food-only fields in VendorCategoryFieldset -- see golden "Gas equipment gating" for why this
 * is a flagged judgement call, not something the source document states explicitly.
 */
export function isGasEquipmentApplicable(state: VendorRegisterFormState): boolean {
  return isFoodRetailer(state);
}

/**
 * F2 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for
 * tradingName. Same leak-proofing rationale as isElectricalLoadApplicable above: when the "same
 * as business name" checkbox is ticked, the trading-name input is hidden and the payload omits
 * tradingName regardless of any stale typed value.
 */
export function isTradingNameFieldApplicable(state: VendorRegisterFormState): boolean {
  return !state.tradingNameSameAsBusiness;
}

/**
 * F2 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for
 * postalAddress. Same pattern: ticking "same as physical address" hides the postal-address
 * textarea and the payload omits postalAddress.
 */
export function isPostalAddressFieldApplicable(state: VendorRegisterFormState): boolean {
  return !state.postalAddressSameAsPhysical;
}

/**
 * F2 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for the
 * existing vatNumber field, newly gated on the "VAT registered" Yes/No radio.
 */
export function isVatNumberFieldApplicable(state: VendorRegisterFormState): boolean {
  return state.vatRegistered === 'true';
}

/**
 * F3 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for
 * vendorCategoryOther, gated on the 'other' vendorCategory checkbox being selected.
 */
export function isVendorCategoryOtherFieldApplicable(state: VendorRegisterFormState): boolean {
  return state.vendorCategory.includes('other');
}

/**
 * F3 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for the
 * pre-existing citesPermitNumber field, newly gated on the "CITES-listed species" Yes/No radio.
 * The field's type/optionality/validation is unchanged -- only its visibility becomes
 * conditional. See goldens/f3-ui-vendor-category-products.md's judgement-call note.
 */
export function isCitesPermitNumberFieldApplicable(state: VendorRegisterFormState): boolean {
  return state.citesListedSpecies === 'true';
}

/**
 * F4 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for
 * adjacentBoothVendorName, gated on the "adjacent booth requested" Yes/No radio.
 */
export function isAdjacentBoothVendorNameFieldApplicable(
  state: VendorRegisterFormState,
): boolean {
  return state.adjacentBoothRequested === 'true';
}

/**
 * F4 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for
 * wastewaterDrainageDetails, gated on its own independent "wastewater/drainage required"
 * Yes/No radio (not nested under waterRequired).
 */
export function isWastewaterDrainageDetailsFieldApplicable(
  state: VendorRegisterFormState,
): boolean {
  return state.wastewaterDrainageRequired === 'true';
}

/**
 * F4 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for
 * waterIntendedUse, gated on the existing waterRequired Yes/No radio.
 */
export function isWaterIntendedUseFieldApplicable(state: VendorRegisterFormState): boolean {
  return state.waterRequired === 'true';
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
    tradingName: isTradingNameFieldApplicable(state) ? omitBlank(state.tradingName) : undefined,
    tradingNameSameAsBusiness: state.tradingNameSameAsBusiness,
    businessEntityType: omitBlank(state.businessEntityType) as VendorBusinessEntityType | undefined,
    businessEntityTypeOther:
      state.businessEntityType === 'other' ? omitBlank(state.businessEntityTypeOther) : undefined,
    contactPersonName: state.contactPersonName,
    contactPosition: omitBlank(state.contactPosition),
    contactCellPhone: state.contactCellPhone.trim(),
    alternativeContactNumber: omitBlank(state.alternativeContactNumber.trim()),
    contactEmail: state.contactEmail.trim(),
    accountsContactName: omitBlank(state.accountsContactName),
    accountsContactEmail: omitBlank(state.accountsContactEmail.trim()),
    physicalAddress: state.physicalAddress,
    postalAddressSameAsPhysical: state.postalAddressSameAsPhysical,
    postalAddress: isPostalAddressFieldApplicable(state) ? omitBlank(state.postalAddress) : undefined,
    cipcNumber: omitBlank(state.cipcNumber),
    vatRegistered: toOptionalBoolean(state.vatRegistered),
    vatNumber: isVatNumberFieldApplicable(state) ? omitBlank(state.vatNumber) : undefined,
    countryOfBusinessRegistration: omitBlank(state.countryOfBusinessRegistration),
    website: omitBlank(state.website),
    facebookHandle: omitBlank(state.facebookHandle),
    instagramHandle: omitBlank(state.instagramHandle),
    tiktokHandle: omitBlank(state.tiktokHandle),
    youtubeHandle: omitBlank(state.youtubeHandle),
    otherSocialMediaHandle: omitBlank(state.otherSocialMediaHandle),
    emergencyContactName: state.emergencyContactName,
    emergencyContactRelationship: omitBlank(state.emergencyContactRelationship),
    emergencyContactCellPhone: state.emergencyContactCellPhone.trim(),
    vendorCategory: state.vendorCategory as VendorCategory[],
    vendorCategoryOther: isVendorCategoryOtherFieldApplicable(state)
      ? omitBlank(state.vendorCategoryOther)
      : undefined,
    productDescription: state.productDescription,
    phytosanitaryPermitNumber: omitBlank(state.phytosanitaryPermitNumber),
    citesPermitNumber: isCitesPermitNumberFieldApplicable(state)
      ? omitBlank(state.citesPermitNumber)
      : undefined,
    foodHandlingCertificateNumber: isFoodRetailer(state) ? omitBlank(state.foodHandlingCertificateNumber) : undefined,
    foodItemList: isFoodRetailer(state) ? omitBlank(state.foodItemList) : undefined,
    citesListedSpecies: toOptionalBoolean(state.citesListedSpecies),
    foodHealthTradingDocumentation: isFoodRetailer(state)
      ? omitBlank(state.foodHealthTradingDocumentation)
      : undefined,
    foodVendorCertifications: isFoodRetailer(state) && state.foodVendorCertifications.length > 0
      ? (state.foodVendorCertifications as VendorFoodCertification[])
      : undefined,
    boothSize: omitBlank(state.boothSize) as VendorRegistrationBoothSize | undefined,
    boothType: omitBlank(state.boothType) as VendorBoothType | undefined,
    boothPositionRequest: omitBlank(state.boothPositionRequest),
    adjacentBoothRequested: toOptionalBoolean(state.adjacentBoothRequested),
    adjacentBoothVendorName: isAdjacentBoothVendorNameFieldApplicable(state)
      ? omitBlank(state.adjacentBoothVendorName)
      : undefined,
    specialDisplayRequirements: omitBlank(state.specialDisplayRequirements),
    tableCount: toOptionalInt(state.tableCount),
    chairCount: toOptionalInt(state.chairCount),
    powerRequired: toOptionalBoolean(state.powerRequired),
    electricalEquipmentEntries: isElectricalEquipmentApplicable(state)
      ? buildElectricalEquipmentEntries(state.electricalEquipmentEntries)
      : undefined,
    electricalOutletsRequired: isElectricalEquipmentApplicable(state)
      ? toOptionalInt(state.electricalOutletsRequired)
      : undefined,
    gasEquipmentEntries: isGasEquipmentApplicable(state)
      ? buildGasEquipmentEntries(state.gasEquipmentEntries)
      : undefined,
    waterRequired: toOptionalBoolean(state.waterRequired),
    waterIntendedUse: isWaterIntendedUseFieldApplicable(state)
      ? omitBlank(state.waterIntendedUse)
      : undefined,
    wastewaterDrainageRequired: toOptionalBoolean(state.wastewaterDrainageRequired),
    wastewaterDrainageDetails: isWastewaterDrainageDetailsFieldApplicable(state)
      ? omitBlank(state.wastewaterDrainageDetails)
      : undefined,
    staffPerDay: toOptionalInt(state.staffPerDay),
    carRegistrationNumber: omitBlank(state.carRegistrationNumber),
    suvBakkieRegistrationNumber: omitBlank(state.suvBakkieRegistrationNumber),
    panelVanRegistrationNumber: omitBlank(state.panelVanRegistrationNumber),
    deliveryVanRegistrationNumber: omitBlank(state.deliveryVanRegistrationNumber),
    truckRegistrationNumber: omitBlank(state.truckRegistrationNumber),
    trailerRegistrationNumber: omitBlank(state.trailerRegistrationNumber),
    otherVehicleRegistrationNumber: omitBlank(state.otherVehicleRegistrationNumber),
    otherVehicleDescription: omitBlank(state.otherVehicleDescription),
    loadInSlot: omitBlank(state.loadInSlot),
    loadOutSlot: omitBlank(state.loadOutSlot),
    bio: omitBlank(state.bio),
    marketingPermission: omitBlank(state.marketingPermission) as VendorMarketingPermission | undefined,
    publicLiabilityInsurancePolicyNumber: omitBlank(state.publicLiabilityInsurancePolicyNumber),
    productLiabilityInsurancePolicyNumber: omitBlank(state.productLiabilityInsurancePolicyNumber),
    paymentMethodsAccepted: state.paymentMethodsAccepted as VendorPaymentMethod[],
    paymentReference: omitBlank(state.paymentReference),
    termsAccepted: state.termsAccepted,
    signatureFullName: omitBlank(state.signatureFullName),
  };
}

/**
 * M2 F14/F17 -- coerces the electrical equipment table's string-shaped rows into the real
 * numeric shape validateVendorSubmissionInput() expects. Blank rows (every field empty) are
 * dropped rather than submitted as an invalid all-zero row; a partially-filled row is passed
 * through as-is so server-side validation surfaces the specific error, matching this file's
 * "never sanitize, only accept or reject" convention elsewhere.
 */
function buildElectricalEquipmentEntries(
  rows: VendorElectricalEquipmentEntryFormRow[],
): unknown[] | undefined {
  const nonBlank = rows.filter(
    (row) => row.equipment.trim() !== '' || row.quantity.trim() !== '' ||
      row.wattage.trim() !== '' || row.runningTimePerDay.trim() !== '',
  );
  if (nonBlank.length === 0) {
    return undefined;
  }
  return nonBlank.map((row) => ({
    equipment: row.equipment,
    quantity: toOptionalInt(row.quantity),
    wattage: row.wattage,
    runningTimePerDay: row.runningTimePerDay,
  }));
}

/** M2 F14/F17 -- same blank-row-dropping convention as buildElectricalEquipmentEntries above. */
function buildGasEquipmentEntries(rows: VendorGasEquipmentEntryFormRow[]): unknown[] | undefined {
  const nonBlank = rows.filter(
    (row) => row.equipmentType.trim() !== '' || row.gasType.trim() !== '' ||
      row.cylinderSize.trim() !== '' || row.cylinderCount.trim() !== '',
  );
  if (nonBlank.length === 0) {
    return undefined;
  }
  return nonBlank.map((row) => ({
    equipmentType: row.equipmentType,
    gasType: row.gasType,
    cylinderSize: row.cylinderSize,
    cylinderCount: toOptionalInt(row.cylinderCount),
  }));
}

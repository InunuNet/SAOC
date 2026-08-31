import type {
  VendorBoothType,
  VendorBusinessEntityType,
  VendorCategory,
  VendorLivePlantType,
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
  socialMediaHandle: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactCellPhone: string;
  vendorCategory: string[];
  vendorCategoryOther: string;
  productDescription: string;
  phytosanitaryPermitNumber: string;
  citesPermitNumber: string;
  foodHandlingCertificateNumber: string;
  foodItemList: string;
  sellsLivePlants: '' | 'true' | 'false';
  livePlantTypes: string[];
  livePlantTypesOther: string;
  plantsImportedForEvent: '' | 'true' | 'false';
  importCountryOfOrigin: string;
  citesListedSpecies: '' | 'true' | 'false';
  foodHealthTradingDocumentation: string;
  boothCount: string;
  boothType: string;
  boothPositionRequest: string;
  adjacentBoothRequested: '' | 'true' | 'false';
  adjacentBoothVendorName: string;
  specialDisplayRequirements: string;
  tableCount: string;
  chairCount: string;
  powerRequired: '' | 'true' | 'false';
  electricalLoad: string;
  electricalOutletsRequired: string;
  electricalEquipmentList: string;
  electricalEquipmentContinuousOperation: '' | 'true' | 'false';
  electricalEquipmentContinuousDetails: string;
  waterRequired: '' | 'true' | 'false';
  waterIntendedUse: string;
  wastewaterDrainageRequired: '' | 'true' | 'false';
  wastewaterDrainageDetails: string;
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
 * isElectricalLoadApplicable above. M2 F13 (vendor-gated-registration-flow) — gate value
 * updated from the retired 'food-retailer' VendorCategory member to its replacement,
 * 'food-beverage-retailer'; without this fix the food-only fields would become permanently
 * unreachable once VENDOR_CATEGORY_OPTIONS stopped offering the old value.
 */
export function isFoodRetailer(state: VendorRegisterFormState): boolean {
  return state.vendorCategory.includes('food-beverage-retailer');
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
 * livePlantTypes checkbox group (and its payload keys), gated on the "sells live plants" Yes/No
 * radio.
 */
export function isLivePlantTypesFieldApplicable(state: VendorRegisterFormState): boolean {
  return state.sellsLivePlants === 'true';
}

/**
 * F3 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for
 * livePlantTypesOther, gated on the 'other' livePlantTypes checkbox being selected. Only
 * relevant once isLivePlantTypesFieldApplicable is already true.
 */
export function isLivePlantTypesOtherFieldApplicable(state: VendorRegisterFormState): boolean {
  return state.livePlantTypes.includes('other');
}

/**
 * F3 (vendor-registration-form-rebuild) — shared render-gate + payload-exclusion guard for
 * importCountryOfOrigin, gated on the "plants imported for event" Yes/No radio.
 */
export function isImportCountryOfOriginFieldApplicable(state: VendorRegisterFormState): boolean {
  return state.plantsImportedForEvent === 'true';
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
 * electricalEquipmentContinuousDetails. Nested under the existing isElectricalLoadApplicable
 * gate: electricity must be requested at all AND the equipment must run continuously, not just
 * the inner condition alone -- flipping powerRequired back off must also hide/exclude this
 * field even if electricalEquipmentContinuousOperation is still 'true'.
 */
export function isElectricalEquipmentContinuousDetailsFieldApplicable(
  state: VendorRegisterFormState,
): boolean {
  return (
    isElectricalLoadApplicable(state) && state.electricalEquipmentContinuousOperation === 'true'
  );
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
    socialMediaHandle: omitBlank(state.socialMediaHandle),
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
    sellsLivePlants: toOptionalBoolean(state.sellsLivePlants),
    livePlantTypes: isLivePlantTypesFieldApplicable(state)
      ? (state.livePlantTypes as VendorLivePlantType[])
      : undefined,
    livePlantTypesOther:
      isLivePlantTypesFieldApplicable(state) && isLivePlantTypesOtherFieldApplicable(state)
        ? omitBlank(state.livePlantTypesOther)
        : undefined,
    plantsImportedForEvent: toOptionalBoolean(state.plantsImportedForEvent),
    importCountryOfOrigin: isImportCountryOfOriginFieldApplicable(state)
      ? omitBlank(state.importCountryOfOrigin)
      : undefined,
    citesListedSpecies: toOptionalBoolean(state.citesListedSpecies),
    foodHealthTradingDocumentation: isFoodRetailer(state)
      ? omitBlank(state.foodHealthTradingDocumentation)
      : undefined,
    boothCount: toOptionalInt(state.boothCount),
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
    electricalLoad: isElectricalLoadApplicable(state) ? omitBlank(state.electricalLoad) : undefined,
    electricalOutletsRequired: isElectricalLoadApplicable(state)
      ? toOptionalInt(state.electricalOutletsRequired)
      : undefined,
    electricalEquipmentList: isElectricalLoadApplicable(state)
      ? omitBlank(state.electricalEquipmentList)
      : undefined,
    electricalEquipmentContinuousOperation: isElectricalLoadApplicable(state)
      ? toOptionalBoolean(state.electricalEquipmentContinuousOperation)
      : undefined,
    electricalEquipmentContinuousDetails: isElectricalEquipmentContinuousDetailsFieldApplicable(
      state,
    )
      ? omitBlank(state.electricalEquipmentContinuousDetails)
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
    vehicleRegistrations: omitBlank(state.vehicleRegistrations),
    loadInSlot: omitBlank(state.loadInSlot),
    loadOutSlot: omitBlank(state.loadOutSlot),
    bio: omitBlank(state.bio),
    paymentMethodsAccepted: state.paymentMethodsAccepted as VendorPaymentMethod[],
    paymentReference: omitBlank(state.paymentReference),
    termsAccepted: state.termsAccepted,
  };
}

/**
 * `vendorSubmissions/{id}` document shape — 2027 SAOC National Show vendor registration.
 * See contracts/golden/vendor-f4-submissions-model/README.md for the field-by-field
 * verification against the source form and every judgement call recorded here.
 *
 * Pure, side-effect-free construction module — no Firebase Admin SDK, no Firestore read or
 * write, no network. Mirrors the pattern established by lib/buyers.ts (ticketing-f5-buyers).
 * Time is always injected via a `now` argument, never read from Date.now() inside these
 * builders.
 *
 * ZERO authorization meaning: nothing in this module grants a capability, admin surface
 * access, or role based on a vendorSubmissions document or its status. Do not import
 * lib/admin-auth.ts or lib/admin-roles.ts here.
 */

import type {
  VendorBoothType,
  VendorBusinessEntityType,
  VendorCategory,
  VendorLivePlantType,
  VendorPaymentMethod,
  VendorSubmission,
  VendorVehicleType,
  VendorWasteType,
} from '@/types/index';

export const VENDOR_SUBMISSIONS_COLLECTION = 'vendorSubmissions';

const VENDOR_CATEGORIES: readonly VendorCategory[] = [
  'plant-sales',
  'product-sales',
  'rare-exotic-plants',
  'food-retailer',
  'hardware',
  'books',
  'art',
  'other',
];

const VENDOR_BOOTH_TYPES: readonly VendorBoothType[] = ['standard', 'corner', 'end-of-row'];

const VENDOR_PAYMENT_METHODS: readonly VendorPaymentMethod[] = [
  'cash',
  'card',
  'eft',
  'not-applicable',
];

// F1 (vendor-registration-form-rebuild) — five new closed-set constants, mirroring
// VENDOR_CATEGORIES/VENDOR_BOOTH_TYPES/VENDOR_PAYMENT_METHODS exactly. See contract-f1.yaml.
const VENDOR_BUSINESS_ENTITY_TYPES: readonly VendorBusinessEntityType[] = [
  'company',
  'close-corporation',
  'sole-proprietor',
  'partnership',
  'individual',
  'other',
];

const VENDOR_LIVE_PLANT_TYPES: readonly VendorLivePlantType[] = [
  'orchids',
  'other-plants',
  'bulbs-tubers',
  'seeds',
  'cut-flowers',
  'tissue-culture',
  'other',
];

const VENDOR_VEHICLE_TYPES: readonly VendorVehicleType[] = [
  'car',
  'suv-bakkie',
  'panel-van',
  'delivery-van',
  'truck',
  'trailer',
  'other',
];

const VENDOR_WASTE_TYPES: readonly VendorWasteType[] = [
  'general',
  'cardboard-packaging',
  'plant-material',
  'food-waste',
  'wastewater',
  'other',
];

const VENDOR_PRODUCT_LIABILITY_INSURANCE_STATUSES: readonly string[] = [
  'yes',
  'no',
  'not-applicable',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?=.*[0-9])[0-9+\-() ]{7,20}$/;

// Mirrors the golden's field -> maxLength table (contracts/golden/vendor-form-maxlength-and-
// phone-pattern-f1/README.md). Independent of the client's VendorFormField maxLength props --
// a direct POST bypassing the browser must be rejected the same way a truncated keystroke is.
const FIELD_MAX_LENGTHS: Record<string, number> = {
  businessName: 200,
  tradingName: 200,
  contactPersonName: 150,
  contactCellPhone: 30,
  contactEmail: 254,
  physicalAddress: 500,
  cipcNumber: 50,
  vatNumber: 50,
  website: 300,
  socialMediaHandle: 200,
  productDescription: 2000,
  phytosanitaryPermitNumber: 100,
  citesPermitNumber: 100,
  foodHandlingCertificateNumber: 100,
  foodItemList: 1000,
  electricalLoad: 100,
  vehicleRegistrations: 150,
  loadInSlot: 100,
  loadOutSlot: 100,
  bio: 1000,
  paymentReference: 200,

  // F1 (vendor-registration-form-rebuild) additions. See contract-f1.yaml.
  businessEntityTypeOther: 100,
  countryOfBusinessRegistration: 100,
  postalAddress: 500,
  contactPosition: 150,
  alternativeContactNumber: 30,
  accountsContactName: 150,
  accountsContactEmail: 254,
  emergencyContactName: 150,
  emergencyContactRelationship: 100,
  emergencyContactCellPhone: 30,
  livePlantTypesOther: 100,
  importCountryOfOrigin: 200,
  foodHealthTradingDocumentation: 500,
  boothPositionRequest: 300,
  adjacentBoothVendorName: 200,
  specialDisplayRequirements: 1000,
  electricalEquipmentList: 1000,
  electricalEquipmentContinuousDetails: 500,
  waterIntendedUse: 300,
  wastewaterDrainageDetails: 500,
  gasEquipmentType: 200,
  gasFuelType: 100,
  gasCylinderSize: 100,
  gasSafetyInformation: 1000,
  vehicleTypeOther: 100,
  vehicleHeight: 50,
  vehicleLength: 50,
  wasteTypesOther: 100,
  specialWasteRequirements: 500,
};

// Caller-supplied subset of VendorSubmission — id/status/submittedAt are structurally
// absent, not merely optional, so a caller cannot smuggle a self-approved status or a
// backdated submittedAt through the type system (see A5/the golden README).
export type VendorSubmissionDraft = Omit<VendorSubmission, 'id' | 'status' | 'submittedAt'>;

/**
 * Fail-fast validation of a raw, untyped payload (an HTTP request body arrives as
 * `unknown` regardless of what a TypeScript signature elsewhere claims). Collects every
 * violation instead of returning on the first — never sanitizes or reformats a value, only
 * accepts or rejects it as-is.
 */
export function validateVendorSubmissionInput(input: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['input must be an object'] };
  }
  const record = input as Record<string, unknown>;

  requireNonEmptyString(record, 'businessName', errors, FIELD_MAX_LENGTHS.businessName);
  requireNonEmptyString(record, 'contactPersonName', errors, FIELD_MAX_LENGTHS.contactPersonName);
  requireNonEmptyString(record, 'contactCellPhone', errors, FIELD_MAX_LENGTHS.contactCellPhone);
  requireNonEmptyString(record, 'contactEmail', errors, FIELD_MAX_LENGTHS.contactEmail);
  requireNonEmptyString(
    record,
    'productDescription',
    errors,
    FIELD_MAX_LENGTHS.productDescription,
  );
  // F2 (vendor-registration-form-rebuild) — tightened from optional to required in the same
  // deploy as the UI that collects them; see contract-f2.yaml's deploy-safety sequencing rule.
  requireNonEmptyString(record, 'physicalAddress', errors, FIELD_MAX_LENGTHS.physicalAddress);
  requireNonEmptyString(
    record,
    'emergencyContactName',
    errors,
    FIELD_MAX_LENGTHS.emergencyContactName,
  );
  requireNonEmptyString(
    record,
    'emergencyContactCellPhone',
    errors,
    FIELD_MAX_LENGTHS.emergencyContactCellPhone,
  );

  if (
    typeof record.contactEmail === 'string' &&
    record.contactEmail.length > 0 &&
    !EMAIL_PATTERN.test(record.contactEmail)
  ) {
    errors.push('contactEmail must be a valid email address');
  }

  if (
    typeof record.contactCellPhone === 'string' &&
    record.contactCellPhone.length > 0 &&
    !PHONE_PATTERN.test(record.contactCellPhone)
  ) {
    errors.push('contactCellPhone must be a valid phone number');
  }

  validateVendorCategory(record.vendorCategory, errors);
  validateBoothType(record.boothType, errors);
  validatePaymentMethodsAccepted(record.paymentMethodsAccepted, errors);

  // F1 (vendor-registration-form-rebuild) — five new closed-union validators.
  validateBusinessEntityType(record.businessEntityType, errors);
  validateLivePlantTypes(record.livePlantTypes, errors);
  validateVehicleType(record.vehicleType, errors);
  validateWasteTypes(record.wasteTypes, errors);
  validateProductLiabilityInsuranceStatus(record.productLiabilityInsuranceStatus, errors);

  validatePositiveInteger(record.boothCount, 'boothCount', errors);
  validateOptionalNonNegativeInteger(record.tableCount, 'tableCount', errors);
  validateOptionalNonNegativeInteger(record.chairCount, 'chairCount', errors);
  validateOptionalNonNegativeInteger(record.staffPerDay, 'staffPerDay', errors);

  // F1 (vendor-registration-form-rebuild) — new optional numeric fields.
  validateOptionalNonNegativeInteger(
    record.electricalOutletsRequired,
    'electricalOutletsRequired',
    errors,
  );
  validateOptionalNonNegativeInteger(record.gasCylinderCount, 'gasCylinderCount', errors);
  validateOptionalNonNegativeInteger(record.staffCountSetupDay, 'staffCountSetupDay', errors);
  validateOptionalNonNegativeInteger(record.staffCountDay1, 'staffCountDay1', errors);
  validateOptionalNonNegativeInteger(record.staffCountDay2, 'staffCountDay2', errors);
  validateOptionalNonNegativeInteger(record.staffCountDay3, 'staffCountDay3', errors);
  validateOptionalNonNegativeInteger(
    record.staffCountBreakdownDay,
    'staffCountBreakdownDay',
    errors,
  );
  validateOptionalNonNegativeInteger(
    record.exhibitorPassesCount,
    'exhibitorPassesCount',
    errors,
  );

  validateOptionalStringMaxLength(record, 'tradingName', errors, FIELD_MAX_LENGTHS.tradingName);
  validateOptionalStringMaxLength(record, 'cipcNumber', errors, FIELD_MAX_LENGTHS.cipcNumber);
  validateOptionalStringMaxLength(record, 'vatNumber', errors, FIELD_MAX_LENGTHS.vatNumber);
  validateOptionalStringMaxLength(record, 'website', errors, FIELD_MAX_LENGTHS.website);
  validateOptionalStringMaxLength(
    record,
    'socialMediaHandle',
    errors,
    FIELD_MAX_LENGTHS.socialMediaHandle,
  );
  validateOptionalStringMaxLength(
    record,
    'phytosanitaryPermitNumber',
    errors,
    FIELD_MAX_LENGTHS.phytosanitaryPermitNumber,
  );
  validateOptionalStringMaxLength(
    record,
    'citesPermitNumber',
    errors,
    FIELD_MAX_LENGTHS.citesPermitNumber,
  );
  validateOptionalStringMaxLength(
    record,
    'foodHandlingCertificateNumber',
    errors,
    FIELD_MAX_LENGTHS.foodHandlingCertificateNumber,
  );
  validateOptionalStringMaxLength(record, 'foodItemList', errors, FIELD_MAX_LENGTHS.foodItemList);
  validateOptionalStringMaxLength(
    record,
    'electricalLoad',
    errors,
    FIELD_MAX_LENGTHS.electricalLoad,
  );
  validateOptionalStringMaxLength(
    record,
    'vehicleRegistrations',
    errors,
    FIELD_MAX_LENGTHS.vehicleRegistrations,
  );
  validateOptionalStringMaxLength(record, 'loadInSlot', errors, FIELD_MAX_LENGTHS.loadInSlot);
  validateOptionalStringMaxLength(record, 'loadOutSlot', errors, FIELD_MAX_LENGTHS.loadOutSlot);
  validateOptionalStringMaxLength(record, 'bio', errors, FIELD_MAX_LENGTHS.bio);
  validateOptionalStringMaxLength(
    record,
    'paymentReference',
    errors,
    FIELD_MAX_LENGTHS.paymentReference,
  );

  // F1 (vendor-registration-form-rebuild) — new optional string fields.
  validateOptionalStringMaxLength(
    record,
    'businessEntityTypeOther',
    errors,
    FIELD_MAX_LENGTHS.businessEntityTypeOther,
  );
  validateOptionalStringMaxLength(
    record,
    'countryOfBusinessRegistration',
    errors,
    FIELD_MAX_LENGTHS.countryOfBusinessRegistration,
  );
  validateOptionalStringMaxLength(
    record,
    'postalAddress',
    errors,
    FIELD_MAX_LENGTHS.postalAddress,
  );
  validateOptionalStringMaxLength(
    record,
    'contactPosition',
    errors,
    FIELD_MAX_LENGTHS.contactPosition,
  );
  validateOptionalStringMaxLength(
    record,
    'alternativeContactNumber',
    errors,
    FIELD_MAX_LENGTHS.alternativeContactNumber,
  );
  validateOptionalPattern(
    record,
    'alternativeContactNumber',
    errors,
    PHONE_PATTERN,
    'alternativeContactNumber must be a valid phone number',
  );
  validateOptionalStringMaxLength(
    record,
    'accountsContactName',
    errors,
    FIELD_MAX_LENGTHS.accountsContactName,
  );
  validateOptionalStringMaxLength(
    record,
    'accountsContactEmail',
    errors,
    FIELD_MAX_LENGTHS.accountsContactEmail,
  );
  validateOptionalPattern(
    record,
    'accountsContactEmail',
    errors,
    EMAIL_PATTERN,
    'accountsContactEmail must be a valid email address',
  );
  validateOptionalStringMaxLength(
    record,
    'emergencyContactRelationship',
    errors,
    FIELD_MAX_LENGTHS.emergencyContactRelationship,
  );
  validateOptionalPattern(
    record,
    'emergencyContactCellPhone',
    errors,
    PHONE_PATTERN,
    'emergencyContactCellPhone must be a valid phone number',
  );
  validateOptionalStringMaxLength(
    record,
    'livePlantTypesOther',
    errors,
    FIELD_MAX_LENGTHS.livePlantTypesOther,
  );
  validateOptionalStringMaxLength(
    record,
    'importCountryOfOrigin',
    errors,
    FIELD_MAX_LENGTHS.importCountryOfOrigin,
  );
  validateOptionalStringMaxLength(
    record,
    'foodHealthTradingDocumentation',
    errors,
    FIELD_MAX_LENGTHS.foodHealthTradingDocumentation,
  );
  validateOptionalStringMaxLength(
    record,
    'boothPositionRequest',
    errors,
    FIELD_MAX_LENGTHS.boothPositionRequest,
  );
  validateOptionalStringMaxLength(
    record,
    'adjacentBoothVendorName',
    errors,
    FIELD_MAX_LENGTHS.adjacentBoothVendorName,
  );
  validateOptionalStringMaxLength(
    record,
    'specialDisplayRequirements',
    errors,
    FIELD_MAX_LENGTHS.specialDisplayRequirements,
  );
  validateOptionalStringMaxLength(
    record,
    'electricalEquipmentList',
    errors,
    FIELD_MAX_LENGTHS.electricalEquipmentList,
  );
  validateOptionalStringMaxLength(
    record,
    'electricalEquipmentContinuousDetails',
    errors,
    FIELD_MAX_LENGTHS.electricalEquipmentContinuousDetails,
  );
  validateOptionalStringMaxLength(
    record,
    'waterIntendedUse',
    errors,
    FIELD_MAX_LENGTHS.waterIntendedUse,
  );
  validateOptionalStringMaxLength(
    record,
    'wastewaterDrainageDetails',
    errors,
    FIELD_MAX_LENGTHS.wastewaterDrainageDetails,
  );
  validateOptionalStringMaxLength(
    record,
    'gasEquipmentType',
    errors,
    FIELD_MAX_LENGTHS.gasEquipmentType,
  );
  validateOptionalStringMaxLength(record, 'gasFuelType', errors, FIELD_MAX_LENGTHS.gasFuelType);
  validateOptionalStringMaxLength(
    record,
    'gasCylinderSize',
    errors,
    FIELD_MAX_LENGTHS.gasCylinderSize,
  );
  validateOptionalStringMaxLength(
    record,
    'gasSafetyInformation',
    errors,
    FIELD_MAX_LENGTHS.gasSafetyInformation,
  );
  validateOptionalStringMaxLength(
    record,
    'vehicleTypeOther',
    errors,
    FIELD_MAX_LENGTHS.vehicleTypeOther,
  );
  validateOptionalStringMaxLength(record, 'vehicleHeight', errors, FIELD_MAX_LENGTHS.vehicleHeight);
  validateOptionalStringMaxLength(record, 'vehicleLength', errors, FIELD_MAX_LENGTHS.vehicleLength);
  validateOptionalStringMaxLength(
    record,
    'wasteTypesOther',
    errors,
    FIELD_MAX_LENGTHS.wasteTypesOther,
  );
  validateOptionalStringMaxLength(
    record,
    'specialWasteRequirements',
    errors,
    FIELD_MAX_LENGTHS.specialWasteRequirements,
  );

  if (typeof record.powerRequired !== 'boolean') {
    errors.push('powerRequired is required and must be a boolean');
  }

  if (record.termsAccepted !== true) {
    errors.push('termsAccepted must be true');
  }

  // F1 (vendor-registration-form-rebuild) — new optional boolean fields.
  validateOptionalBoolean(record, 'tradingNameSameAsBusiness', errors);
  validateOptionalBoolean(record, 'vatRegistered', errors);
  validateOptionalBoolean(record, 'postalAddressSameAsPhysical', errors);
  validateOptionalBoolean(record, 'sellsLivePlants', errors);
  validateOptionalBoolean(record, 'plantsImportedForEvent', errors);
  validateOptionalBoolean(record, 'citesListedSpecies', errors);
  validateOptionalBoolean(record, 'adjacentBoothRequested', errors);
  validateOptionalBoolean(record, 'electricalEquipmentContinuousOperation', errors);
  validateOptionalBoolean(record, 'wastewaterDrainageRequired', errors);
  validateOptionalBoolean(record, 'gasOrHeatEquipmentUsed', errors);
  validateOptionalBoolean(record, 'foodPreparationOnSite', errors);
  validateOptionalBoolean(record, 'foodCookingOnSite', errors);
  validateOptionalBoolean(record, 'exhibitorPassesRequired', errors);
  validateOptionalBoolean(record, 'trailerAttached', errors);
  validateOptionalBoolean(record, 'storageRiskAcknowledged', errors);
  validateOptionalBoolean(record, 'hasPublicLiabilityInsurance', errors);

  return { valid: errors.length === 0, errors };
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  field: string,
  errors: string[],
  maxLength?: number,
): void {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${field} is required and must be a non-empty string`);
    return;
  }
  if (maxLength !== undefined && value.length > maxLength) {
    errors.push(`${field} must be at most ${maxLength} characters`);
  }
}

function validateOptionalStringMaxLength(
  record: Record<string, unknown>,
  field: string,
  errors: string[],
  maxLength: number,
): void {
  const value = record[field];
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`);
    return;
  }
  if (value.length > maxLength) {
    errors.push(`${field} must be at most ${maxLength} characters`);
  }
}

function validateOptionalPattern(
  record: Record<string, unknown>,
  field: string,
  errors: string[],
  pattern: RegExp,
  message: string,
): void {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    return;
  }
  if (!pattern.test(value)) {
    errors.push(message);
  }
}

function validateVendorCategory(value: unknown, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push('vendorCategory is required and must be a non-empty array');
    return;
  }
  const invalid = value.filter((entry) => !VENDOR_CATEGORIES.includes(entry as VendorCategory));
  if (invalid.length > 0) {
    errors.push(`vendorCategory contains invalid value(s): ${invalid.join(', ')}`);
  }
}

function validateBoothType(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!VENDOR_BOOTH_TYPES.includes(value as VendorBoothType)) {
    errors.push(`boothType is invalid: ${String(value)}`);
  }
}

function validatePaymentMethodsAccepted(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push('paymentMethodsAccepted must be an array');
    return;
  }
  const invalid = value.filter(
    (entry) => !VENDOR_PAYMENT_METHODS.includes(entry as VendorPaymentMethod),
  );
  if (invalid.length > 0) {
    errors.push(`paymentMethodsAccepted contains invalid value(s): ${invalid.join(', ')}`);
  }
}

// F1 (vendor-registration-form-rebuild) — five new closed-union validators, mirroring
// validateVendorCategory/validateBoothType/validatePaymentMethodsAccepted's shape exactly.
function validateBusinessEntityType(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!VENDOR_BUSINESS_ENTITY_TYPES.includes(value as VendorBusinessEntityType)) {
    errors.push(`businessEntityType is invalid: ${String(value)}`);
  }
}

function validateLivePlantTypes(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push('livePlantTypes must be an array');
    return;
  }
  const invalid = value.filter(
    (entry) => !VENDOR_LIVE_PLANT_TYPES.includes(entry as VendorLivePlantType),
  );
  if (invalid.length > 0) {
    errors.push(`livePlantTypes contains invalid value(s): ${invalid.join(', ')}`);
  }
}

function validateVehicleType(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!VENDOR_VEHICLE_TYPES.includes(value as VendorVehicleType)) {
    errors.push(`vehicleType is invalid: ${String(value)}`);
  }
}

function validateWasteTypes(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push('wasteTypes must be an array');
    return;
  }
  const invalid = value.filter((entry) => !VENDOR_WASTE_TYPES.includes(entry as VendorWasteType));
  if (invalid.length > 0) {
    errors.push(`wasteTypes contains invalid value(s): ${invalid.join(', ')}`);
  }
}

function validateProductLiabilityInsuranceStatus(value: unknown, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!VENDOR_PRODUCT_LIABILITY_INSURANCE_STATUSES.includes(value as string)) {
    errors.push(`productLiabilityInsuranceStatus is invalid: ${String(value)}`);
  }
}

function validatePositiveInteger(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    errors.push(`${field} is required and must be a positive integer`);
  }
}

function validateOptionalNonNegativeInteger(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    errors.push(`${field} must be a non-negative integer`);
  }
}

function validateOptionalBoolean(
  record: Record<string, unknown>,
  field: string,
  errors: string[],
): void {
  const value = record[field];
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'boolean') {
    errors.push(`${field} must be a boolean`);
  }
}

/**
 * Builds a `vendorSubmissions/{id}` document (minus the Firestore-assigned `id`). Copies
 * each of the 31 form fields explicitly, field by field — never a `{ ...input }` spread —
 * so that status/submittedAt/id can never survive from a raw, type-system-bypassing input
 * (e.g. a POST body cast through `as any`). `status` is always forced to 'submitted' and
 * `submittedAt` to the injected `now`, regardless of anything present on `input`: a public,
 * unauthenticated submitter must never be able to self-approve or backdate a submission.
 */
export function buildVendorSubmission(
  input: VendorSubmissionDraft,
  now: Date,
): Omit<VendorSubmission, 'id'> {
  return {
    businessName: input.businessName,
    tradingName: input.tradingName,
    contactPersonName: input.contactPersonName,
    contactCellPhone: input.contactCellPhone,
    contactEmail: input.contactEmail,
    physicalAddress: input.physicalAddress,
    cipcNumber: input.cipcNumber,
    vatNumber: input.vatNumber,
    website: input.website,
    socialMediaHandle: input.socialMediaHandle,
    vendorCategory: input.vendorCategory,
    productDescription: input.productDescription,
    phytosanitaryPermitNumber: input.phytosanitaryPermitNumber,
    citesPermitNumber: input.citesPermitNumber,
    foodHandlingCertificateNumber: input.foodHandlingCertificateNumber,
    foodItemList: input.foodItemList,
    boothCount: input.boothCount,
    boothType: input.boothType,
    tableCount: input.tableCount,
    chairCount: input.chairCount,
    powerRequired: input.powerRequired,
    electricalLoad: input.electricalLoad,
    waterRequired: input.waterRequired,
    staffPerDay: input.staffPerDay,
    vehicleRegistrations: input.vehicleRegistrations,
    loadInSlot: input.loadInSlot,
    loadOutSlot: input.loadOutSlot,
    bio: input.bio,
    paymentMethodsAccepted: input.paymentMethodsAccepted,
    paymentReference: input.paymentReference,
    termsAccepted: input.termsAccepted,

    // F1 (vendor-registration-form-rebuild) — new fields, copied explicitly field-by-field,
    // never via a `{ ...input }` spread. See contract-f1.yaml.
    tradingNameSameAsBusiness: input.tradingNameSameAsBusiness,
    businessEntityType: input.businessEntityType,
    businessEntityTypeOther: input.businessEntityTypeOther,
    vatRegistered: input.vatRegistered,
    countryOfBusinessRegistration: input.countryOfBusinessRegistration,
    postalAddressSameAsPhysical: input.postalAddressSameAsPhysical,
    postalAddress: input.postalAddress,
    contactPosition: input.contactPosition,
    alternativeContactNumber: input.alternativeContactNumber,
    accountsContactName: input.accountsContactName,
    accountsContactEmail: input.accountsContactEmail,
    emergencyContactName: input.emergencyContactName,
    emergencyContactRelationship: input.emergencyContactRelationship,
    emergencyContactCellPhone: input.emergencyContactCellPhone,
    sellsLivePlants: input.sellsLivePlants,
    livePlantTypes: input.livePlantTypes,
    livePlantTypesOther: input.livePlantTypesOther,
    plantsImportedForEvent: input.plantsImportedForEvent,
    importCountryOfOrigin: input.importCountryOfOrigin,
    citesListedSpecies: input.citesListedSpecies,
    foodHealthTradingDocumentation: input.foodHealthTradingDocumentation,
    boothPositionRequest: input.boothPositionRequest,
    adjacentBoothRequested: input.adjacentBoothRequested,
    adjacentBoothVendorName: input.adjacentBoothVendorName,
    specialDisplayRequirements: input.specialDisplayRequirements,
    electricalOutletsRequired: input.electricalOutletsRequired,
    electricalEquipmentList: input.electricalEquipmentList,
    electricalEquipmentContinuousOperation: input.electricalEquipmentContinuousOperation,
    electricalEquipmentContinuousDetails: input.electricalEquipmentContinuousDetails,
    waterIntendedUse: input.waterIntendedUse,
    wastewaterDrainageRequired: input.wastewaterDrainageRequired,
    wastewaterDrainageDetails: input.wastewaterDrainageDetails,
    gasOrHeatEquipmentUsed: input.gasOrHeatEquipmentUsed,
    gasEquipmentType: input.gasEquipmentType,
    gasFuelType: input.gasFuelType,
    gasCylinderSize: input.gasCylinderSize,
    gasCylinderCount: input.gasCylinderCount,
    gasSafetyInformation: input.gasSafetyInformation,
    foodPreparationOnSite: input.foodPreparationOnSite,
    foodCookingOnSite: input.foodCookingOnSite,
    staffCountSetupDay: input.staffCountSetupDay,
    staffCountDay1: input.staffCountDay1,
    staffCountDay2: input.staffCountDay2,
    staffCountDay3: input.staffCountDay3,
    staffCountBreakdownDay: input.staffCountBreakdownDay,
    exhibitorPassesRequired: input.exhibitorPassesRequired,
    exhibitorPassesCount: input.exhibitorPassesCount,
    vehicleType: input.vehicleType,
    vehicleTypeOther: input.vehicleTypeOther,
    vehicleHeight: input.vehicleHeight,
    vehicleLength: input.vehicleLength,
    trailerAttached: input.trailerAttached,
    storageRiskAcknowledged: input.storageRiskAcknowledged,
    wasteTypes: input.wasteTypes,
    wasteTypesOther: input.wasteTypesOther,
    specialWasteRequirements: input.specialWasteRequirements,
    hasPublicLiabilityInsurance: input.hasPublicLiabilityInsurance,
    productLiabilityInsuranceStatus: input.productLiabilityInsuranceStatus,

    // Always system-set — never read from `input`, see the function doc comment above.
    status: 'submitted',
    submittedAt: now,
  };
}

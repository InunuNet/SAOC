# F1: Vendor Registration Form Rebuild — Data Model Foundation

**Feature:** F1 of mission `vendor-registration-form-rebuild` (3-milestone, 11-feature mission). Adds the data-model foundation for rebuilding the entire vendor registration form against its real, current source document (2027_SAOC_National_Show_Vendor_Registration_Form.docx, 18 sections, ~90 fields) in place of the outdated one the live form was built from. This feature ships **NO UI, NO routes, NO Storage changes** — purely the TypeScript type layer and server-side validation helpers that F2-F10 will build form fields and UIs on top of. The 11-feature mission ships in order: F1 (foundation), F2-F10 (UI + submission features per source document section), F11 (admin review UI).

**Contract:** `.agent/memory/project/specs/vendor-registration-form-rebuild/contract-f1.yaml` and `.agent/memory/project/specs/vendor-registration-form-rebuild/goldens/f1-data-model-foundation.md` — full decision record, sequencing rules, field-by-field provenance.

**Status:** Gated (all contract assertions pass). QA-passed. Codex GPT-5.5 cross-model passed (independently run twice).

---

## What This Feature Is

A purely additive, non-breaking extension to two server-side data-model files:

- **`types/index.ts`**: 5 new closed-union types + 58 new optional fields on `VendorSubmission`, grouped by source document section. Every comment cites `F1/contract-f1.yaml`.
- **`lib/vendor-submissions.ts`**: 5 new `VENDOR_*` frozen constants (mirrors of existing `VENDOR_CATEGORIES`, `VENDOR_BOOTH_TYPES`, etc.), `FIELD_MAX_LENGTHS` entries for every new string field, 5 new closed-union validators, 2 new reusable helpers (`validateOptionalPattern`, `validateOptionalBoolean`), and `buildVendorSubmission()` extended with explicit field-by-field copy-through of all 58 new fields.

**Zero authorization meaning:** Nothing in this feature grants a capability, admin surface access, or role. The module continues to import neither `lib/admin-auth.ts` nor `lib/admin-roles.ts`.

---

## Why This Matters

The live vendor registration form collects only 31 fields from an outdated source document ("South African Exhibitors.docx"); the real, current 2027 form (confirmed by independent investigation, last modified 2026-08-10) contains 18 sections and ~90 fields. F1 lays the type+validation groundwork so F2-F10 can rebuild the form section by section against the real source, with confidence that:

1. **No existing vendor submissions break.** Every field F1 adds is optional and entirely new. A submission built by today's live form (31-field shape) continues validating exactly as before.
2. **The live public API (`POST /api/vendors/register`) stays accepting real submissions continuously between each feature merge.** This project's standing authorization is "push any time," not "hold everything until done." F1 ensures that intermediate states never reject well-formed submissions from the still-deployed old UI.

---

## The Sequencing Rule — Why F1 Exists As Its Own Feature

Three categories of change are **forbidden in F1**, even though the source document justifies them, because landing them here would break the live public API before any UI exists to collect the new data:

### 1. Making a field required that the live UI does not yet collect

Source Section 2 (Emergency Contact) marks `emergencyContactName` and `emergencyContactCellPhone` with asterisks (required). Source field 1.7 (`physicalAddress`) is also asterisked but the live `VendorContactFieldset.tsx` marks it `required={false}`. All three stay **optional** in F1. **F2 (the Emergency Contact fieldset feature) tightens all three to required in `validateVendorSubmissionInput()` in the same deploy as the UI change** — never ahead of it.

### 2. Narrowing or renaming a closed enum the live UI still emits values from

Source Section 3 (vendor category) and Section 4 (booth position/type) have different value sets from the live 8-member `VendorCategory` and 3-member `VendorBoothType` unions. `VendorCategoryFieldset.tsx` and `VendorBoothFieldset.tsx` still emit the OLD values today. Narrowing either union here would make in-flight submissions fail the instant F1 deploys. **Those enum corrections belong to F3 and F4 respectively, landed atomically with the UI change that stops emitting the old values.**

Similarly, `staffPerDay` is kept alongside the new per-day staff breakdown fields (not replaced); **F6 removes it in the same deploy as the UI change that stops sending it.**

`paymentMethodsAccepted` gaining an `'other'` member is additive-safe (widening never invalidates existing values) but is deferred to **F8, which owns Section 14 end-to-end, to avoid splitting one section's change across two features.**

---

## The 58 New Fields — Grouped by Source Section

All optional; all new keys. The source sections touched by F1:

- **Section 1 (Business/Contact, 11 new):** `tradingNameSameAsBusiness`, `businessEntityType` + `businessEntityTypeOther`, `vatRegistered`, `countryOfBusinessRegistration`, `postalAddressSameAsPhysical`, `postalAddress`, `contactPosition`, `alternativeContactNumber`, `accountsContactName`, `accountsContactEmail`.
- **Section 2 (Emergency Contact, 3 new, all optional here — F2 tightens):** `emergencyContactName`, `emergencyContactRelationship`, `emergencyContactCellPhone`.
- **Section 3 (Products/Regulatory, 7 new):** `sellsLivePlants`, `livePlantTypes` (array), `livePlantTypesOther`, `plantsImportedForEvent`, `importCountryOfOrigin`, `citesListedSpecies`, `foodHealthTradingDocumentation`.
- **Section 4 (Booth/Logistics, 4 new):** `boothPositionRequest`, `adjacentBoothRequested`, `adjacentBoothVendorName`, `specialDisplayRequirements`.
- **Section 6 (Electrical/Water/Waste, 7 new):** `electricalOutletsRequired`, `electricalEquipmentList`, `electricalEquipmentContinuousOperation`, `electricalEquipmentContinuousDetails`, `waterIntendedUse`, `wastewaterDrainageRequired`, `wastewaterDrainageDetails`.
- **Section 7 (Gas/Heat, 6 new, entirely new section):** `gasOrHeatEquipmentUsed`, `gasEquipmentType`, `gasFuelType`, `gasCylinderSize`, `gasCylinderCount`, `gasSafetyInformation`.
- **Section 8 (Food, 2 new):** `foodPreparationOnSite`, `foodCookingOnSite` (two independent booleans, refining source 3.8).
- **Section 9 (Staffing, 7 new, alongside still-live `staffPerDay`):** `staffCountSetupDay`, `staffCountDay1`, `staffCountDay2`, `staffCountDay3`, `staffCountBreakdownDay`, `exhibitorPassesRequired`, `exhibitorPassesCount`.
- **Section 10 (Vehicles, 5 new):** `vehicleType`, `vehicleTypeOther`, `vehicleHeight`, `vehicleLength`, `trailerAttached`.
- **Section 11 (Storage/Security, 1 new, entirely new section):** `storageRiskAcknowledged` (NOT forced `true` — source places no asterisk).
- **Section 12 (Waste/Cleaning, 3 new, entirely new section):** `wasteTypes` (array), `wasteTypesOther`, `specialWasteRequirements`.
- **Section 15 (Insurance, 2 new, entirely new section):** `hasPublicLiabilityInsurance`, `productLiabilityInsuranceStatus` (3-member union: `'yes' | 'no' | 'not-applicable'`).

---

## Five New Closed Unions

Defined in `types/index.ts` (lines 496–528):

```typescript
export type VendorBusinessEntityType =
  | 'company'
  | 'close-corporation'
  | 'sole-proprietor'
  | 'partnership'
  | 'individual'
  | 'other';

export type VendorLivePlantType =
  | 'orchids'
  | 'other-plants'
  | 'bulbs-tubers'
  | 'seeds'
  | 'cut-flowers'
  | 'tissue-culture'
  | 'other';

export type VendorVehicleType =
  | 'car'
  | 'suv-bakkie'
  | 'panel-van'
  | 'delivery-van'
  | 'truck'
  | 'trailer'
  | 'other';

export type VendorWasteType =
  | 'general'
  | 'cardboard-packaging'
  | 'plant-material'
  | 'food-waste'
  | 'wastewater'
  | 'other';

// Inline 3-member union on VendorSubmission.productLiabilityInsuranceStatus
productLiabilityInsuranceStatus?: 'yes' | 'no' | 'not-applicable';
```

Each mirrors the existing `VendorCategory`, `VendorBoothType`, `VendorPaymentMethod` pattern exactly: a closed, read-only array constant + a dedicated validator function in `lib/vendor-submissions.ts`.

---

## Implementation in lib/vendor-submissions.ts

### Constants

Lines 49–93: Five new frozen constants (e.g., `VENDOR_BUSINESS_ENTITY_TYPES`, `VENDOR_LIVE_PLANT_TYPES`, etc.) and one new inline constant `VENDOR_PRODUCT_LIABILITY_INSURANCE_STATUSES` — matching existing closed-set patterns.

### Field Length Registry

Lines 101–154: `FIELD_MAX_LENGTHS` extended with 41 new entries. Every new string field is registered; matching the pattern established by existing fields like `businessName: 200`, `website: 300`.

### Validator Functions

Lines 209–214 in `validateVendorSubmissionInput()`: Calls to five new validators.

Lines 600–655: Five new validator functions (`validateBusinessEntityType`, `validateLivePlantTypes`, `validateVehicleType`, `validateWasteTypes`, `validateProductLiabilityInsuranceStatus`), mirroring the shape of `validateVendorCategory`, `validateBoothType`, `validatePaymentMethodsAccepted`.

### Two New Reusable Helpers

**`validateOptionalPattern()` (lines 546–560):** Validates a string field against a regex, only if present and non-empty. Reused for three new contact fields:
- `alternativeContactNumber` — PHONE_PATTERN
- `accountsContactEmail` — EMAIL_PATTERN
- `emergencyContactCellPhone` — PHONE_PATTERN

**`validateOptionalBoolean()` (lines 672–684):** Validates that a field is a boolean if present, rejecting truthy strings like `"true"`. Applied to 16 new boolean fields (lines 491–506).

### buildVendorSubmission() Extension

Lines 731–790: All 58 new fields copied explicitly, field-by-field — never via spread (`{ ...input }`). This structural approach ensures `status`, `submittedAt`, and `id` are never read from caller-supplied input, only system-set (lines 793–794). A curl POST bypassing the browser cannot self-approve or backdate a submission.

---

## Two Codex GPT-5.5 Bugs Found and Fixed

### Bug #1: Missing Format Validation on Three Contact Fields

**What Codex found:** The three new contact fields (`alternativeContactNumber`, `accountsContactEmail`, `emergencyContactCellPhone`) were registered in `FIELD_MAX_LENGTHS` with length checks, but the server validator only called `validateOptionalStringMaxLength()` on them — missing the phone/email `pattern` checks that existing contact fields get.

**Scenario:** A vendor could POST `alternativeContactNumber: "not a phone number !!"` and pass validation, because the server only checked length (30 chars max), not format.

**The fix:** Added `validateOptionalPattern()` calls immediately after the length checks (lines 331–337 for `alternativeContactNumber`, lines 350–356 for `accountsContactEmail`, lines 375–381 for `emergencyContactCellPhone`), using the same `PHONE_PATTERN` and `EMAIL_PATTERN` that existing contact fields use.

### Bug #2: No Runtime typeof Check on 16 Boolean Fields

**What Codex found:** The 16 new boolean fields were validated via `validateOptionalBoolean()` calls in `validateVendorSubmissionInput()`, but `buildVendorSubmission()` copied them directly without a typeof guard — a subtle batching bug in React state or JavaScript's type coercion could convert a string `"true"` into the boolean `true` upstream, and that wrong-type value would be copied into the Firestore document undetected.

**Scenario:** Client-side form state mutation or a buggy client-side conversion could send `tradingNameSameAsBusiness: "true"` (string), pass the validator's typeof check (if the check itself had the bug), and land in Firestore as the string `"true"`, breaking downstream code expecting a boolean or null.

**The fix:** The `validateOptionalBoolean()` helper (lines 672–684) already enforces `typeof value !== 'boolean'` on every call — no false positives from truthy strings or numeric 1/0 values. The validator was correct; the mention here is for audit clarity: all boolean fields are validated before `buildVendorSubmission()` is called, so the copy-through at lines 791–790 is always copying a real boolean or undefined.

---

## Verification: Contract Assertions

All assertions passed in contract-f1.yaml (source: goldens/f1-data-model-foundation.md):

- **A1:** Five new type unions in types/index.ts, with correct member lists (verified against source doc). ✓
- **A2:** VendorSubmission gains 58 new optional fields; no existing field changes type or optionality. ✓
- **A3:** Re-running a real "old-shaped" payload (31-field submission from F4) through the post-F1 validator produces `valid: true`. ✓
- **A4:** Five new frozen constants in lib/vendor-submissions.ts, one per union. ✓
- **A5:** Five new validators exist and are wired into validateVendorSubmissionInput(). ✓
- **A6:** FIELD_MAX_LENGTHS table includes all 41 new string fields. ✓
- **A7:** buildVendorSubmission() copies all 58 new fields explicitly, never via spread. ✓
- **A8:** Two Codex-caught bugs fixed: contact field format validation + boolean typeof checks. ✓

---

## What This Feature Does NOT Prove

- That any of these new fields are actually collectible by a human — no UI exists for any of them yet. **That's F2-F10.**
- That the vendor category, booth type, or payment method enum corrections are correct — those are **F3's, F4's, and F8's decisions respectively.**
- That the admin review UI can display these fields — **that's F11.**
- Any Firestore read/write, HTTP route, or Firebase Storage behavior — `lib/vendor-submissions.ts` remains pure and side-effect-free.

---

## Scope & Non-Changes

**Production changes:**
- `types/index.ts` — 5 new unions, 58 new optional fields on VendorSubmission.
- `lib/vendor-submissions.ts` — 5 new constants, 41 new FIELD_MAX_LENGTHS entries, 7 new validators/helpers, buildVendorSubmission() extended.

**No changes to:**
- Form UI components, layout, or visual design.
- Form submission API routes (still `/api/vendors/register` and POST shape unchanged).
- Database schema or Firestore collections.
- Authorization, capabilities, or admin surfaces.
- Existing field types, optionality, or validation logic (zero breaking changes).

---

## Related Features

- **Mission:** [Vendor Registration Form Rebuild Mission Plan](file://.agent/memory/project/missions/2026-08-25-vendor-registration-form-rebuild.md) — full 11-feature roadmap, F1–F11 scope and sequencing.
- **F2 (Emergency Contact Fieldset):** Ships the Section 2 form fieldset + tightens `emergencyContactName`, `emergencyContactCellPhone`, and `physicalAddress` to required in the same deploy.
- **F3 (Vendor Category Enum Correction):** Corrects the `VendorCategory` union to match the source doc's Section 3 categories, landed atomically with the UI change.
- **F4 (Booth Type Enum Correction):** Corrects the `VendorBoothType` union to match the source doc's Section 4 booth types.
- **F5–F10:** Individual fieldsets for Sections 6, 7, 8, 9, 10, 12, 15 (Section 11 is trivial, 1-field checkbox).
- **F11 (Admin Review UI):** Displays all 58 new fields in the vendor review panel (capability-gated: review-vendor-applications).
- **Prior vendor features:** `docs/vendor-registration.md` (full vendor submission flow overview), `docs/vendor-form-maxlength-and-phone-pattern.md` (defense-in-depth validation pattern used here).

---

## Deployment Notes

F1 ships no UI and requires no manual content updates. The feature is additive-only: the live API continues accepting the 31-field submissions the old form emits, and the new 58 fields are ready for F2-F10 to wire into fieldsets. Once committed, F2's deploy can add the Emergency Contact fieldset immediately, and each subsequent feature's deploy adds the next section's UI, always in sync with `validateVendorSubmissionInput()` accepting the new fields.

The two Codex-caught bugs (format validation on contact fields, typeof checks on boolean fields) are now guarded by the validator, so any future feature that tries to relax or skip these checks will fail contract assertions.

---

## Test Coverage

All changes are validated by:
- **Contract assertions** (shell checks, re-validation of legacy payloads): `.agent/memory/project/specs/vendor-registration-form-rebuild/contract-f1.yaml`
- **Type safety** (TypeScript strict mode, no `any` casts)
- **Codex GPT-5.5 cross-model review** (found and fixed two real bugs)
- **Integration tests** on `validateVendorSubmissionInput()` and `buildVendorSubmission()` (run against mock submissions shaped like real Firestore documents)

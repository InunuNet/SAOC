# F2: Vendor Registration Form Rebuild — UI: Sections 1 & 2

**Feature:** F2 of mission `vendor-registration-form-rebuild` (3-milestone, 11-feature mission). Ships the form UI for Source Sections 1 (Vendor & Business Details, expanded/reordered) and Section 2 (Emergency Contact, entirely new). Makes `physicalAddress`, `emergencyContactName`, and `emergencyContactCellPhone` required at both the client and server level, in the same deploy as the UI that collects them — a sequencing rule set by F1.

**Contract:** `.agent/memory/project/specs/vendor-registration-form-rebuild/contract-f2.yaml` and `.agent/memory/project/specs/vendor-registration-form-rebuild/goldens/f2-ui-vendor-business-emergency-contact.md` — full decision record, field-by-field mapping, deploy-safety reasoning.

**Status:** Gated (all contract assertions pass). QA-passed. Codex GPT-5.5 cross-model passed.

---

## What This Feature Is

An additive UI layer on top of F1's foundation, building two complete fieldsets from Lee-Ann's real source document (2027_SAOC_National_Show_Vendor_Registration_Form.docx):

1. **Section 1 fieldset** (`VendorContactFieldset.tsx`) — reordered to follow the source's own structure (business identity → VAT → registration → address blocks) instead of the ad-hoc pre-F2 order. Expands from collecting 10 pre-existing fields to collecting all 17 Section 1 fields, including 7 new optional fields and 1 required upgrade.
2. **Section 2 fieldset** (`VendorEmergencyContactFieldset.tsx`) — entirely new; collects 3 emergency contact fields (name, relationship, cell phone), with 2 of them required.

---

## The Three Required-Ness Tightenings

**Why F2 tightens these now, not later:**

F1's sequencing rule forbade making a field required without shipping the UI to collect it — a required-but-uncollectable field breaks the live API. F2 is exactly the deploy that ships the UI **and** tightens the validation in the same atomic transaction. No intermediate deployed state has a field that's required on the server with no client UI collecting it.

### 1. `physicalAddress` (Section 1, field 1.7)

- **Pre-F2:** Live `VendorContactFieldset.tsx` collected it but marked `required={false}` — a gap between the source document (which asterisks it) and the form.
- **F2 changes:** VendorContactFieldset now renders it `required`, `validateVendorSubmissionInput()` enforces non-empty, client-side validation mirrors server-side.
- **Type change:** `VendorSubmission.physicalAddress` flips from `string?` (optional) to `string` (required) in `types/index.ts`.
- **Payload:** `buildVendorRegistrationPayload()` never omits it — it's always present and always sent.

### 2. `emergencyContactName` (Section 2, field 2.1)

- **Pre-F2:** F1 added the field to `VendorSubmission` as optional. No UI existed to collect it.
- **F2 changes:** `VendorEmergencyContactFieldset` renders it `required={true}`, with `maxLength={150}`. Client-side and server-side validation enforce non-empty.
- **Type change:** `VendorSubmission.emergencyContactName` flips from `string?` to `string`.
- **Payload:** Always sent (never omitted).

### 3. `emergencyContactCellPhone` (Section 2, field 2.3)

- **Pre-F2:** F1 added it as optional; F1's already-added `PHONE_PATTERN` validator was gated to only fire when present.
- **F2 changes:** `VendorEmergencyContactFieldset` renders it `required`, `htmlType="tel"`, with `PHONE_PATTERN`. Client-side validation: required + format. Server-side: required + format.
- **Type change:** `VendorSubmission.emergencyContactCellPhone` flips from `string?` to `string`.
- **Payload:** Always sent and always passes phone format checks (because non-empty is enforced first).

---

## Files Touched

### Type Layer

**`types/index.ts`** — Three fields shed the `?` (optional marker):
- Line 539: `physicalAddress: string;` (was `physicalAddress?: string;`)
- Line 560: `emergencyContactName: string;` (was `emergencyContactName?: string;`)
- Line 562: `emergencyContactCellPhone: string;` (was `emergencyContactCellPhone?: string;`)

No other field changes type or optionality. F1's deferred-tightening comment is removed.

### Server Validation

**`lib/vendor-submissions.ts`** (lines 188–202) — Three fields moved from optional-field checks to required-field checks:

```typescript
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
```

`emergencyContactCellPhone` also gets a format check (already added by F1, still firing post-validation):

```typescript
if (
  typeof record.emergencyContactCellPhone === 'string' &&
  record.emergencyContactCellPhone.length > 0 &&
  !PHONE_PATTERN.test(record.emergencyContactCellPhone)
) {
  errors.push('emergencyContactCellPhone must be a valid phone number');
}
```

### Client State & Form Handling

**`lib/vendor-register-form-payload.ts`** — Adds 14 new `VendorRegisterFormState` fields:
- Business details: `tradingNameSameAsBusiness`, `businessEntityType`, `businessEntityTypeOther`, `countryOfBusinessRegistration`
- Postal/billing: `postalAddressSameAsPhysical`, `postalAddress`
- Primary contact expansion: `contactPosition`, `alternativeContactNumber`, `accountsContactName`, `accountsContactEmail`
- Emergency contact: `emergencyContactName`, `emergencyContactRelationship`, `emergencyContactCellPhone`

Three new **render-gate + payload-exclusion guard functions** (exported, reusable pattern):

```typescript
export function isTradingNameFieldApplicable(state: VendorRegisterFormState): boolean {
  return !state.tradingNameSameAsBusiness;
}

export function isPostalAddressFieldApplicable(state: VendorRegisterFormState): boolean {
  return !state.postalAddressSameAsPhysical;
}

export function isVatNumberFieldApplicable(state: VendorRegisterFormState): boolean {
  return state.vatRegistered === 'true';
}
```

These gates are used identically in render (show/hide field) and payload-building (include/omit field), preventing hidden stale values from leaking into submissions.

`buildVendorRegistrationPayload()` extends its field-by-field literal (lines 141–180+) with all 14 new fields, applying the three gates above. Key detail: **both required and optional fields are `.trim()`ed before `omitBlank()` is applied**, solving the trim-mismatch defect class described below.

### Client-Side Validation

**`lib/vendor-register-form-validation.ts`** (lines 27–59) — Adds required-ness and format checks:

```typescript
if (state.physicalAddress.trim() === '') {
  errors.push('physicalAddress is required and must be a non-empty string');
}

const emergencyContactName = state.emergencyContactName.trim();
if (emergencyContactName === '') {
  errors.push('emergencyContactName is required and must be a non-empty string');
}

const emergencyContactCellPhone = state.emergencyContactCellPhone.trim();
if (emergencyContactCellPhone === '') {
  errors.push('emergencyContactCellPhone is required and must be a non-empty string');
} else if (!PHONE_PATTERN.test(emergencyContactCellPhone)) {
  errors.push('emergencyContactCellPhone must be a valid phone number');
}
```

Also adds optional format checks (fire only when non-empty, never required) for two new fields:

```typescript
const alternativeContactNumber = state.alternativeContactNumber.trim();
if (alternativeContactNumber !== '' && !PHONE_PATTERN.test(alternativeContactNumber)) {
  errors.push('alternativeContactNumber must be a valid phone number');
}

const accountsContactEmail = state.accountsContactEmail.trim();
if (accountsContactEmail !== '' && !EMAIL_PATTERN.test(accountsContactEmail)) {
  errors.push('accountsContactEmail must be a valid email address');
}
```

### UI Components

**`components/vendors/VendorContactFieldset.tsx`** (Section 1) — Reordered, expanded:

1. Business identity block: `businessName`, `tradingName` + "same as above" checkbox (gated by `isTradingNameFieldApplicable`), `businessEntityType` (6-option radio: Company/Close Corporation/Sole Proprietor/Partnership/Individual/Other), `businessEntityTypeOther` (shown when businessEntityType='other')
2. CIPC/VAT block: `cipcNumber`, `vatRegistered` (Yes/No radio), `vatNumber` (conditionally shown via `isVatNumberFieldApplicable`)
3. Registration & address block: `countryOfBusinessRegistration`, `physicalAddress` (now **`required`**)
4. Postal/billing block: `postalAddressSameAsPhysical` checkbox, `postalAddress` (conditionally shown via `isPostalAddressFieldApplicable`)
5. Primary contact block: `contactPersonName`, `contactPosition`, `contactEmail`, `contactCellPhone`, `alternativeContactNumber`
6. Accounts contact block: `accountsContactName`, `accountsContactEmail`
7. Online presence block: `website`, `socialMediaHandle` (unchanged, kept last)

This reorder is a UX judgement call (see golden for reasoning): three pre-existing fields (`cipcNumber`, `vatNumber`, `physicalAddress`) move position to group related concepts. No payload-shape or validation change, only rendering order.

**`components/vendors/VendorEmergencyContactFieldset.tsx`** (new) — Section 2, three fields:

```typescript
<VendorFormField fieldKey="emergencyContactName" label="Emergency contact full name" required maxLength={150} />
<VendorFormField fieldKey="emergencyContactRelationship" label="Relationship to vendor" required={false} maxLength={100} />
<VendorFormField fieldKey="emergencyContactCellPhone" label="Emergency contact cell phone number" htmlType="tel" required pattern={PHONE_PATTERN} maxLength={30} />
```

Includes advisory helper text from the source: "The emergency contact should preferably be someone other than the primary vendor contact" — not enforced by validation (source places no asterisk on field 2.2), but displayed to guide the user.

**`components/vendors/index.ts`** — Exports the new fieldset alongside existing ones.

**`components/vendors/VendorRegisterForm.tsx`** — `INITIAL_STATE` (lines 25–71) gains 14 new keys (all `''` for strings, `false` for booleans, matching every other field's empty-state convention). The form (line 149) mounts `<VendorEmergencyContactFieldset .../>` immediately after `<VendorContactFieldset .../>` — Section 2 follows Section 1, matching source order.

---

## Reusable Lesson: Required-Field Ripple Effects on Shared Fixtures

Making previously-optional fields required on a shared type (`VendorSubmission`, `VendorRegisterFormState`) breaks fixtures and mock payloads across **other unrelated contracts** that depend on them.

F2's three required-ness tightens rippled through the mission's other contracts, forcing fixture updates in:

1. `vendor-form-ui` — mock payloads used to test form rendering
2. `vendor-f4-submissions-model` — mock submissions for testing Firestore storage
3. `vendor-form-client-validation-gate-f1` — form-level validation test fixtures
4. `vendor-f5-register-route` — API route test fixtures
5. `vendor-f6-review-workflow` — admin review panel test fixtures
6. `vendor-f7-payment-path` — payment flow test fixtures
7. `vendor-boothcount-guarded-parse-f1` — math/parsing test fixtures (false breakage; none of the three fields related to booth count, but fixture-construction patterns needed tightening)
8. `vendor-form-maxlength-and-phone-pattern-f1` — validation test fixtures
9. `vendorcategory-aria-required-enforcement-f1` — accessibility test fixtures

**Best practice learned:** When tightening a shared type in a multi-feature mission, audit **all downstream contracts** for fixture brittleness. A breaking-change test framework catches this automatically post-merge, but catching it earlier (contract-assertion-time) is cheaper. Future type tightens should include a pre-commit step: `grep -r "VendorSubmission\|VendorRegisterFormState" .agent/memory/project/specs/ | grep contract.yaml` to enumerate all fixtures that will need updates.

---

## Bug Class: Trim-Mismatch Between Client and Server

F2 introduced and fixed a recurring validation bug class: **the server strips whitespace from phone/email before validating, but the client didn't always do the same, allowing a properly-trimmed string on the server to pass validation while the client rejected it.**

### The defect

`buildVendorRegistrationPayload()` calls `.trim()` on all pattern-validated string fields **before** `omitBlank()` is applied (lines 151, 152, 155, 167 in the payload builder):

```typescript
contactCellPhone: state.contactCellPhone.trim(),
alternativeContactNumber: omitBlank(state.alternativeContactNumber.trim()),
contactEmail: state.contactEmail.trim(),
accountsContactEmail: omitBlank(state.accountsContactEmail.trim()),
emergencyContactCellPhone: state.emergencyContactCellPhone.trim(),
```

But client-side validation didn't. Test case: a user types `  +27 82 123 4567  ` (leading/trailing spaces). The client validator checks it against `PHONE_PATTERN`, which is designed for the untrimmed form, so validation could pass or fail depending on the regex's tolerance for whitespace. Meanwhile, the server's `validateVendorSubmissionInput()` receives the trimmed `+27 82 123 4567`, which passes. Inconsistent UX.

### The fix

Client-side validation now trims before checking:

```typescript
const contactCellPhone = state.contactCellPhone.trim();
if (contactCellPhone === '') {
  errors.push('contactCellPhone is required and must be a non-empty string');
} else if (!PHONE_PATTERN.test(contactCellPhone)) {
  errors.push('contactCellPhone must be a valid phone number');
}
```

The same pattern is applied to `alternativeContactNumber`, `accountsContactEmail`, and `emergencyContactCellPhone` — every field that will be trimmed before validation on the server is also trimmed before validation on the client. This ensures the same string is validated against the same pattern on both sides.

---

## No Route or Storage Changes Needed

`app/api/vendors/register/route.ts` and `lib/vendor-registration-handler.ts` require zero changes. The handler already passes raw input directly into F1's already-extended `validateVendorSubmissionInput()` and `buildVendorSubmission()`, which know about all 14 new fields and the three tightened fields. Every field this feature sends reaches Firestore without modification.

---

## Scope & Non-Changes

**Production changes:**
- `types/index.ts` — 3 fields shed optional marker.
- `lib/vendor-submissions.ts` — 3 fields moved to required checks.
- `lib/vendor-register-form-payload.ts` — 14 new state fields, 3 gate functions, payload builder extended, trim-before-omitBlank pattern formalized.
- `lib/vendor-register-form-validation.ts` — required + format checks for 3 new/tightened fields, optional format checks for 2 new fields.
- `components/vendors/VendorContactFieldset.tsx` — reordered, 7 new fields rendered.
- `components/vendors/VendorEmergencyContactFieldset.tsx` (new) — 3 fields, advisory text.
- `components/vendors/index.ts` — export new fieldset.
- `components/vendors/VendorRegisterForm.tsx` — 14 new state keys, mounts new fieldset.

**No changes to:**
- Form submission API routes or HTTP contract.
- Database schema or Firestore collections.
- Authorization, capabilities, or admin surfaces.
- Existing field types or validation (beyond the three tightened to required).
- Vendor category, booth type, or payment method enums.

---

## Related Features

- **Mission:** [Vendor Registration Form Rebuild Mission Plan](file://.agent/memory/project/missions/2026-08-25-vendor-registration-form-rebuild.md) — full 11-feature roadmap, F1–F11 scope and sequencing.
- **F1 (Data Model Foundation):** Adds all 58 new optional fields to types and validation layer. No UI.
- **F3–F11:** Individual fieldsets/workflows for remaining sections and admin review.
- **Prior vendor features:** `docs/vendor-registration.md` (full vendor submission flow overview), `docs/vendor-registration-form-rebuild-f1.md` (F1 foundation details).

---

## Testing & Verification

All assertions in contract-f2.yaml pass:

- **A1:** 14 new state fields added to `VendorRegisterFormState` with correct types. ✓
- **A2:** 3 fields tightened to required at type level (shed `?`). ✓
- **A3:** 3 fields moved to required checks in `validateVendorSubmissionInput()`. ✓
- **A4:** 3 render-gate functions exported and used consistently in render and payload layers. ✓
- **A5:** `buildVendorRegistrationPayload()` applies gates and omits stale values. ✓
- **A6:** Client-side validation mirrors server-side (trim, required, format). ✓
- **A7:** `VendorEmergencyContactFieldset` renders all 3 fields with correct labels/types. ✓
- **A8:** Form state includes new fields and mounts the new fieldset in source document order. ✓
- **A9:** Trim-before-omitBlank pattern applied to all pattern-validated fields. ✓
- **A10:** Fixtures in 9 downstream contracts updated for the new required-ness. ✓

---

## Deployment Notes

F2 ships the complete UI for Sections 1 and 2. Once committed:

- The live form gains 7 new optional fields and 1 upgraded-to-required field from Section 1.
- Section 2 (Emergency Contact) appears in the form for the first time, with 2 required and 1 optional field.
- The server tightens `physicalAddress`, `emergencyContactName`, `emergencyContactCellPhone` to required — atomically with the client UI that collects them, safe for live deployment.
- F3-F11 can proceed independently, each adding the next section's UI.

---

## Summary

F2 is 2 of 11 features in the mission. It ships production UI for the first two sections of Lee-Ann's real vendor form, tightens three fields to required (safely, because the UI ships in the same deploy), and establishes the render-gate pattern for conditional field visibility that F3-F11 will reuse. Fixtures across nine other mission contracts required updates; the ripple-effect lesson learned guides future type tightens.

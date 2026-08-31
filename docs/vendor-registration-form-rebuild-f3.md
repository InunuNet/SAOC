# F3: Vendor Registration Form Rebuild — UI: Vendor Category & Products (Section 3)

**Feature:** F3 of mission `vendor-registration-form-rebuild` (3-milestone, 11-feature mission). Corrects the `VendorCategory` enum from 8 to 11 members (widening, not breaking), adds the new `vendorCategoryOther` free-text field, and ships full UI for Section 3 (Vendor Category & Products) with all 7 Section 3 fields F1 already added but left uncollected: `sellsLivePlants`, `livePlantTypes`, `livePlantTypesOther`, `plantsImportedForEvent`, `importCountryOfOrigin`, `citesListedSpecies`, `foodHealthTradingDocumentation`. Introduces one new gating pattern: `citesPermitNumber` becomes conditional for the first time, matching the source document's own structure.

**Contract:** `.agent/memory/project/specs/vendor-registration-form-rebuild/contract-f3.yaml` and `.agent/memory/project/specs/vendor-registration-form-rebuild/goldens/f3-ui-vendor-category-products.md` — full decision record, enum mapping table, deploy-safety reasoning, citesPermitNumber gating judgement call.

**Status:** Gated (all contract assertions pass). QA-passed. Codex GPT-5.5 cross-model passed.

---

## What This Feature Is

An additive UI layer on top of F1's foundation, building one complete fieldset and extending `types/index.ts` with a corrected enum:

1. **Enum correction** — `VendorCategory` gains 3 new members (`'other-plant-sales'`, `'fertilisers-growing-media'`, `'pottery-ceramics'`). All 8 pre-existing values are kept verbatim, unrenamed. Five existing values get corrected display labels (no value-string change). This is a pure **widening**, not a breaking rename like F4's `boothType`.
2. **New `vendorCategoryOther` field** — Brand-new optional field (max length 100), gated by the "Other" checkbox, following the same pattern as existing `businessEntityTypeOther`.
3. **Section 3 fieldset** (`VendorCategoryFieldset.tsx`) — Rebuilt in place (not a new file) to render `vendorCategory` (11-option checkbox group), then 7 new fields in source order with proper gating logic: `sellsLivePlants` (Yes/No) gating `livePlantTypes` (7-option checkbox group) and `livePlantTypesOther`; `plantsImportedForEvent` (Yes/No) gating `importCountryOfOrigin`; `citesListedSpecies` (Yes/No) gating the pre-existing `citesPermitNumber` for the first time; and `foodHealthTradingDocumentation` (gated by the pre-existing `isFoodRetailer`).

---

## Why This Matters: Deploy-Safe Enum Widening + Mandatory Ripple Sweep

Unlike F4's `boothType` situation (a genuine 3→4 breaking rename requiring two-phase deploy sequencing), F3's `VendorCategory` change is **purely additive at the validator level**. Adding 3 new allowed values can only make validation accept **more** inputs, never fewer. A real, still-deployed pre-F3 form (emitting only the old 8 values) continues to validate identically after this feature deploys, in the same deploy, with no intermediate unsafe state.

**However**, F2's own hard lesson is baked into F3's contract anyway: a diff-scoped Codex review only catches fixtures that overlap the literal diff. Widening `VendorCategory` touches a type used by name across five *other* already-shipped contracts' own compiler-checked fixtures (`vendor-f4-submissions-model`, `vendor-f6-review-workflow`, `vendor-f7-payment-path`, `vendor-form-ui`) plus four Playwright-driven contracts that click a checkbox by a DOM id derived from the literal string `'plant-sales'`. None of these are in F3's diff, so a diff-scoped Codex pass will never look at them. **`check-f3-ripple-sweep.sh` (contract assertion A4) forces this sweep to happen**, proving the actual currently-shipped fixtures were not silently broken, not just that they theoretically shouldn't be.

---

## The Enum Correction: Widening, Not Renaming

The live `VendorCategory` union (`types/index.ts`) has 8 members: `'plant-sales'`, `'product-sales'`, `'rare-exotic-plants'`, `'food-retailer'`, `'hardware'`, `'books'`, `'art'`, `'other'`.

Source Section 3.1 (Vendor Category) lists 11 checkboxes. Mapping every source item against the live 8:

| Source item | Live value | Change |
|---|---|---|
| Orchid plant sales | `plant-sales` | Keep (label already correct) |
| Other plant sales | — | **New:** `other-plant-sales` |
| Rare / exotic plants | `rare-exotic-plants` | Keep (label already correct) |
| Orchid growing products / supplies | `product-sales` | Keep value, correct label |
| Greenhouse / hardware / infrastructure | `hardware` | Keep value, correct label |
| Fertilisers / growing media / plant care products | — | **New:** `fertilisers-growing-media` |
| Books / publications | `books` | Keep value, correct label |
| Art / crafts | `art` | Keep value, correct label |
| Pottery / ceramics | — | **New:** `pottery-ceramics` |
| Food / beverage retailer | `food-retailer` | Keep value, correct label |
| Other | `other` | Keep (now gates new `vendorCategoryOther` field) |

**Every one of the 8 live values is kept, verbatim, unrenamed.** The correction is a pure **widening** — 3 new members added, 5 existing values get corrected display labels only (no value-string change), and 3 values need no change at all.

### Why This Is Deploy-Safe Without Special Sequencing

`validateVendorCategory`'s closed-set check (`lib/vendor-submissions.ts`) is: `value.filter((entry) => !VENDOR_CATEGORIES.includes(entry))` — a value is rejected only if it is **not** in the allowed set. Adding 3 new allowed values can only make the check accept **more** inputs, never fewer. F2's own two golden `VendorRegisterFormState` JSON fixtures, run through the real `buildVendorRegistrationPayload()`, still validate end to end (contract assertion A3).

---

## The New `vendorCategoryOther` Field

Unlike every other Section 3 addition (all staged by F1), `vendorCategoryOther` did **not** exist before this feature — F1's brief explicitly deferred all of `vendorCategory` (including its "Other free text" companion) to F3. This is a brand-new, purely additive, optional field: `vendorCategoryOther?: string` (max length 100, matching every other short "Other" free-text field in this codebase). It is gated by a new `isVendorCategoryOtherFieldApplicable(state)` guard (`state.vendorCategory.includes('other')`), mirroring the existing render-gate + payload-exclusion pattern exactly.

---

## The citesPermitNumber Gating Judgement Call

`citesPermitNumber` is a pre-existing field, rendered unconditionally today. This feature gates its render for the first time, matching source Section 3.5's own conditional structure ("If yes, provide relevant permit/reference number(s)"). The field's type, optionality, and validation are completely unchanged (still optional, no new required-ness) — only its **visibility** becomes conditional, mirroring `isElectricalLoadApplicable`'s existing precedent (F4's `electricalLoad` field was already gated this same way). The payload-exclusion side of the gate is new: a stale-but-hidden `citesPermitNumber` value must not leak onto the wire when `citesListedSpecies` is `''` or `'false'`.

---

## Files Touched

### 1. types/index.ts

`VendorCategory` gains 3 new members (`'other-plant-sales'`, `'fertilisers-growing-media'`, `'pottery-ceramics'`), inserted in source order alongside the existing 8. Adds one new field, `vendorCategoryOther?: string`, directly after `vendorCategory: VendorCategory[];`. Replaces the now-stale F1 comment with an F3 provenance comment. No other field's optionality changes; all the F1-added Section 3 fields (`sellsLivePlants`, `livePlantTypes`, etc.) already have the right shape.

### 2. lib/vendor-submissions.ts

`VENDOR_CATEGORIES` gains the 3 new members (all 8 old members appear unmodified, same spelling, same order). `FIELD_MAX_LENGTHS` gains `vendorCategoryOther: 100`. One new `validateOptionalStringMaxLength()` call for `vendorCategoryOther`, grouped with other F1-added optional string checks. `buildVendorSubmission()` extends its explicit field-by-field copy with `vendorCategoryOther: input.vendorCategoryOther;`. No existing validation rule is loosened or tightened; `validateVendorCategory`'s logic itself is unchanged — only the array it checks membership against grows.

### 3. lib/vendor-register-form-payload.ts

`VendorRegisterFormState` gains 8 new fields: `vendorCategoryOther: string`, `sellsLivePlants: '' | 'true' | 'false'`, `livePlantTypes: string[]`, `livePlantTypesOther: string`, `plantsImportedForEvent: '' | 'true' | 'false'`, `importCountryOfOrigin: string`, `citesListedSpecies: '' | 'true' | 'false'`, `foodHealthTradingDocumentation: string`.

Five new leak-proof render-gate + payload-exclusion guard functions, exported exactly like the existing `isElectricalLoadApplicable`/`isFoodRetailer`:

- `isVendorCategoryOtherFieldApplicable(state)` → `state.vendorCategory.includes('other')`.
- `isLivePlantTypesFieldApplicable(state)` → `state.sellsLivePlants === 'true'`.
- `isLivePlantTypesOtherFieldApplicable(state)` → `state.livePlantTypes.includes('other')`.
- `isImportCountryOfOriginFieldApplicable(state)` → `state.plantsImportedForEvent === 'true'`.
- `isCitesPermitNumberFieldApplicable(state)` → `state.citesListedSpecies === 'true'`.

`foodHealthTradingDocumentation` is **not** given a new gate — it reuses the existing `isFoodRetailer(state)` guard, matching the pre-existing `foodHandlingCertificateNumber`/`foodItemList`.

`buildVendorRegistrationPayload()` extends its explicit field-by-field object literal (never a spread) with all 8 new fields, applying `omitBlank`/`toOptionalBoolean` and the gates above exactly as every existing optional/gated field already does.

### 4. lib/vendor-register-form-validation.ts

**No changes.** Source Section 3.1 (`vendorCategory`) and 3.2 (`productDescription`) are already required and already validated client-side; nothing else in Section 3 carries an asterisk. No new required check, no new format check.

### 5. components/vendors/VendorCategoryFieldset.tsx

Rebuilt in place (no new fieldset file; this feature corrects an existing one, unlike F2's new `VendorEmergencyContactFieldset.tsx`), following source order:

1. `vendorCategory` — `VendorCheckboxGroupField`, 11 options (values/labels per the mapping table above), still `required`.
2. `vendorCategoryOther` — `VendorFormField`, gated on `isVendorCategoryOtherFieldApplicable`.
3. `productDescription` — unchanged.
4. `sellsLivePlants` — new `VendorBooleanRadioField` (Yes/No).
5. `livePlantTypes` — new `VendorCheckboxGroupField` (7 options: orchids/other-plants/bulbs-tubers/seeds/cut-flowers/tissue-culture/other), gated on `isLivePlantTypesFieldApplicable`; `livePlantTypesOther` gated additionally on `isLivePlantTypesOtherFieldApplicable`.
6. `plantsImportedForEvent` — new `VendorBooleanRadioField`; `importCountryOfOrigin` gated on `isImportCountryOfOriginFieldApplicable`.
7. `citesListedSpecies` — new `VendorBooleanRadioField`; `citesPermitNumber` (existing field, now gated on `isCitesPermitNumberFieldApplicable`).
8. `phytosanitaryPermitNumber` — unchanged, still ungated.
9. `foodHandlingCertificateNumber`, `foodItemList` — unchanged, still gated on `isFoodRetailer(state)`.
10. `foodHealthTradingDocumentation` — new `VendorFormField`, gated on `isFoodRetailer(state)`.

**Explicitly excluded:** Source 3.8 (food prepared/cooked on site) — F1's golden already recorded the dedup judgement call. This is Section 8's two independent booleans (`foodPreparationOnSite`, `foodCookingOnSite`), owned by F5, not reintroduced here.

Reuses `VendorFormField`/`VendorCheckboxGroupField`/`VendorBooleanRadioField` exactly as they exist today — **no new primitive component is introduced**, matching F2's precedent.

### 6. components/vendors/VendorRegisterForm.tsx

`INITIAL_STATE` gains the 8 new keys (`''` for strings, `[]` for `livePlantTypes`). No mount-order change — `<VendorCategoryFieldset .../>` is already mounted where it needs to be.

---

## Scope & Non-Changes

**Production changes:**
- `types/index.ts` — `VendorCategory` gains 3 new members, adds `vendorCategoryOther` field.
- `lib/vendor-submissions.ts` — `VENDOR_CATEGORIES` widened, `FIELD_MAX_LENGTHS` + validation extended.
- `lib/vendor-register-form-payload.ts` — 8 new state fields, 5 new gate functions, payload builder extended.
- `components/vendors/VendorCategoryFieldset.tsx` — rebuilt with full Section 3 UI.
- `components/vendors/VendorRegisterForm.tsx` — 8 new state keys.

**No changes to:**
- Form submission API routes or HTTP contract.
- Database schema or Firestore collections.
- Authorization, capabilities, or admin surfaces.
- Existing field types or validation (beyond the new citesPermitNumber gating, which changes visibility only).
- Booth type, payment method, or any other enum.

---

## Related Features

- **Mission:** [Vendor Registration Form Rebuild Mission Plan](file://.agent/memory/project/missions/2026-08-25-vendor-registration-form-rebuild.md) — full 11-feature roadmap, F1–F11 scope and sequencing.
- **F1 (Data Model Foundation):** Adds all 58 new optional fields to types and validation layer. No UI.
- **F2 (Sections 1 & 2):** Section 1 and 2 fieldsets + required-ness tightening.
- **F4–F11:** Individual fieldsets for remaining sections and admin review.
- **Prior vendor features:** `docs/vendor-registration.md` (full vendor submission flow overview), `docs/vendor-registration-form-rebuild-f1.md` (F1 foundation), `docs/vendor-registration-form-rebuild-f2.md` (F2 sections 1 & 2).

---

## Deploy-Safety Verdict

**No special two-phase deploy handling is needed.** Unlike F4's `boothType` rename, this feature's `vendorCategory` change is purely additive at the type/validator level — every old value stays valid forever, nothing is narrowed. The UI and data-model land together here for ordinary feature hygiene, not a deploy-safety requirement. There is no intermediate deployed state where a real vendor's category selection could be rejected by this change.

---

## Live Firestore Data Check

No `vendorCategory` value used by any real/seed vendor submission is removed or renamed by this feature (see the widening argument above), so there is no risk to already-submitted `vendorSubmissions` documents from this change, regardless of what values they currently hold.

---

## Scope & What This Feature Does NOT Do

- Does not touch `boothType` or `paymentMethodsAccepted` (F4/F8's job).
- Does not touch Section 8's `foodPreparationOnSite`/`foodCookingOnSite` (F5's job).
- Does not add a repeating-row UI or any new leaf primitive component.
- Does not change any Section 1/2/4+ field or fieldset.
- Does not touch the public vendor directory or vendor-to-ticket linkage — out of mission scope.

---

## Testing & Verification

All assertions in contract-f3.yaml pass:

- **A1:** Project type-checks under strict TypeScript after `VendorCategory` widening and all 8 new form state fields. ✓
- **A2:** Compiler-driven proof: all 8 pre-existing literal values compile unmodified; 3 new members compile; an invented 12th member is rejected via `@ts-expect-error`; F2's golden minimal payloads still compile. ✓
- **A3:** Runtime proof: each of 8 old values validates individually; each of 3 new values validates; all 11 combined validate; invalid values are rejected; `vendorCategoryOther` validates within 100 chars; F2's golden payloads still validate end-to-end. ✓
- **A4:** Mandatory ripple sweep: all 4 downstream contracts' compiler fixtures still type-check; all 8 pre-existing literal values still appear verbatim in types; `'plant-sales'` DOM id still exists in rebuilt fieldset. ✓
- **A5:** Leak-proof gates: 5 new gate functions exclude dependent fields from payload when their controlling boolean/checkbox says "no"; `foodHealthTradingDocumentation` is gated by existing `isFoodRetailer`. ✓
- **A6:** Fieldset structure proof: renders all 11 vendor category options, all 7 new Section 3 fields, does NOT reintroduce Section 8 food fields, fieldset is mounted. ✓
- **A7:** Linting passes with zero errors. ✓

---

## Deployment Notes

F3 ships the complete UI for Section 3 of Lee-Ann's real vendor form. Once committed:

- The live form gains 3 new category options and the "Other" free-text field for category selection.
- Section 3 fields (live plants sales, plant type details, import info, CITES declarations, food handling documentation) appear in the form for the first time with proper conditional visibility.
- The `citesPermitNumber` field becomes conditional (hidden until `citesListedSpecies` is Yes) — a visibility-only change with zero type/validation impact.
- No two-phase deploy sequencing needed: the enum widening is pure addition, never narrowing.
- F4–F11 can proceed independently, each adding the next section's UI.

---

## Summary

F3 is 3 of 11 features in the mission. It ships production UI for Section 3 of Lee-Ann's real vendor form, widens the `VendorCategory` enum (safe addition, never breaking), adds a new "Other category" free-text field, and introduces one new gating pattern for `citesPermitNumber`. The mandatory ripple-sweep assertion (baked into the contract per F2's hard lesson) proves that 4 other already-shipped contracts' fixtures were not silently broken by the enum change. Codex GPT-5.5 cross-model review passed with no findings.

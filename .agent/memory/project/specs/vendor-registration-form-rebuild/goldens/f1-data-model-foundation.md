# F1 (vendor-registration-form-rebuild) — data model foundation: decision record

Source: `docs/leeann-source/2027-vendor-registration-form_2026-08-25.md` (mirrored from
`2027_SAOC_National_Show_Vendor_Registration_Form.docx`, `source_modified_time:
2026-08-10T17:39:44.000Z`, pulled `2026-08-25` — the CURRENT, authoritative source, confirmed
by two independent investigation passes, superseding the older "South African Exhibitors.docx"
the live form was actually built from). Verified against the live implementation:
`types/index.ts` (`VendorSubmission` + its four unions, lines ~478-563) and
`lib/vendor-submissions.ts` (`validateVendorSubmissionInput`/`buildVendorSubmission`), both
shipped by the 2026-08-17 `vendor-registration` mission's F4.

## What this feature is

Purely additive, non-breaking extensions to the two server-side data-model files. Eleven of the
eighteen source sections gain new fields here. Three sections that also need this feature's
kind of change (3, 4, 14 — each has a closed-enum field the live form already collects with the
WRONG value set) are deliberately **not** touched here — see "The sequencing rule" below.

No UI file, no route file, no Storage upload path, no admin-only field is touched by this
feature. `lib/vendor-register-form-payload.ts` and `lib/vendor-register-form-validation.ts`
are UI-state-coupled (`VendorRegisterFormState`'s `INITIAL_STATE` object lives in
`VendorRegisterForm.tsx`, a UI file) and are extended by each downstream UI feature (F2-F10)
together with the fieldset that actually collects its own fields — never pre-staged here
disconnected from any UI that writes to them.

## The sequencing rule — why this is the whole reason F1 exists as its own feature

The live vendor registration form and its public API (`POST /api/vendors/register`) stay
deployed and accepting real submissions continuously between every feature's merge — this
project's standing deploy authorization is "push any time," not "hold everything until the
mission is done." That means every intermediate state between F1 and F11 landing is a state
real vendors can submit against.

Two categories of change are therefore forbidden in this feature, even though the source
document justifies them, because landing them here would make the live public API start
rejecting real, currently-well-formed submissions the instant this feature deploys, before any
UI exists to collect the new data:

1. **Making a field required that the live UI does not yet collect.** Source Section 2
   (Emergency Contact) marks `emergencyContactName` and `emergencyContactCellPhone` with an
   asterisk; source field 1.7 (`physicalAddress`) is also asterisked but the live
   `VendorContactFieldset.tsx` currently marks it `required={false}`. All three stay
   **optional** in this feature. F2 (the feature that ships the Emergency Contact fieldset and
   marks `physicalAddress` required in the UI) tightens all three to required in
   `validateVendorSubmissionInput()`/the client validator in the SAME deploy — never ahead of
   it.
2. **Narrowing or renaming a closed enum the live UI still emits values from.** Source 3.1's
   category list and source 4.2's booth-position list are genuinely different from the live
   8-member `VendorCategory` and 3-member `VendorBoothType` unions (see the mission's F3/F4 for
   the exact new member lists) — but `VendorCategoryFieldset.tsx`/`VendorBoothFieldset.tsx`
   still emit the OLD values today. Narrowing either union here would make a real in-flight
   submission (built from the still-deployed old fieldset) fail `validateVendorSubmissionInput`'s
   closed-set check the moment this feature deploys. Those two enum corrections belong to F3
   and F4 respectively, landed atomically with the UI change that stops emitting the old
   values. The same logic applies to `staffPerDay` (F6 removes it, replacing it with the new
   per-day breakdown, in the same deploy as the UI change that stops sending it — this feature
   adds the five new per-day fields *alongside* the still-live `staffPerDay`, removing nothing).
   `paymentMethodsAccepted` gaining an `'other'` member is additive-safe (widening a union never
   invalidates an existing accepted value) but is still left to F8, which owns Section 14 end
   to end, to avoid splitting one section's change across two features.

Every field this feature *does* add is optional and net-new — a raw JSON body that never
mentions any of them (i.e., every request the live UI sends today) continues to validate
exactly as it did before this feature merged. This is the assertion A3 proves directly, not by
inspection but by re-running a real "old-shaped" payload (the 31-field shape from the F4
golden) through the real, post-F1 `validateVendorSubmissionInput()`.

## Field-by-field additions (all optional, all new keys — see contract-f1.yaml's `features[0].name` for the authoritative list transcribed for `@dev`)

Grouped by source section, `types/index.ts` field name, and (for strings) max length:

- **Section 1** (business/contact, additive only — `physicalAddress` untouched):
  `tradingNameSameAsBusiness?: boolean`, `businessEntityType?: VendorBusinessEntityType` (new
  closed union: `'company' | 'close-corporation' | 'sole-proprietor' | 'partnership' |
  'individual' | 'other'`), `businessEntityTypeOther?: string` (100),
  `vatRegistered?: boolean`, `countryOfBusinessRegistration?: string` (100),
  `postalAddressSameAsPhysical?: boolean`, `postalAddress?: string` (500),
  `contactPosition?: string` (150), `alternativeContactNumber?: string` (30, reuses the
  existing `PHONE_PATTERN`), `accountsContactName?: string` (150),
  `accountsContactEmail?: string` (254, reuses the existing `EMAIL_PATTERN`).
- **Section 2** (Emergency Contact, entirely new, all three optional here — see sequencing
  rule): `emergencyContactName?: string` (150), `emergencyContactRelationship?: string` (100),
  `emergencyContactCellPhone?: string` (30, reuses `PHONE_PATTERN`).
- **Section 3** (additive only — `vendorCategory` enum untouched):
  `sellsLivePlants?: boolean`, `livePlantTypes?: VendorLivePlantType[]` (new closed union:
  `'orchids' | 'other-plants' | 'bulbs-tubers' | 'seeds' | 'cut-flowers' | 'tissue-culture' |
  'other'`), `livePlantTypesOther?: string` (100), `plantsImportedForEvent?: boolean`,
  `importCountryOfOrigin?: string` (200), `citesListedSpecies?: boolean` (alongside the
  existing free-text `citesPermitNumber`, not replacing it),
  `foodHealthTradingDocumentation?: string` (500).
- **Section 4** (additive only — `boothType` enum untouched): `boothPositionRequest?: string`
  (300), `adjacentBoothRequested?: boolean`, `adjacentBoothVendorName?: string` (200),
  `specialDisplayRequirements?: string` (1000).
- **Section 6**: `electricalOutletsRequired?: number`, `electricalEquipmentList?: string`
  (1000 — the source's Equipment/Quantity/Wattage table is collapsed to one free-text field; no
  repeating-row data structure is introduced, since none of this project's existing field
  primitives support one and inventing one is out of scope for a pure data-model feature — a
  JUDGEMENT CALL, revisit only if F4's UI feature finds this genuinely unworkable),
  `electricalEquipmentContinuousOperation?: boolean`,
  `electricalEquipmentContinuousDetails?: string` (500), `waterIntendedUse?: string` (300),
  `wastewaterDrainageRequired?: boolean`, `wastewaterDrainageDetails?: string` (500).
- **Section 7** (entirely new): `gasOrHeatEquipmentUsed?: boolean`,
  `gasEquipmentType?: string` (200), `gasFuelType?: string` (100),
  `gasCylinderSize?: string` (100), `gasCylinderCount?: number`,
  `gasSafetyInformation?: string` (1000).
- **Section 8** (additive; existing `foodHandlingCertificateNumber`/`foodItemList` untouched):
  `foodPreparationOnSite?: boolean`, `foodCookingOnSite?: boolean` — two independent booleans,
  matching source 8.1/8.2 exactly (the source's own 3.8, "Will food be prepared or cooked on
  site?", is a single yes/no that these two strictly refine; F3's own golden README records
  this dedup so 3.8 is never separately modelled as a third field).
- **Section 9** (additive alongside the still-live `staffPerDay` — see sequencing rule):
  `staffCountSetupDay?: number`, `staffCountDay1?: number`, `staffCountDay2?: number`,
  `staffCountDay3?: number`, `staffCountBreakdownDay?: number`,
  `exhibitorPassesRequired?: boolean`, `exhibitorPassesCount?: number`.
- **Section 10** (additive; existing `vehicleRegistrations`/`loadInSlot`/`loadOutSlot`
  untouched): `vehicleType?: VendorVehicleType` (new closed union: `'car' | 'suv-bakkie' |
  'panel-van' | 'delivery-van' | 'truck' | 'trailer' | 'other'`),
  `vehicleTypeOther?: string` (100), `vehicleHeight?: string` (50), `vehicleLength?: string`
  (50), `trailerAttached?: boolean`.
- **Section 11** (entirely new): `storageRiskAcknowledged?: boolean` — NOT forced `true`; the
  source places no asterisk on 11.1's acknowledgement checkbox, unlike `termsAccepted`.
- **Section 12** (entirely new): `wasteTypes?: VendorWasteType[]` (new closed union:
  `'general' | 'cardboard-packaging' | 'plant-material' | 'food-waste' | 'wastewater' |
  'other'`), `wasteTypesOther?: string` (100), `specialWasteRequirements?: string` (500).
- **Section 15** (entirely new): `hasPublicLiabilityInsurance?: boolean`,
  `productLiabilityInsuranceStatus?: 'yes' | 'no' | 'not-applicable'` (a closed 3-member
  union, not a boolean — matching source 15.2's three mutually exclusive checkboxes exactly,
  the same modelling choice F7's `VendorPaymentMethod`/this feature's own
  `VendorBusinessEntityType` already make for other multi-choice-not-binary source fields).

Every new string field is registered in `lib/vendor-submissions.ts`'s `FIELD_MAX_LENGTHS`
table and checked the same way every existing optional string is
(`validateOptionalStringMaxLength`) — never a bespoke inline length check. Every new closed
union gets its own `VENDOR_*` frozen array constant (mirroring `VENDOR_CATEGORIES`/
`VENDOR_BOOTH_TYPES`/`VENDOR_PAYMENT_METHODS` exactly) and its own
`validate<Name>(value, errors)` helper, never a copy-pasted inline `Array.includes` check.

## Supersession note (added post-F2, 2026-08-25) — why A3 changed shape after F1 was already gated

F2 shipped exactly the tightening this document's "sequencing rule" above always intended: it
moved `physicalAddress`, `emergencyContactName`, and `emergencyContactCellPhone` from optional to
required, in the same deploy as `VendorContactFieldset.tsx`/`VendorEmergencyContactFieldset.tsx`
(see `contract-f2.yaml` and `goldens/f2-ui-vendor-business-emergency-contact.md`). That correctly
made F1's original A3 sub-checks (a1/a2) fail: they asserted the bare pre-F2 OLD_MINIMAL/OLD_FULL
shapes — missing those 3 fields — stayed `valid:true`, which stopped being true the moment F2
legitimately superseded it. This is NOT a regression in F2 and NOT a bug in F1 — it is the
documented sequencing rule playing out exactly as designed one feature later.

`check-new-fields-additive-and-validated.mjs`'s (a) section was narrowed accordingly: it now
proves the OLD shape *plus* those 3 now-required fields still validates with none of F1's other
55 new optional fields present and no other enum touched (the part of the original guarantee that
remains true and still matters), and documents — without re-proving — that the bare pre-F2 shape
is now correctly rejected. The actual load-bearing proof that the 3-field tightening itself is
correct now lives in F2's own A3 (`check-f2-required-fields.mjs`), not here. A future feature that
further tightens any field must apply the same pattern: narrow this check's "old shape" baseline
to match what's actually still guaranteed-optional, rather than deleting the check or leaving it
permanently red.

A2 (`checks/fixtures/vendor-submission-f1-typecheck.ts`, run via
`npx tsc --noEmit -p checks/tsconfig.typecheck.json`) is the compile-time twin of A3 and needed
the identical narrowing — QA caught it as a separate miss after the A3 fix above was already
verified. Its `oldMinimal` literal (formerly the bare pre-F2 31-field shape) now spreads
`oldMinimalBase` plus the same 3 F2-required fields (`physicalAddress`, `emergencyContactName`,
`emergencyContactCellPhone`), mirroring (a1)/(a2) in the runtime check. A new
`@ts-expect-error`-guarded `oldMinimalBareRejected` const asserts the bare `oldMinimalBase`
(without those 3 fields) now fails to compile against `VendorSubmissionDraft` — the compile-time
twin of the runtime check's (a0). `vendorCategory` on `oldMinimalBase` needed an explicit
`as VendorCategory[]` cast since splitting the literal out of the directly-typed `const: 
VendorSubmissionDraft = {...}` form lost its contextual typing. `npx tsc --noEmit -p
checks/tsconfig.typecheck.json` exits 0.

## No invented figures

No new field in this feature carries a fee, price, minimum insurance coverage amount, or any
other business/pricing figure — the source document names none for these eleven sections
either. (The one section of the whole form that does imply a figure, Section 17 Booth Fees, is
explicitly out of scope for this feature — see F9's own mission brief and its "CONTENT GAP" for
why no fee schedule is invented anywhere in this mission.)

## Zero authorization meaning, unchanged

`lib/vendor-submissions.ts` continues to import neither `lib/admin-auth.ts` nor
`lib/admin-roles.ts` — none of these fifty-eight new fields carries, gates, or is read by any
capability/role/admin-grant decision anywhere in the codebase. This mirrors F4/F6/F7's own
zero-authorization posture exactly.

## What this feature does NOT prove

- That any of these new fields are actually collectible by a human — no UI exists for any of
  them yet. That's F2 through F10.
- That `vendorCategory`, `boothType`, or `paymentMethodsAccepted`'s enum corrections are
  correct or complete — those are F3's, F4's, and F8's decisions respectively, not this
  feature's.
- That the admin review UI can display any of these fields — that's F11.
- Any Firestore read/write, HTTP route, or Firebase Storage behavior — `lib/vendor-submissions.ts`
  remains pure and side-effect-free, exactly as F4 shipped it.

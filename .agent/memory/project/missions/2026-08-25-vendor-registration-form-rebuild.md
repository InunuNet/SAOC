---
schema: athanor.mission/v1
slug: vendor-registration-form-rebuild
goal: 'Rebuild the National Show vendor registration form (app/(marketing)/national-show/vendors/register
  + app/api/vendors/register + lib/vendor-register-form-payload.ts + vendorSubmission
  Sanity/Firestore data model) to match the real, current source of truth: 2027_SAOC_National_Show_Vendor_Registration_Form.docx
  (mirrored locally at docs/leeann-source/2027-vendor-registration-form_2026-08-25.md),
  which has 18 sections / ~90 fields vs. the live form''s 31 fields built from an
  older document. Missing sections confirmed by prior investigation: Emergency Contact,
  Gas/Cooking/Heat-Producing Equipment, Storage & Security, Waste & Cleaning, Insurance,
  Supporting Documentation Checklist, full Vehicle Details, per-day Staff & Exhibitor
  Passes, Marketing (including logo upload and marketing/photo-use consent, per Brad
  2026-08-25), full Booth Fees & Payment breakdown, and the full 12-point Vendor Agreement
  & Declaration (currently one generic checkbox). Architect should read the mirrored
  source doc in full and produce a milestone/feature breakdown appropriately sized
  for a ~90-field form (do not attempt as one giant feature) — likely grouped by document
  section, with file uploads (logo/marketing photos, following the existing F7 proof-of-payment
  public-upload pattern: base64 in, Storage out, MIME allowlist, size cap, extension
  derived from mimeType) as their own feature. Do NOT touch the vendor-to-ticket-purchase
  linkage (separate open question, blocked on discussion with Lee-Ann, see backlog)
  or build a public vendor directory (separate backlog item) in this mission — scope
  is strictly matching the registration FORM itself to the real source document. --slug
  vendor-registration-form-rebuild'
created_at: '2026-08-25T20:38:23.395516+00:00'
started_at: null
last_active_at: '2026-09-01T00:01:06.098117+00:00'
status: abandoned
cost_estimate:
  features: 11
  milestones: 3
  total_calls: 0
last_checkpoint:
  milestone: M2
  feature: F3
  ts: '2026-08-26T22:23:18.930076+00:00'
features:
- id: F1
  title: 'Data model foundation (deploy-safe, additive-only): types/index.ts + lib/vendor-submissions.ts'
  inline_brief: 'SEQUENCING RULE governing this entire mission, established here because
    the live form and its API stay deployed and accepting real submissions between
    every feature merge (per standing deploy authorization -- push any time, this
    is not a big-bang cutover): F1 adds ONLY new, additive, OPTIONAL fields that no
    currently-live UI or validator path could ever have sent an incompatible value
    for. It touches NO existing field''s required-ness, and NO existing enum (vendorCategory,
    boothType, paymentMethodsAccepted''s existing 4 members) in any way that could
    invalidate a value the CURRENTLY DEPLOYED form is still sending -- an enum rename/narrowing
    or a newly-required field, landed here ahead of the UI feature that actually collects
    it, would make the live public API start rejecting real vendor submissions the
    moment F1 deploys, before any human has a way to supply the new required data.
    Concretely: adds every NEW field for source Sections 2 (Emergency Contact -- emergencyContactName/
    emergencyContactRelationship/emergencyContactCellPhone, all OPTIONAL here even
    though the source marks two with an asterisk; F2 tightens them to required in
    the SAME deploy that ships the fieldset UI collecting them), 7 (Gas/Cooking/Heat
    Equipment, new), 11 (Storage & Security, new), 12 (Waste & Cleaning, new), 15
    (Insurance, new); the safe additive (non-enum) fields for Section 1 (tradingNameSameAsBusiness,
    businessEntityType + Other, vatRegistered, countryOfBusinessRegistration, postalAddressSameAsPhysical,
    postalAddress, contactPosition, alternativeContactNumber, accountsContactName,
    accountsContactEmail -- physicalAddress stays optional here; F2 makes it required
    alongside its own UI change), Section 3 (sellsLivePlants + livePlantTypes + Other,
    plantsImportedForEvent + importCountryOfOrigin, citesListedSpecies, foodHealthTradingDocumentation
    -- vendorCategory''s enum correction is F3''s job, NOT F1''s, for the reason above),
    Section 4 (boothPositionRequest, adjacentBoothRequested + adjacentBoothVendorName,
    specialDisplayRequirements -- boothType''s enum correction is F4''s job, NOT F1''s),
    Section 6 (electricalOutletsRequired, electricalEquipmentList, electricalEquipmentContinuousOperation
    + Details, waterIntendedUse, wastewaterDrainageRequired + Details), Section 8
    (foodPreparationOnSite, foodCookingOnSite -- NEW fields, added alongside the still-live
    staffPerDay/existing food fields, nothing removed), Section 9 (staffCountSetupDay/Day1/Day2/Day3/
    BreakdownDay, exhibitorPassesRequired + exhibitorPassesCount, all ADDITIVE alongside
    the existing staffPerDay field -- staffPerDay is NOT removed here; its removal
    is F6''s job, landed in the SAME deploy as the UI change that stops sending it),
    Section 10 (vehicleType + Other, vehicleHeight, vehicleLength, trailerAttached).
    types/index.ts: every new field is optional on VendorSubmission, grouped by source
    section with a comment citing this contract; no existing field type, optionality,
    or union is changed. lib/vendor-submissions.ts: extends validateVendorSubmissionInput()
    with format/max-length checks for the new fields ONLY (never tightens an existing
    check) and extends buildVendorSubmission()''s explicit field-by-field copy (never
    a spread) to include them. Does NOT touch lib/vendor-register-form-payload.ts
    or lib/vendor-register-form-validation.ts -- those are UI-state-coupled files
    (VendorRegisterFormState''s INITIAL_STATE lives in the UI component, VendorRegisterForm.tsx)
    and are extended by each downstream UI feature (F2-F10) atomically with the fieldset
    that actually collects its own new fields, never pre-staged here disconnected
    from a UI. No new routes, no Storage upload paths, no admin-only fields (those
    belong to F7/F9/F11). See contract-f1.yaml and its golden README for the full
    field-by-field spec and the deploy-safety reasoning in full.'
  status: pending
  milestone: M1
  contract: .agent/memory/project/specs/vendor-registration-form-rebuild/contract-f1.yaml
- id: F2
  title: 'UI: Vendor & Business Details (Section 1, full) + Emergency Contact (Section
    2, new) fieldsets'
  inline_brief: Expands components/vendors/VendorContactFieldset.tsx to cover every
    F1 Section-1 field (trading-name same-as-above checkbox, business/entity type
    incl. Other free-text, VAT-registered toggle gating vatNumber, country of business
    registration, postal/billing address with its own same-as-physical checkbox, position/role,
    alternative contact number, accounts contact name/email) and adds a new VendorEmergencyContactFieldset.tsx
    (emergencyContactName*, emergencyContactRelationship, emergencyContactCellPhone*).
    Wires both into VendorRegisterForm.tsx's state/payload/client-validation against
    F1's real types -- never a parallel/duplicate validation path. THIS FEATURE (not
    F1) is responsible for tightening physicalAddress, emergencyContactName, and emergencyContactCellPhone
    from optional to required in lib/vendor-submissions.ts's validateVendorSubmissionInput()
    and lib/vendor-register-form-validation.ts's client check -- in the SAME deploy
    as the UI change that marks them required, per F1's deploy-safety sequencing rule.
    Reuses the existing VendorFormField/VendorCheckboxField/VendorRadioGroupField
    primitives; only introduce a new primitive if a genuinely new field shape is needed
    (e.g. a labeled "same as above" checkbox that clears/copies another field's value
    -- check whether this pattern already exists before inventing a second one).
  status: pending
  milestone: M1
  spec: null
  contract: null
- id: F3
  title: 'UI: Vendor Category & Products (Section 3, full)'
  inline_brief: 'Rebuilds VendorCategoryFieldset.tsx against F1''s corrected 11-member
    vendorCategory enum (+ Other free text). Adds: sellsLivePlants boolean gating
    a livePlantTypes checkbox group (+ Other); plantsImportedForEvent boolean gating
    importCountryOfOrigin; citesListedSpecies boolean alongside the existing citesPermitNumber
    field; the existing phytosanitaryPermitNumber/foodItemList/foodHandlingCertificateNumber
    fields stay food-retailer-gated exactly as isFoodRetailer() already gates them
    today; adds foodHealthTradingDocumentation free text. Do NOT re-add a 3.8 "food
    prepared/cooked on site" field here -- F1''s dedup of source 3.8 against Section
    8''s two separate booleans (foodPreparationOnSite, foodCookingOnSite) is a judgement
    call already recorded in F1''s golden README; F5 owns Section 8''s UI.'
  status: done
  milestone: M2
  spec: null
  contract: null
  completed_at: '2026-08-26T22:23:18.929913+00:00'
- id: F4
  title: 'UI: Booth Requirements + Tables/Chairs + Electricity & Water (Sections 4,
    5, 6)'
  inline_brief: Rebuilds VendorBoothFieldset.tsx against F1's corrected 4-member boothType
    enum (standard-in-row/corner/end-of-row/no-preference, replacing the old 3-member
    enum -- note this is a breaking rename of an existing field's value set, not additive;
    check for any other reader of the old boothType values before assuming this is
    UI-only). Adds boothPositionRequest free text, adjacentBoothRequested boolean
    gating adjacentBoothVendorName, specialDisplayRequirements free text (Section
    4); tableCount/chairCount stay unchanged (Section 5); adds electricalOutletsRequired
    number, electricalEquipmentList free text (source's equipment/qty/wattage table
    collapsed to free text per F1's judgement call -- do not build a repeating-row
    table UI unless F1's golden README says otherwise), electricalEquipmentContinuousOperation
    boolean gating electricalEquipmentContinuousDetails, waterIntendedUse free text
    (gated on the existing waterRequired boolean), wastewaterDrainageRequired boolean
    gating wastewaterDrainageDetails (Section 6). Keep isElectricalLoadApplicable()-style
    single-source-of-truth gating for every newly-conditional field -- never duplicate
    a gate condition between the render layer and the payload builder.
  status: pending
  milestone: M2
  spec: null
  contract: null
- id: F5
  title: 'UI: Gas/Cooking/Heat Equipment + Food Vendors + Storage & Security + Waste
    & Cleaning (Sections 7, 8, 11, 12) -- safety/compliance cluster'
  inline_brief: 'New fieldset(s) covering: gasOrHeatEquipmentUsed boolean gating gasEquipmentType/gasFuelType/gasCylinderSize/gasCylinderCount/gasSafetyInformation
    (Section 7); foodPreparationOnSite and foodCookingOnSite as two independent booleans,
    food-retailer-gated the same way F3''s food fields are (Section 8 -- see F3''s
    note on why source 3.8 is not separately modelled); storageRiskAcknowledged boolean,
    NOT forced true (source has no asterisk on 11.1) (Section 11); wasteTypes checkbox
    group (+ Other) and specialWasteRequirements free text (Section 12). All new fields
    are optional per F1''s validation -- this is disclosure/compliance information,
    not a submission gate, except where F1''s golden README says otherwise.'
  status: pending
  milestone: M2
  spec: null
  contract: null
- id: F6
  title: 'UI: Staff & Exhibitor Passes + Vehicles/Delivery/Loading (Sections 9, 10)'
  inline_brief: Replaces the single staffPerDay number field with F1's five-value
    per-day breakdown (staffCountSetupDay, staffCountDay1, staffCountDay2, staffCountDay3,
    staffCountBreakdownDay) plus exhibitorPassesRequired boolean gating exhibitorPassesCount
    (Section 9 -- note staffPerDay is REMOVED, not kept alongside the new fields;
    confirm no other code reads it before deleting). Expands vehicle fields with vehicleType
    (+ Other free text), vehicleHeight, vehicleLength, trailerAttached boolean; vehicleRegistrations/loadInSlot/loadOutSlot
    stay under their existing names (Section 10).
  status: pending
  milestone: M2
  spec: null
  contract: null
- id: F7
  title: Marketing section incl. logo + product/company photo upload (Section 13),
    extending the F7 (mission vendor-registration, 2026-08-17) proof-of-payment upload
    pattern
  inline_brief: 'New public unauthenticated, rate-limited upload routes mirroring
    app/api/vendors/[id]/proof-of-payment/route.ts + lib/vendor-payment.ts''s planProofOfPaymentUpload()
    exactly: base64 in, Firebase Storage out, MIME allowlist, size cap, extension
    derived from mimeType (never the caller''s filename), non-enumerable existence
    posture, overwrite-not-refuse semantics. One route/plan for the company logo (accept
    PDF/EPS/SVG/AI/PNG/JPG per source 13.2 -- confirm which of EPS/AI/SVG a MIME-sniff
    can actually validate server-side vs. which must be allowlisted by extension only,
    and flag that judgement call explicitly rather than silently narrowing the accepted
    set) and one for product/company photographs (multiple files, PNG/JPG only) --
    additive fields logoFilePath/logoUploadedAt/photoFilePaths/photosUploadedAt on
    VendorSubmission, all set ONLY by these upload routes, never by the public POST
    /api/vendors/register body. UI: bio field relabelled/limited to the source''s
    50-100-word guidance (advisory, not a hard validation reject unless F1''s golden
    README says otherwise), hasProductPhotographs boolean, marketingPermission as
    a two-option radio (''full'' vs ''listing-only'', matching source 13.4''s two
    mutually exclusive checkboxes -- not a boolean), interestedInSponsorship boolean
    (13.5). Brad explicitly asked 2026-08-25 for vendors to be able to upload a logo
    and marketing/product photos so the eventual public directory listing (separate
    backlog item, NOT built here) is not text-only.'
  status: pending
  milestone: M2
  spec: null
  contract: null
- id: F8
  title: 'UI: Customer Payment Methods enum fix (Section 14) + Insurance (Section
    15) + Supporting Documentation Checklist (Section 16)'
  inline_brief: Adds 'other' + paymentMethodOther free text to the existing paymentMethodsAccepted
    checkbox group (Section 14 -- additive to the existing 4-member enum, not a rename,
    unlike F4's boothType change). Adds hasPublicLiabilityInsurance boolean and productLiabilityInsuranceStatus
    as a 3-value union ('yes'/'no'/'not-applicable', matching source 15.2's three
    checkboxes -- not a boolean) (Section 15). Adds supportingDocumentsChecklist as
    a self-reported checkbox group of which supporting documents the vendor is including
    (proof-of-payment/CIPC/VAT/phytosanitary/import-permit/CITES/food-health-trading/gas-LPG-safety/electrical-compliance/other-permits/company-logo)
    -- this is a declarative checklist, NOT itself a file-upload mechanism; the vendor's
    actual proof-of-payment and logo files are uploaded via their own existing/new
    routes (F7 mission-2026-08-17 and this mission's F7 respectively) (Section 16).
  status: pending
  milestone: M3
  spec: null
  contract: null
- id: F9
  title: Booth Fees & Payment (Section 17) -- office-computed fee breakdown, admin-only
  inline_brief: 'CONTENT GAP -- flag for Lee-Ann/Brad, do not invent: the source document
    names no booth fee amount and no ZAR price list per booth type anywhere (confirmed
    already in the 2026-08-17 mission''s F7 golden README, "No ZAR amount anywhere
    in this feature" -- this mission does not overturn that finding). Section 17''s
    fee/subtotal/total-due/due-date fields (17.1, 17.2) read as OFFICE-computed figures
    an admin fills in when invoicing an approved vendor, not vendor-submitted free
    text -- add boothFeeAmount, additionalChargesAmount, totalAmountDue, paymentDueDate
    as additive, nullable, ADMIN-ONLY fields (mirrors F7 mission-2026-08-17''s boothNumber/paymentReceived
    pattern exactly: set only via a capability-gated admin route reusing the ''review-vendor-applications''
    capability, never by the public submitter or any public route), with NO default/placeholder
    numeric constant anywhere in the implementation -- every admin-entered figure
    comes from the request body, none is hardcoded. paymentReference/proofOfPaymentPath/proofOfPaymentUploadedAt
    (17.3, 17.4) already exist from the 2026-08-17 mission''s F7 and are untouched.'
  status: pending
  milestone: M3
  spec: null
  contract: null
- id: F10
  title: Full 12-point Vendor Agreement & Declaration (Section 18), replacing the
    single generic T&Cs checkbox
  inline_brief: 'Replaces the current single termsAccepted boolean with source Section
    18''s actual structure: either twelve independently-tracked acknowledgement booleans
    or one vendorAgreementAccepted boolean gating a rendered list of all twelve numbered
    points (a judgement call for the architect writing this feature''s contract --
    recommend the single-boolean-plus-rendered-list form unless there is a concrete
    reason SAOC needs per-point audit trail, since the source form itself presents
    them as one signature covering all twelve, not twelve separate checkboxes) --
    plus the source''s own name/position/business-name/date fields beneath the declaration
    (Full Name, Position, Business Name, Date -- these largely duplicate data already
    collected in Section 1/F2, so decide reuse-vs-redeclare explicitly rather than
    silently duplicating). No e-signature capture mechanism exists in this codebase
    -- "Signature" is satisfied by the vendor typing their full name plus checking
    the agreement box, matching how termsAccepted already works today; do not build
    or integrate a drawn/uploaded signature feature for this.'
  status: pending
  milestone: M3
  spec: null
  contract: null
- id: F11
  title: Admin review UI (app/admin/vendors, components/admin/VendorReviewTable.tsx)
    updated to show/handle every new field across all ten preceding features, plus
    the source form's OFFICE USE ONLY block
  inline_brief: Extends VendorReviewTable.tsx / the admin vendor detail view so every
    field added by F1-F10 is visible to a reviewer (grouped by the same section structure
    as the public form, not a flat dump) -- an admin approving/rejecting a submission
    today cannot see any of the new Emergency Contact, Gas/Storage/Waste/Insurance,
    Vehicle, Staff-per-day, or Marketing fields, which defeats the point of collecting
    them. Also surfaces the source form's literal OFFICE USE ONLY block fields not
    yet modelled anywhere (Vendor ID display, Date Application Received, Application
    Reviewed By, compliance-verified checklist [plant/CITES/food/gas/electrical/other
    documentation verified], Load-In/Load-Out Date-Time, Staff Passes count, Vehicle
    Access Approved, Storage Approved, Power Requirements Confirmed, Water Requirements
    Confirmed, Final Confirmation by/date, Outstanding Items/Notes) as additive admin-only
    fields set via the existing capability-gated review/payment routes (extend, do
    not duplicate, lib/vendor-review.ts and F9's new admin route) -- never by the
    public submitter. This is the final feature; scope explicitly excludes building
    the public vendor directory display (separate backlog item) and vendor-to-ticket-purchase
    linkage (separate open question blocked on Lee-Ann) per the mission goal.
  status: pending
  milestone: M3
  spec: null
  contract: null
milestones:
- id: M1
  title: Data model foundation + first UI section (Business Details, Emergency Contact)
  features:
  - F1
  - F2
  gate_ran_at: '2026-08-25T22:16:38.699611+00:00'
  gate_result: pass
  status: done
- id: M2
  title: Core section UI rebuild (Category/Products, Booth/Electricity, Safety/Compliance,
    Staff/Vehicles, Marketing uploads)
  features:
  - F3
  - F4
  - F5
  - F6
  - F7
- id: M3
  title: Payment Methods/Insurance/Docs checklist, Booth Fees, Vendor Agreement, admin
    review UI
  features:
  - F8
  - F9
  - F10
  - F11
notes: 'Abandoned: Superseded 2026-08-26: Lee-Ann replaced the source document in
  place (same Drive file id). This mission was scoped against the 25 Aug snapshot,
  now marked SUPERSEDED. Work continued under vendor-gated-registration-flow (M1 fd51813,
  M2 F13 67d63ff/e439827, M4 5e3c9e6), which also inverted the flow to application-then-approval
  per Brad 2026-08-30.'
---

# Mission: Rebuild the National Show vendor registration form (app/(marketing)/national-show/vendors/register + app/api/vendors/register + lib/vendor-register-form-payload.ts + vendorSubmission Sanity/Firestore data model) to match the real, current source of truth: 2027_SAOC_National_Show_Vendor_Registration_Form.docx (mirrored locally at docs/leeann-source/2027-vendor-registration-form_2026-08-25.md), which has 18 sections / ~90 fields vs. the live form's 31 fields built from an older document. Missing sections confirmed by prior investigation: Emergency Contact, Gas/Cooking/Heat-Producing Equipment, Storage & Security, Waste & Cleaning, Insurance, Supporting Documentation Checklist, full Vehicle Details, per-day Staff & Exhibitor Passes, Marketing (including logo upload and marketing/photo-use consent, per Brad 2026-08-25), full Booth Fees & Payment breakdown, and the full 12-point Vendor Agreement & Declaration (currently one generic checkbox). Architect should read the mirrored source doc in full and produce a milestone/feature breakdown appropriately sized for a ~90-field form (do not attempt as one giant feature) — likely grouped by document section, with file uploads (logo/marketing photos, following the existing F7 proof-of-payment public-upload pattern: base64 in, Storage out, MIME allowlist, size cap, extension derived from mimeType) as their own feature. Do NOT touch the vendor-to-ticket-purchase linkage (separate open question, blocked on discussion with Lee-Ann, see backlog) or build a public vendor directory (separate backlog item) in this mission — scope is strictly matching the registration FORM itself to the real source document. --slug vendor-registration-form-rebuild

## Context

(Add context here)

## Notes


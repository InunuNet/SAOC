# F2 (vendor-registration-form-rebuild) — UI: Vendor & Business Details (Section 1, full) +
# Emergency Contact (Section 2, new): decision record

Source: `docs/leeann-source/2027-vendor-registration-form_2026-08-25.md`, Sections 1 and 2.
Depends on F1 (`.agent/memory/project/specs/vendor-registration-form-rebuild/goldens/f1-data-model-foundation.md`),
which already added every field this feature collects to `types/index.ts` and wired them into
`lib/vendor-submissions.ts`, all optional. This feature is UI + the one required-ness
tightening F1 explicitly deferred to it.

## What already existed vs. what's new

Live `VendorContactFieldset.tsx` (pre-F2) collects 10 of source Section 1's 17 fields:
`businessName` (1.1), `tradingName` (1.2, no "same as above" checkbox), `contactPersonName`
(1.9), `contactCellPhone` (1.12), `contactEmail` (1.11), `physicalAddress` (1.7, currently
`required={false}` even though the source asterisks it), `cipcNumber` (1.4), `vatNumber` (1.5,
currently a plain always-visible text field, no "not VAT registered" gate), `website` (1.16),
`socialMediaHandle` (1.17).

Missing from Section 1, all added by F1 as optional fields and now given UI by this feature:
`tradingNameSameAsBusiness` (1.2's checkbox), `businessEntityType` + `businessEntityTypeOther`
(1.3), `vatRegistered` (1.5's other checkbox), `countryOfBusinessRegistration` (1.6),
`postalAddressSameAsPhysical` + `postalAddress` (1.8), `contactPosition` (1.10),
`alternativeContactNumber` (1.13), `accountsContactName` (1.14), `accountsContactEmail` (1.15).

Section 2 (Emergency Contact) is entirely new — no fieldset exists today. This feature adds
`VendorEmergencyContactFieldset.tsx`.

## Files touched

1. **`types/index.ts`** — flips `physicalAddress`, `emergencyContactName`,
   `emergencyContactCellPhone` from optional to required (drop the `?`), matching how every
   other currently-required field on `VendorSubmission` (`businessName`, `contactPersonName`,
   `contactCellPhone`, `contactEmail`) is already typed — required-ness at the type level always
   tracks `validateVendorSubmissionInput`'s own required-ness in this codebase, it is never
   type-optional-but-runtime-required. Removes the now-stale "F2 tightens them" comment F1 left
   at these three fields. `emergencyContactRelationship` stays optional (source has no asterisk
   on 2.2). No other field's optionality changes; no enum changes (out of scope for F2).

2. **`lib/vendor-submissions.ts`** — moves `physicalAddress`, `emergencyContactName`,
   `emergencyContactCellPhone` out of the `validateOptionalStringMaxLength` calls they currently
   sit in and into `requireNonEmptyString(record, '<field>', errors, FIELD_MAX_LENGTHS.<field>)`
   calls, grouped with the other required-field checks near the top of
   `validateVendorSubmissionInput` (next to `businessName`/`contactPersonName`/etc.), not left in
   place among the optional-field checks. The existing `validateOptionalPattern` phone-format
   check on `emergencyContactCellPhone` (already added by F1) is left exactly where it is — it
   already only fires when the field is present, and after this change it will always be present
   by the time it runs, so no behavioural change is needed there. `FIELD_MAX_LENGTHS` keeps all
   three existing entries unchanged (150/500/30) — only presence enforcement changes, not length.

3. **`lib/vendor-register-form-payload.ts`** — adds 14 new `VendorRegisterFormState` fields:
   `tradingNameSameAsBusiness: boolean`, `businessEntityType: string`,
   `businessEntityTypeOther: string`, `vatRegistered: '' | 'true' | 'false'` (mirrors
   `powerRequired`/`waterRequired`'s existing controlled-string convention exactly, coerced by
   `toOptionalBoolean` in the builder — never a raw `boolean` in state),
   `countryOfBusinessRegistration: string`, `postalAddressSameAsPhysical: boolean`,
   `postalAddress: string`, `contactPosition: string`, `alternativeContactNumber: string`,
   `accountsContactName: string`, `accountsContactEmail: string`, `emergencyContactName: string`,
   `emergencyContactRelationship: string`, `emergencyContactCellPhone: string`.

   Three new leak-proof render-gate + payload-exclusion guard functions, exported exactly like
   the existing `isElectricalLoadApplicable`/`isFoodRetailer`, each used identically by both the
   render layer and the payload builder (never a duplicated condition):
   - `isTradingNameFieldApplicable(state)` → `!state.tradingNameSameAsBusiness`. When the "same
     as business name" checkbox is ticked, the trading-name input is hidden and
     `buildVendorRegistrationPayload` omits `tradingName` (`undefined`) regardless of any stale
     typed value — the submission is `tradingNameSameAsBusiness: true` with no `tradingName`,
     never a duplicated copy of `businessName` into `tradingName`. This is a deliberate choice:
     duplicating the value would require the two to be kept in sync and gives the admin reviewer
     nothing `tradingNameSameAsBusiness: true` doesn't already tell them.
   - `isPostalAddressFieldApplicable(state)` → `!state.postalAddressSameAsPhysical`. Same
     pattern: ticking "same as physical address" hides the postal-address textarea and the
     payload omits `postalAddress`.
   - `isVatNumberFieldApplicable(state)` → `state.vatRegistered === 'true'`. Gates the existing
     `vatNumber` field (unchanged field, newly gated) — hidden and omitted whenever
     `vatRegistered` is `''` or `'false'`.
   - `businessEntityTypeOther` is gated inline (`state.businessEntityType === 'other'`) — no
     named helper, matching how `VendorCategoryFieldset`'s existing "Other" free-text pattern (if
     any) would be inlined; this is the only single-call-site gate among the five.

   `buildVendorRegistrationPayload` extends its explicit field-by-field object literal (never a
   spread) with all 14 new fields, applying `omitBlank`/`toOptionalBoolean` exactly as every
   existing optional field does, and applying the three gates above.

4. **`lib/vendor-register-form-validation.ts`** — adds required-ness checks for
   `physicalAddress`, `emergencyContactName`, `emergencyContactCellPhone` (non-empty, using the
   same `.trim() === ''` pattern as `businessName`/`contactPersonName`), plus a
   `PHONE_PATTERN` format check on `emergencyContactCellPhone` once non-empty (mirrors
   `contactCellPhone`'s own two-step required-then-pattern check exactly). Adds optional format
   checks (fire only when non-empty, never required) for `alternativeContactNumber`
   (`PHONE_PATTERN`) and `accountsContactEmail` (`EMAIL_PATTERN`), matching
   `validateOptionalPattern`'s server-side behaviour so client and server never disagree on a
   populated-but-malformed value. No new required checks for `businessEntityType`,
   `vatRegistered`, `countryOfBusinessRegistration`, `contactPosition`, `accountsContactName`,
   `emergencyContactRelationship` — the source has no asterisk on any of them.

5. **`components/vendors/VendorContactFieldset.tsx`** — expanded, reordered to follow the
   source document's own structure rather than the pre-F2 order (which interleaved fields not in
   source order): business identity block (`businessName`, `tradingName` + "same as above"
   checkbox, `businessEntityType` radio group + `businessEntityTypeOther`, `cipcNumber`,
   `vatRegistered` Yes/No radio gating `vatNumber`, `countryOfBusinessRegistration`,
   `physicalAddress` — now `required`), postal/billing block (`postalAddressSameAsPhysical`
   checkbox gating `postalAddress`), primary-contact block (`contactPersonName`,
   `contactPosition`, `contactEmail`, `contactCellPhone`, `alternativeContactNumber`),
   accounts-contact block (`accountsContactName`, `accountsContactEmail`), online-presence block
   (`website`, `socialMediaHandle` — unchanged, kept last). This is a judgement call recorded
   here, not silently made: reordering three already-live fields (`cipcNumber` moves next to the
   entity-type question, `vatNumber` becomes conditionally rendered instead of always-visible,
   `physicalAddress` moves out of the middle of the contact block) is a visual/UX change with no
   payload-shape or validation consequence — revisit only if @dev finds a reason the reorder is
   unworkable.

   `businessEntityType` uses the existing `VendorRadioGroupField` primitive (6 options:
   `company`/`close-corporation`/`sole-proprietor`/`partnership`/`individual`/`other`, labels
   Title Case matching the source's own labels) with `businessEntityTypeOther` rendered via
   `VendorFormField` immediately below, gated on `state.businessEntityType === 'other'`.
   `vatRegistered` uses the existing `VendorBooleanRadioField` primitive (`Yes`/`No`, mirroring
   `powerRequired`), with `vatNumber` gated by `isVatNumberFieldApplicable`. The two "same as"
   checkboxes use the existing `VendorCheckboxField` primitive — **no new primitive component is
   introduced**; the "clear/hide the dependent field" behaviour lives entirely in the two new
   `isXFieldApplicable` gate functions in `lib/vendor-register-form-payload.ts`, reusing the
   exact same render-gate pattern `isElectricalLoadApplicable`/`isFoodRetailer` already
   established, not a new "same-as" widget.

6. **`components/vendors/VendorEmergencyContactFieldset.tsx`** (new) — `emergencyContactName`
   (required), `emergencyContactRelationship` (optional), `emergencyContactCellPhone` (required,
   `tel`, `PHONE_PATTERN`), each via the existing `VendorFormField` primitive, plus the source's
   own note ("The emergency contact should preferably be someone other than the primary vendor
   contact") rendered as helper text under the heading — advisory copy only, never enforced by
   validation (the source itself does not require the two people to differ, and nothing in
   `VendorSubmission` records the primary contact's identity in a form that could be compared
   against). Same props shape, same `≤150 lines`, same file-header-comment convention as every
   other fieldset (`VendorContactFieldset.tsx` et al.).

7. **`components/vendors/index.ts`** — exports `VendorEmergencyContactFieldset` alongside the
   other fieldsets.

8. **`components/vendors/VendorRegisterForm.tsx`** — `INITIAL_STATE` gains the 14 new keys (all
   `''`/`false` per their type, matching every other field's empty-state convention); mounts
   `<VendorEmergencyContactFieldset state={state} onFieldChange={handleFieldChange}
   disabled={disabled} />` directly after `<VendorContactFieldset .../>` (Section 2 immediately
   follows Section 1, matching the source's own section order) and before
   `<VendorCategoryFieldset .../>`.

## Why no route/handler change is needed

`app/api/vendors/register/route.ts` → `lib/vendor-registration-handler.ts`'s
`handleVendorRegistration` takes `rawInput: unknown` and passes it, unmodified, straight into
the real `validateVendorSubmissionInput`/`buildVendorSubmission` (F1's already-extended
versions) — it never destructures or allow-lists individual field names itself. Every field this
feature's payload builder now sends (Section 1 additions + all of Section 2) already has a
validator and a copy-through entry from F1, so the route requires zero changes for this
feature's data to validate, persist via `lib/vendor-submissions.ts`, and reach Firestore. This
was confirmed by reading `lib/vendor-registration-handler.ts` directly (`handleVendorRegistration`,
`validation = validateVendorSubmissionInput(rawInput)` / `built = buildVendorSubmission(rawInput
as VendorSubmissionDraft, deps.now)`), not inferred.

## Deploy-safety: why tightening these three fields here, now, is safe

F1's sequencing rule forbade making `physicalAddress`/`emergencyContactName`/
`emergencyContactCellPhone` required in F1 because no UI existed yet to collect them — a
required-but-uncollectable field would reject every real live submission the moment F1 deployed.
This feature is exactly the UI that collects `emergencyContactName`/`emergencyContactCellPhone`
for the first time and switches `physicalAddress` from optional-and-usually-blank to
`required` in the same component. Tightening `requireNonEmptyString` for all three in the SAME
deploy as the UI/client-validator change (files 1, 2, 4, 5, 6 above) is the whole point of
sequencing it here rather than in F1 — no intermediate deployed state ever has the server
requiring a field with no UI collecting it, and no intermediate deployed state ever has a UI
collecting a field the server still treats as optional.

## What this feature does NOT do

- Does not touch `vendorCategory`, `boothType`, or `paymentMethodsAccepted` (F3/F4/F8's job).
- Does not touch any Section 3+ fieldset, the public vendor directory, or vendor-to-ticket
  linkage — out of mission scope.
- Does not add a repeating-row UI, a new generic primitive component, or any Storage/upload
  path — none of Section 1/2's fields need one.
- Does not change `staffPerDay` or any other field outside Sections 1/2.

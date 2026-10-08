# F1: Vendor Form Copy Update — 2026-10-07 Source

**Feature:** F1 of mission `vendor-form-copy-20261007`. Lee-Ann updated the Drive source
doc ("13.2 Vendor Form - SAOC National Show Vendor Registration Form.docx", id
`1tbA4GNbplWkW-4Pv3LPsdV5RT_ZdViBe`) on 2026-10-07 without telling Brad. This feature brings
the live vendor registration form (built and gated against the *previous* docx version, last
vendor commit `abeceae1`, 2026-09-08) into line with the current text. **Copy and structure
only — no visual/design change.** Reuse existing fieldset/note/primitive patterns in
`components/vendors/`; invent no new leaf input component. Revised 2026-10-08 against
constraints from the SAOC lead (who owns the vendor flow and cleared this work) and a
collision guard against the `feat/vendor-invite` branch — see the two dedicated sections near
the end of this document.

Source of truth for every string below: `.agent/memory/scratch/rulings-inbox/
lee-ann-vendor-form-13.2-2026-10-07.md` (flattened text) cross-checked against
`word/document.xml` inside the docx itself (`.tmp/sandbox/lee-ann-intake-20261008/
vendor-form.docx`) for table/section structure. The docx has **no interactive form fields or
checkbox content controls anywhere** — every "option list" (vendor category, waste types,
business entity type, etc.) is plain paragraph text; the Yes/No-gated radio pattern already
used throughout the live build for this kind of list is the correct existing convention to
keep applying, not an invention.

## Working baseline

Implementation happens in a worktree off `origin/main` (`736db97d`). Confirmed
`components/vendors/`, `lib/vendor-register-form-payload.ts`, `lib/vendor-submissions.ts`,
`types/index.ts` on the current working tree are byte-identical to `origin/main` (`git diff
--stat origin/main -- …` empty) — the baseline Brad described (abeceae1, 2026-09-08, tested
end to end) is what `origin/main` actually has. All paths below were verified to exist there
with `git show origin/main:<path>`.

## Finding that changes the shape of this feature

The **data-model layer already has five of the gaps Brad listed, unused.** A prior mission
(`vendor-registration-form-rebuild`, F1 of an 11-feature plan that only shipped F1–F4) added
58 optional fields to `VendorSubmission` (`types/index.ts`) and their validators
(`lib/vendor-submissions.ts`) for sections the UI (`lib/vendor-register-form-payload.ts`'s
`VendorRegisterFormState`, every `components/vendors/Vendor*Fieldset.tsx`) never picked up.
Confirmed present, validated, and copied through `buildVendorSubmission()` **today**, with
zero UI/state/payload wiring:

- `staffCountSetupDay` / `staffCountDay1` / `staffCountDay2` / `staffCountDay3` /
  `staffCountBreakdownDay` (`number`, non-negative-int validated) — exactly the per-day staff
  breakdown Brad is asking for. **Use these, do not invent new field names.**
- `exhibitorPassesRequired` (`boolean`) / `exhibitorPassesCount` (`number`) — validated but
  **do not correspond to anything in the current source doc.** The "STAFF & EXHIBITOR PASSES"
  heading is followed by one 2-column table (`Day` / `Number of Staff`) only — confirmed from
  the docx XML directly, no separate passes question exists. **Do not render these two
  fields.** They are dead-but-present from the prior mission's own over-read of the section
  title; leave them in place (deprecate-in-place convention — never delete a field from
  `types/index.ts`/`vendor-submissions.ts`), do not wire them, and raise this as a question
  for Lee-Ann (see Gaps, below).
- `storageRiskAcknowledged` (`boolean`, optional, not forced true — matches the source's own
  lack of an asterisk) — Section 11, Storage & Security, never rendered.
- `wasteTypes` (`VendorWasteType[]`) / `wasteTypesOther` (`string`) /
  `specialWasteRequirements` (`string`) — Section 12, Waste & Cleaning, never rendered. The
  `VENDOR_WASTE_TYPES` enum (`lib/vendor-submissions.ts:103`) is `['general',
  'cardboard-packaging', 'plant-material', 'food-waste', 'wastewater', 'other']` — already an
  exact match to the source's 6 waste category lines. No enum change needed.

This resolves delta #1 (staff per day) and most of #2 (waste section) as **UI + state +
payload wiring onto already-validated server fields**, not new validators. `vehicleType`,
`vehicleTypeOther`, `vehicleHeight`, `vehicleLength`, `trailerAttached` (Section 10
additions) are a second, separate unused-field cluster the source doc does not ask for
either (it only has the existing 7 discrete registration-number fields) — leave unwired, not
in this feature's scope, not reported as a gap (no source text implies they're needed; they
were the prior mission's own anticipatory modelling of a section that turned out to be
exactly what's already built).

## Field-by-field deltas (full section-by-section diff, not just Brad's list)

### 1. Staff & Exhibitor Passes (source lines 169–177)
Source: 2-column table, `Day` / `Number of Staff`, rows `Setup Day`, `Day 1`, `Day 2`,
`Day 3`, `Breakdown Day`.
Built: `components/vendors/VendorBoothUtilitiesFieldset.tsx:116-126`, one
`staffPerDay` numeric field, label "Number of staff attending per day".
**Fix:** render 5 numeric fields, one per source row, wired to the existing
`staffCountSetupDay/Day1/Day2/Day3/BreakdownDay` fields, **additively** — see "Backward
compatibility" below for exactly what happens to `staffPerDay` itself (short version: the
server-side field is never removed or renamed; only the live form's own input state stops
collecting it; old stored submissions and their display stay fully intact). Extracting this
out of `VendorBoothUtilitiesFieldset.tsx` into a new `VendorStaffPassesFieldset.tsx` is
required to keep both files under the project's 150-line convention
(`VendorBoothUtilitiesFieldset.tsx` is already 129 lines; swapping 1 field for 5 pushes it
over). **Mount `<VendorStaffPassesFieldset .../>` directly inside `VendorBoothFieldset.tsx`
(imported there, same as `VendorBoothPositionFieldset`/`VendorBoothUtilitiesFieldset` already
are) — NOT in `VendorRegisterForm.tsx`.** Delete the old single `staffPerDay` field from
inside `VendorBoothUtilitiesFieldset.tsx` with no replacement there; the replacement is one
level up. Position it as a direct sibling, immediately after the existing
`<VendorBoothUtilitiesFieldset .../>` line and **before** the
`VEHICLE_REGISTRATION_FIELDS.map(...)` block that follows it — this preserves the source
doc's own section order (Staff & Exhibitor Passes precedes Booth & Logistics/Vehicles) without
needing a slot prop: `VendorBoothFieldset.tsx` already imports and renders its three
sub-fieldsets as plain sequential JSX siblings, so a fourth import-and-render follows the
exact same, already-established pattern. Resolved 2026-10-09 after Codex QA flagged that
`check-f1-structural.sh`'s original mount check greped `VendorRegisterForm.tsx` for all three
new fieldsets uniformly, which contradicted this section's own "inside VendorBoothFieldset.tsx"
instruction for this one fieldset specifically — the check (not this instruction) was wrong
and is now fixed to grep the correct host file per fieldset, plus a new ordering assertion
that the staff fieldset's JSX appears before the vehicle fields' JSX.
Labels: "Setup Day", "Day 1", "Day 2", "Day 3", "Breakdown Day" — each paired with
"Number of Staff" per the source table header; render as
`label="Number of staff — Setup Day"` etc. (existing `VendorFormField` label convention
prefixes the shared column noun after the row name, matching how
`VendorElectricalEquipmentTable` labels its own columns) — htmlType="number", min=0, step=1,
required=false (no asterisk in source).

### 2. Waste, Cleaning and Environmental Impacts (source lines 201–217, entirely missing)
New `components/vendors/VendorWasteFieldset.tsx`, own `<h2>Waste, cleaning &amp;
environmental impacts</h2>` (source's own section heading, Title Case per this project's
existing `<h2>` convention — compare "Booth &amp; logistics", "Products &amp; category").
Fields:
- `wasteTypes` — `VendorCheckboxGroupField`, label "Waste generated by your operation",
  options verbatim: `general`→"General waste", `cardboard-packaging`→"Cardboard /
  packaging", `plant-material`→"Plant material", `food-waste`→"Food Waste" (source's own
  capitalisation, keep verbatim), `wastewater`→"Wastewater", `other`→"Other". required=false.
- `wasteTypesOther` — `VendorFormField`, text, label "Other waste (please specify)",
  gated on `wasteTypes.includes('other')` (new guard function
  `isWasteTypesOtherFieldApplicable`, mirrors the existing `isFoodRetailer`-style boolean
  gate shape in `lib/vendor-register-form-payload.ts`), required=false, maxLength matching
  `wasteTypesOther`'s existing `FIELD_MAX_LENGTHS` entry (`lib/vendor-submissions.ts:206`,
  100) — use that exact value, not a new one.
- `specialWasteRequirements` — not in the source doc under this heading at all. **Do not
  render it in this feature.** It is a pre-existing `types/index.ts` field from the prior
  mission with no corresponding source text (same "anticipatory, never asked for" shape as
  `exhibitorPassesCount`) — leave unwired, flag as a gap/question below rather than inventing
  a label for it.
- Advisory note, verbatim including the source's own spelling: "Vendors are responsible for
  maintaining a clean and safe booths throughout the event and for complying with the
  organiser's waste and recycling procedures." (source's "booths" for a singular vendor is
  the doc's own grammar — reproduce as-is, do not silently correct it).

Mount `<VendorWasteFieldset .../>` in `VendorRegisterForm.tsx` directly after
`<VendorBoothFieldset .../>` (new `VendorStorageFieldset`, below, goes between them — see
next item) and before `<VendorMarketingFieldset .../>`, matching the source's own section
order (Vehicles → Storage & Security → Waste → Marketing).

### 3. Storage & Security (source lines 197–199, entirely missing)
New `components/vendors/VendorStorageFieldset.tsx`, own `<h2>Storage &amp; security</h2>`.
One field: `storageRiskAcknowledged` — `VendorCheckboxField`, required=false (source places
no asterisk; this mirrors the existing `storageRiskAcknowledged?: boolean` comment in
`types/index.ts:715-716` which already says "NOT forced true"). Label is the advisory text
itself, verbatim: "All plants and products can be left in your booth overnight. Security
will be provided on the premises. However, the organizers of the event cannot be held
liable for any losses incurred." (source's own US/UK spelling mix — "organizers" here,
"Organising Committee" elsewhere in the same doc — reproduce both exactly as written, do not
normalise to one spelling). Mount between `VendorBoothFieldset` and `VendorWasteFieldset` in
`VendorRegisterForm.tsx`.

### 4. Vehicle registration labels (source lines 187, 189)
`components/vendors/VendorBoothFieldset.tsx`'s `VEHICLE_REGISTRATION_FIELDS` array (~line 40):
- `deliveryVanRegistrationNumber` label `'Delivery van registration number'` →
  **verbatim source**: `'Less than 1 ton Delivery Van registration Number'`
  (source's own capitalisation: "Van" capital, "registration Number" — capital N — keep
  exactly).
- `truckRegistrationNumber` label `'Truck registration number'` → **verbatim source**:
  `'Above 1 ton Truck registration number'`.
No key/type change — only the two label strings in that array change.

### 5. VAT Vendor vs VAT registered (source line 37)
`components/vendors/VendorBusinessAddressFieldset.tsx:35`, `VendorBooleanRadioField` label
`"VAT registered"` → **verbatim source**: `"VAT Vendor"`. The docx XML confirms "VAT Vendor"
is immediately followed by "VAT Number" with no embedded question text — this is a label-only
fix, the Yes/No-radio-gating-the-number-field behaviour is unchanged and correct.

### 6. Booth allocation note (source line 142) — reconcile, do not duplicate
**Revised 2026-10-08 per the SAOC lead's explicit instruction.** The source document in fact
contains *two* distinct sentences about booth allocation:
- BOOTH REQUIREMENTS section (line 142): "Final booth allocation is made by the Show
  Organising Committee and is subject to availability and operational requirements."
- The TERMS AND CONDITIONS "Vendor Allocation" clause (near the end of the doc): "I/We
  understand that submission of a registration form does not guarantee a particular booth or
  location. Final booth allocation will be determined by the Show Organising Committee,
  taking into consideration the overall layout, operational requirements, product categories
  and best interests of the show."

The live build renders only the second sentence, verbatim, as
`components/vendors/VendorTermsFieldset.tsx:19` — **already byte-for-byte correct** against
its own source clause (confirmed by direct string comparison; this is Brad's delta #5 "worded
differently" note, but the mismatch Brad was seeing is against the *first* sentence, not
this one). My original plan for this feature was to ALSO add the first sentence as a new,
separate note in `VendorBoothPositionFieldset.tsx`. **The SAOC lead has explicitly overridden
that plan**: "An allocation note already exists at VendorTermsFieldset.tsx:19 in different
wording. Reconcile it to the source wording; don't add a duplicate." Per that instruction:

- **No new note is added anywhere in this feature.** `VendorBoothPositionFieldset.tsx` is
  left untouched on this point.
- `VendorTermsFieldset.tsx:19` is re-verified byte-for-byte against the T&Cs "Vendor
  Allocation" clause above and left as-is (it already matches); @dev must still diff it
  against the current source text as a sanity check and correct it if any drift is found, but
  no change is expected.
- **The BOOTH REQUIREMENTS section's first sentence is a known, flagged gap, not silently
  dropped**: it is never rendered anywhere in the live form after this feature. This is
  recorded as a question for Lee-Ann below (Gaps, item 4) rather than resolved by inventing a
  second rendering the lead has said not to add.

### 7. Marketing permission wording (source lines 226–230)
`components/vendors/VendorMarketingFieldset.tsx`'s `MARKETING_PERMISSION_OPTIONS` (~line 25)
currently paraphrases — not verbatim, violates `docs/rules/no-invention.md`. Replace both
option labels verbatim:
- `full` → `'I hereby give the 2027 SAOC National Show permission to use my business name,
  logo, supplied photographs and promotional information for reasonable event-related
  marketing and publicity.'`
- `listing-only` → `'I do not grant permission for use beyond the vendor listing.'`
Values (`full` / `listing-only`) and gating logic are unchanged — this is a label-only fix,
same as item 5.

### 8. Missing advisory notes
- **Electrical safety** (source line 167): "Important: All electrical equipment, cables,
  plugs and connections must comply with applicable South African electrical safety
  requirements and venue requirements. Vendors may be required to provide suitable
  extension cords and distribution equipment." Source places this directly after the
  electricity table and before "Is Water Access Required?". Add as a new `<p>` in
  `components/vendors/VendorBoothUtilitiesFieldset.tsx`, gated
  `isElectricalEquipmentApplicable(state)` (only shown when power is required — matches the
  table it follows), positioned after `<VendorElectricalEquipmentTable .../>` and before the
  `waterRequired` `VendorBooleanRadioField`.
- **Delivery/collection slots** (source line 195): "Please note that delivery and collection
  time slots will be allocated a week before the set-up day. All vehicles and trailers needs
  to be removed to the allocated parking area immediately after your delivery slot time
  lapses." (source's own grammar, "needs" for plural subject — keep verbatim). Add as a new
  `<p>` in `components/vendors/VendorBoothFieldset.tsx`, after the vehicle registration
  fields and `otherVehicleDescription`, before `loadInSlot`/`loadOutSlot`. **Flag below**: the
  existing `loadInSlot`/`loadOutSlot` free-text "preferred slot" inputs contradict this note
  (source says slots are organiser-allocated, not vendor-chosen) — do not remove them in this
  feature (out of scope, pre-existing judgement call from an earlier mission), just add the
  note as written; raise the contradiction as a question for Lee-Ann.
- **Storage & Security**: covered by item 3 above (field + note are the same thing here).
- **Booth confirmation on payment** (source line 273): "Booths spaces are confirmed only
  once this registration form has been received and the payment has reflected in the bank
  account." (source's own grammar, "Booths spaces" — keep verbatim, do not correct to
  "Booth space"). Source positions this between the Gas section and VENDOR DECLARATION —
  thematically it is about payment confirming the booth, and `VendorPaymentFieldset.tsx`
  ("Payment & terms") is the section mounted immediately before `VendorDeclarationFieldset`.
  Add as a new `<p>`, verbatim, at the top of `VendorPaymentFieldset.tsx` (before the two
  insurance fields).

## Backward compatibility (SAOC lead's constraint, 2026-10-08)

"Pre-M2 vendorSubmissions documents must stay readable. ADD new fields and NEVER rename
existing ones, so staffPerDay stays and the per-day fields are additive." This is honoured at
two separate layers, which this feature deliberately treats differently:

1. **The Firestore document schema (`types/index.ts`'s `VendorSubmission`,
   `lib/vendor-submissions.ts`'s validators/builder) — untouched by this feature, full stop.**
   `staffPerDay?: number` stays exactly where it is, forever; the 5 `staffCount*` fields
   already exist alongside it (added by a prior mission, not this one). Confirmed by
   assertion A5 (a `git diff` against `origin/main` on both files must be empty). This is
   what "never rename" actually binds — the stored-document shape.
2. **The live registration form's own input state (`VendorRegisterFormState` in
   `lib/vendor-register-form-payload.ts`, and `INITIAL_STATE`) — DOES stop collecting
   `staffPerDay` from new submissions.** This is a UI-layer type describing what the *current*
   form asks a *new* vendor to fill in; it is not the stored-document schema, and the current
   source document no longer asks for one combined number — only 5 separate ones. Continuing
   to populate `staffPerDay` on new submissions would mean inventing a value with no source
   basis (summing the 5 counts would be a judgement call the source doesn't support, and
   leaving it as a second, redundant input the vendor fills in separately from the 5-day
   breakdown is not asked for either). `buildVendorRegistrationPayload()` therefore never sets
   `staffPerDay` for a submission created through this form from now on — the field is simply
   never populated going forward, exactly like any other already-optional field a vendor
   leaves blank.

**The read/display side (admin review route + the approval-confirmation email) is where
"stay readable" has real teeth, and is handled additively, per the lead's "ADD, don't
replace" instruction. Revised 2026-10-08 (second amendment) after reading the actual current
code — the email's `VendorApprovalConfirmationInput`/`VendorApprovalConfirmationProps`
interfaces have no separate "builder" function; `sendVendorApprovalConfirmationEmail()` itself
constructs the React element field-by-field. There are also, confirmed by reading
`app/api/admin/vendors/applications/[id]/review/route.ts:223`, TWO call sites for this one
email, not one — see below for why the second one needs no change at all:**

- `app/api/admin/vendors/[id]/review/route.ts`'s existing literal
  `staffPerDay: data.staffPerDay ?? null` line is **kept exactly as-is** (not removed), and
  five more lines are **added** alongside it: `staffCountSetupDay: data.staffCountSetupDay ??
  null`, …`staffCountBreakdownDay: data.staffCountBreakdownDay ?? null`.
- `lib/vendor-approval-confirmation.ts`'s `VendorApprovalConfirmationInput` interface gains the
  same 5 fields, each `?: number | null` — **optional-only, added alongside the existing
  `staffPerDay` field, never instead of it.** `sendVendorApprovalConfirmationEmail()`'s own
  signature (its two parameters, return type, and the `SendVendorApprovalConfirmationDeps`
  injectable-mailer shape) **does not change at all.** Its builder keeps
  `staffPerDay: input.staffPerDay ?? null` and adds the 5 new fields with the same `?? null`
  pattern.
- `emails/VendorApprovalConfirmation.tsx` gains one new exported pure function,
  `resolveStaffAttendanceDisplay(input)`, alongside its existing exported `formatBoothNumber`/
  `formatOptionalField`/`formatRegistrationCodeForReadAloud` helpers (same file, same
  convention — the file's own header comment already states that formatting logic belongs
  here, not in the lib file, "so the same formatting logic is exercised whether the caller is
  this function or a direct render() call in a test"). It returns
  `{ mode: 'breakdown' | 'legacy' | 'none', ... }`:
  - `'breakdown'` when any of the 5 `staffCount*` values is non-null — true for every
    submission created after this feature ships. Renders the 5-line per-day table.
  - `'legacy'`, as a fallback, when only `staffPerDay` is non-null — true for every submission
    created before this feature. Renders the single original "Staff per day: {value}" line,
    unchanged wording and position, via the existing `formatOptionalField()` helper.
  - `'none'` when neither is populated — the existing "Not specified" behaviour, unchanged,
    never the literal string `undefined`.
  - **Priority rule (architect's call, needed because the function must answer every input,
    not just the two that actually occur):** if both are ever non-null on one document,
    `'breakdown'` wins — it is the more granular, newer-shaped data. This combination cannot
    arise from this feature's own write paths (new submissions never set `staffPerDay`; old
    ones never have `staffCount*`), but a future manual Firestore edit or migration script
    should not hit undefined behaviour. Verified directly, not by inference, in assertion A9.
  - This is the one place in this feature where `staffPerDay` is read, never written, which is
    exactly what "stay readable" requires and nothing more.
- **The second call site, `app/api/admin/vendors/applications/[id]/review/route.ts:223`,
  needs — and gets — zero changes.** It calls `sendVendorApprovalConfirmationEmail()` with a
  narrower input (`businessName`/`contactPersonName`/`contactEmail`/`registrationCode`/
  `registrationLink` — no staff/booth/logistics fields at all), which takes the component down
  its `registrationLink` branch — a structurally different render path (see
  `emails/VendorApprovalConfirmation.tsx`'s own `registrationLink ? ... : ...` ternary) that
  never renders `staffPerDay`, `resolveStaffAttendanceDisplay`, or any other logistics field
  regardless of what's in scope. Because the 5 new fields are optional-only additions to an
  existing interface, this call site keeps compiling and rendering bit-for-bit as before with
  no edit required — this is exactly what "sendVendorApprovalConfirmationEmail's signature
  must not change" protects, and it is proved, not just asserted, by **A10**: a fixture that
  calls the real function with this call site's exact literal input shape and checks the
  result. This file falls under the `app/api/admin/vendors/**` collision glob and remains
  untouched — enforced independently by **A7** and **A8**.

No Firestore write path is touched by this feature (see the next section), so the "every new
optional field" instruction about undefined-writes is pre-satisfied — there are no new
Firestore-written fields here, only wiring onto fields a prior, already-gated mission wrote
the validators and the strip-undefined safety net for.

**Files the SAOC lead has cleared for this feature to edit, per the second amendment
(2026-10-08):** `app/api/admin/vendors/[id]/review/route.ts`, `lib/vendor-approval-
confirmation.ts`, `emails/VendorApprovalConfirmation.tsx`. Of these, only the first falls
under the `feat/vendor-invite` collision guard and needed a `shared_files:` entry (see
"Collision guard" below) — the other two are outside both guarded globs
(`app/admin/vendors/**`, `app/api/admin/vendors/**`) and were never collision-guard
candidates; the lead's clearance for them is a design sign-off, not a glob-collision
clearance.

## Firestore undefined-write safety (CLAUDE.md / `docs/firestore-undefined-write-safety.md`)

Checked directly: `lib/vendor-submissions.ts:1041` already wraps `buildVendorSubmission()`'s
return value in `stripUndefinedProperties()` (from `lib/firestore-write-safety.ts`), added by
mission `firestore-undefined-write-safety` specifically to stop a field-by-field builder from
writing literal `undefined` own-properties that the Firestore Admin SDK rejects at write
time. Since this feature does not modify `buildVendorSubmission()` or any other write
builder — the 5 staff-count fields, the 3 waste fields, and `storageRiskAcknowledged` were
already added to that builder's field list by the prior mission, under the same
`stripUndefinedProperties()` wrapper — **the undefined-write rule is already satisfied for
every field this feature touches, with no code change required.** Assertion A5 (which
confirms `lib/vendor-submissions.ts` is untouched by this feature) is also, transitively, the
proof that this protection stays in place. `lib/firestore-serialization.ts`'s
`serializeVendorSubmission()` (the read-side counterpart) is **structural** — it deep-walks
the whole document converting Timestamp-shaped values regardless of key name, so it requires
no change either to correctly read any of this feature's fields back out of Firestore.

## Consumer trace (every changed/added field must reach these, where applicable)

Scope for this trace, per the SAOC lead's explicit instruction: `app/admin/`,
`app/api/vendors/`, `app/api/admin/vendors/`, and `lib/email.ts` — but **only** where they
actually consume a field this feature changes. Checked all four:

1. `types/index.ts` / `lib/vendor-submissions.ts` — untouched (see "Backward compatibility").
2. `lib/vendor-register-form-payload.ts` — `VendorRegisterFormState` gains
   `staffCountSetupDay/Day1/Day2/Day3/BreakdownDay` (string, numeric-coerced via the existing
   `toOptionalInt`), `wasteTypes` (string[]), `wasteTypesOther` (string),
   `storageRiskAcknowledged` (boolean); drops `staffPerDay` (see above — this is the live
   form's input-state type, not the stored-document schema). Add
   `isWasteTypesOtherFieldApplicable(state)` guard mirroring `isFoodRetailer`'s shape exactly.
   Extend the payload literal for all new/changed fields with
   `toOptionalInt`/`toOptionalBoolean`/plain-array-passthrough as appropriate — never a
   spread.
3. `lib/vendor-register-form-initial-state.ts` — `INITIAL_STATE` gains the new keys, drops
   `staffPerDay` (mirrors point 2 — it initialises `VendorRegisterFormState`, not
   `VendorSubmission`).
4. `components/vendors/index.ts` — exports `VendorStaffPassesFieldset`,
   `VendorStorageFieldset`, `VendorWasteFieldset`.
5. `components/vendors/VendorRegisterForm.tsx` — mounts the two new top-level fieldsets in
   the order given above.
6. **`app/admin/` (admin UI pages/components, e.g. `components/admin/VendorReviewTable.tsx`)
   — checked, no change.** It is a summary table (business name, contact, category, 3 permit
   numbers, status, actions) and does not render staff/waste/storage/vehicle/VAT fields for
   any vendor today. Confirmed against the full field list this feature touches: zero
   consumption, zero change needed.
7. **`app/api/vendors/` — checked, no change.** `app/api/vendors/register/route.ts` passes
   `rawInput` straight through to `validateVendorSubmissionInput()`/`buildVendorSubmission()`
   generically (unchanged file, confirmed by the same mechanism as the prior mission's own F2
   contract, which established this for the sibling fields in the same way).
8. **`app/api/admin/vendors/` — exactly one file changed: `[id]/review/route.ts`** — see
   "Backward compatibility" above for the exact additive edit (5 new lines added, the
   existing `staffPerDay` line kept). No other file under this path consumes any field this
   feature touches (confirmed by grep across the whole directory before writing this
   contract). See the Collision Guard section below for why this file, specifically, needs
   sign-off before @dev starts.
9. **`lib/email.ts` — checked, no change.** It is a generic Resend-sending wrapper
   (`sendEmail`, `FORMS_FROM_ADDRESS`, `resolveReplyTo`) with no per-template field allowlist;
   nothing about adding fields to an email's props requires touching it.
10. **Emails**: `emails/VendorApprovalConfirmation.tsx` + `lib/vendor-approval-confirmation.ts`
    — additive change, detailed under "Backward compatibility" above. Note: this is a
    *different* feature's files than `docs/vendor-flow-notifications.md` describes (that doc
    covers the application-received / new-registration-submitted / stand-payment admin-and-
    vendor notices — a sibling feature, `vendor-f8-approval-email`'s files, not touched by
    this one). This feature follows the same established conventions documented there
    (no PII in logs, `deliverConfirmationEmailAfterCommit` wrapping, `formatOptionalField()`
    for optional values) without editing any file that doc actually describes.
11. CSV export: none exists anywhere in the vendor flow — confirmed, no consumer to update.

## Collision guard — `feat/vendor-invite`

The SAOC lead is building an admin "invite a vendor" feature on `feat/vendor-invite` (off
`origin/main`), touching `app/admin/vendors/**`, `app/api/admin/vendors/**`, and the
token-issuing code. This feature's footprint under those two globs is deliberately minimal:

**`shared_files`** (the one file F1 touches under either glob) — **cleared by SAOC lead
2026-10-08**, along with `lib/vendor-approval-confirmation.ts` and
`emails/VendorApprovalConfirmation.tsx` (design sign-off for those two; see "Backward
compatibility" above for why they fall outside both guarded globs and so were never a
glob-collision candidate in the first place). Recorded as a YAML comment in `contract-f1.yaml`
rather than a `shared_files:` top-level key — `python3 execution/contract.py validate`
rejected that key as unknown (`athanor.contract/v1` has no such field), so this golden section
is now the canonical record, not the contract file itself:
- `app/api/admin/vendors/[id]/review/route.ts` — additive only: 5 new `?? null` lines added
  to the existing `sendVendorApprovalConfirmationEmail({...})` call's object literal; the
  existing `staffPerDay` line and every other line in that call are untouched; no other
  change anywhere else in the file.

**Why the signature-stability requirement (A9/A10) matters beyond this one feature**:
`sendVendorApprovalConfirmationEmail` already has a second caller today —
`app/api/admin/vendors/applications/[id]/review/route.ts:223` (the registration-link/
application-approval path) — and the SAOC lead's own `feat/vendor-invite` branch will add a
*third* call to the same function. Keeping the 5 new fields optional-only, with no change to
the function's parameters or return type, is what lets all three callers (this feature's,
the existing application-approval one, and the lead's upcoming one) share one function safely
without coordinating a signature change across branches.

**Token issuance — explicitly out of scope, never touched by this feature:**
`app/api/admin/vendors/applications/[id]/reissue-code/route.ts`,
`app/api/admin/vendors/applications/[id]/review/route.ts`,
`app/(marketing)/national-show/vendors/register/page.tsx` (the register page's own token
gate wrapper around `<VendorRegisterForm />` — this feature only touches fieldset components
*inside* that form, never the page or its gate), and the token/code library modules
(`lib/vendor-registration-token.ts`, `lib/vendor-registration-token-claim.ts`,
`lib/vendor-registration-code.ts`, `lib/vendor-registration-code-verify-handler.ts`,
`app/api/vendors/register/verify-code/route.ts`). Verified by grep across
`app/admin/vendors/` and `app/api/admin/vendors/` that no other file in either tree consumes
any field this feature changes. Assertion A7 makes this a hard gate (`git diff` against every
listed path must be empty).

**`sanity/schemas/**`** — checked, not needed. Nothing in this feature's field set is modelled
in Sanity (the vendor registration form is a Firestore-backed flow, not CMS content); no
schema file references any `VendorSubmission` field at all. Flagged per the SAOC lead's
request; confirmed not required. Assertion A8 makes this a hard gate too.

## Gaps / questions for Lee-Ann (name, don't fill)

1. **Exhibitor passes** — the source table only has `Day` / `Number of Staff`, no separate
   "exhibitor pass" question, yet a prior mission added `exhibitorPassesRequired`/
   `exhibitorPassesCount` to the data model. Is a distinct exhibitor-pass count needed (one
   per staff member? a separate allocation?), or was that invented in error and safe to leave
   permanently unrendered?
2. **`specialWasteRequirements`** — same shape of question: present in the data model, absent
   from the current source text under "WASTE, CLEANING AND ENVIRONMENTAL IMPACTS". Confirm
   whether this was meant to capture something the current docx doesn't mention, or drop the
   expectation that it will ever be rendered.
3. **Load-in/load-out slot contradiction** — the live form lets a vendor type a *preferred*
   load-in/load-out slot (`loadInSlot`/`loadOutSlot`, free text). The current source text says
   slots are organiser-*allocated* a week before setup, not vendor-chosen. Should the
   preference inputs be removed/relabelled as a request rather than a slot, or is "preferred"
   intentional (vendor states a preference, organiser still allocates the real slot)?
4. **Two different "final booth allocation" sentences in the same document** — the BOOTH
   REQUIREMENTS section (line 142) and the Terms & Conditions "Vendor Allocation" clause say
   closely related but differently worded things. Per the SAOC lead's instruction this
   feature renders only the Terms & Conditions sentence (already correct) and does **not**
   add a second rendering of the BOOTH REQUIREMENTS one. Is the document's own duplication
   intentional (and if so, should the live form eventually show both, in their own correct
   sections), or is one of the two sentences a drafting leftover that should be dropped from
   the source itself?

## Handover to SAOC (per Brad, 2026-10-08: "hand the work back to SAOC when done, forms need the full chain")

This feature does not end at the contract gate going green. Once @dev implements against
this contract and every assertion passes, the chain continues exactly as `workflow.md`
prescribes for a forms feature — @qa (cross-model, `codex_qa.sh`) → @docs → gate → handover.
The handover note @docs/the orchestrator gives the SAOC lead when F1 closes must say,
plainly, in this order:

1. **What changed, in one paragraph**: the 9 items above, referencing this golden by path —
   not a re-derivation, a pointer.
2. **What the SAOC lead owns next**: the 4 named gaps/questions for Lee-Ann above are not
   resolved by this feature and are not @dev's or @docs's to resolve — they need Lee-Ann's
   answer, routed through the SAOC lead, before any follow-up feature touches those fields
   again.
3. **The collision-guard outcome**: confirmation that the one `shared_files` entry
   (`app/api/admin/vendors/[id]/review/route.ts`) was cleared with the SAOC lead before @dev
   started, and that assertions A7/A8 passed (token issuance and `sanity/schemas/**`
   untouched) — so the SAOC lead can resume `feat/vendor-invite` work on the same files with
   confidence nothing underneath it moved.
4. **Verification evidence**: the `pnpm run type-check` / `pnpm run lint` results and the full
   contract gate output (`python3 execution/contract.py gate`), not a claim that it passed —
   per `behavior.md`'s "never assert without verification."
5. **What this feature explicitly did not do**: did not touch `types/index.ts` or
   `lib/vendor-submissions.ts` (the Firestore schema/validators), did not add an admin UI
   column, did not touch token issuance, did not touch Sanity schemas, did not change
   `sendVendorApprovalConfirmationEmail`'s signature, did not touch the application-approval
   call site, did not resolve any of the 4 named gaps.

## Verification path for @dev

`pnpm run type-check` and `pnpm run lint` are the required gates (per Brad's instruction — do
**not** run `pnpm run build`; a dev server on :3003 depends on this repo's `.next`). The
contract's own assertions (grep + four `tsx`/`bash`/`mjs` scripts, including the two
collision-guard negative assertions A7/A8 and the two fixture-based staff-attendance
assertions A9/A10) are the structural/behavioural proof; human/browser verification is not
required for this feature (copy/label changes to existing, already-styled fieldsets, plus one
additive route/email edit — no new visual component).

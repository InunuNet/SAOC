# Vendor Form Copy Update — 2026-10-07 Source

**Feature:** F1 of mission `vendor-form-copy-20261007`. Lee-Ann updated the Drive source doc
("13.2 Vendor Form - SAOC National Show Vendor Registration Form.docx", id
`1tbA4GNbplWkW-4Pv3LPsdV5RT_ZdViBe`) on 2026-10-07 without telling Brad — found only because an
agent happened to re-read the doc (see [docs/lee-ann-drive-watch.md](lee-ann-drive-watch.md) for
the tool this mission added so that stops happening). This feature brings the live vendor
registration form into line with the current text — **copy and structure only, no visual/design
change.**

**Contract:** `.agent/memory/project/specs/vendor-form-copy-20261007/contract-f1.yaml` and
`.agent/memory/project/specs/vendor-form-copy-20261007/goldens/f1-vendor-form-copy-update.md` —
full decision record, field-by-field source mapping, consumer trace, collision-guard footprint,
and the open questions for Lee-Ann reproduced below. This doc summarizes; treat the golden as the
source of truth for edge cases.

---

## What changed

Nine copy/structure items, reusing existing fieldset/note/primitive patterns in
`components/vendors/` — no new leaf input component was invented:

1. **Staff & Exhibitor Passes** — new `components/vendors/VendorStaffPassesFieldset.tsx` renders
   5 numeric fields (Setup Day / Day 1 / Day 2 / Day 3 / Breakdown Day, each "Number of Staff"),
   wired to the already-validated `staffCountSetupDay`/`staffCountDay1`/`staffCountDay2`/
   `staffCountDay3`/`staffCountBreakdownDay` server fields. Mounted directly inside
   `VendorBoothFieldset.tsx`, immediately after `VendorBoothUtilitiesFieldset` and before the
   vehicle registration fields, matching the source document's own section order. The old single
   `staffPerDay` input inside `VendorBoothUtilitiesFieldset.tsx` is deleted with no replacement
   there.
2. **Waste, cleaning and environmental impacts** — new `components/vendors/VendorWasteFieldset.tsx`:
   a 6-option `wasteTypes` checkbox group onto the existing `VENDOR_WASTE_TYPES` enum, a
   `wasteTypesOther` text field gated on `other` being selected, and a verbatim advisory note.
3. **Storage & Security** — new `components/vendors/VendorStorageFieldset.tsx`: one
   `storageRiskAcknowledged` checkbox, not forced true, label is the advisory text itself.
4. Two vehicle-registration labels in `VendorBoothFieldset.tsx` corrected to verbatim source text
   ("Less than 1 ton Delivery Van registration Number" / "Above 1 ton Truck registration number").
5. `VendorBusinessAddressFieldset.tsx`'s VAT radio relabelled "VAT registered" → "VAT Vendor".
6. **Booth allocation note — reconciled, not duplicated.** The source document has two
   differently-worded "final booth allocation" sentences (BOOTH REQUIREMENTS section, and the
   Terms & Conditions "Vendor Allocation" clause). Per the SAOC lead's explicit instruction, the
   existing note at `VendorTermsFieldset.tsx:19` already renders the T&Cs sentence byte-for-byte
   correctly; it was re-verified, not duplicated, and no new note was added to
   `VendorBoothPositionFieldset.tsx`. The BOOTH REQUIREMENTS sentence stays unrendered — a named
   gap for Lee-Ann (below), not silently dropped.
7. `VendorMarketingFieldset.tsx`'s two marketing-permission option labels replaced with the
   verbatim source sentences (full permission / listing-only).
8. Three new verbatim advisory `<p>` notes: electrical safety (`VendorBoothUtilitiesFieldset.tsx`,
   gated on power being required), delivery/collection slots (`VendorBoothFieldset.tsx`), and
   booth-confirmed-on-payment (`VendorPaymentFieldset.tsx`).
9. **Additive consumer re-wire** — see "Backward compatibility" below.

The waste section heading renders **"Waste, cleaning and enviromental impacts"** — the source
document's own misspelling of "environmental," reproduced verbatim by the no-invention rule
(`docs/rules/no-invention.md`), not corrected.

## The single admin file touched

`app/api/admin/vendors/[id]/review/route.ts` is the only file outside `components/vendors/` and
the two email files below that this feature changes. The edit is additive only: the existing
`staffPerDay: data.staffPerDay ?? null` line in the `sendVendorApprovalConfirmationEmail({...})`
call is kept unchanged, and five new lines are added alongside it —
`staffCountSetupDay: data.staffCountSetupDay ?? null` through
`staffCountBreakdownDay: data.staffCountBreakdownDay ?? null`. No other line in the file changes.

## Backward compatibility

The SAOC lead's constraint: *"Pre-M2 vendorSubmissions documents must stay readable. ADD new
fields and NEVER rename existing ones, so `staffPerDay` stays and the per-day fields are
additive."* This is honoured at two separate layers, deliberately treated differently:

- **The Firestore document schema** (`types/index.ts`'s `VendorSubmission`,
  `lib/vendor-submissions.ts`'s validators/builder) is **untouched by this feature, full stop.**
  `staffPerDay?: number` stays exactly where it is; the 5 `staffCount*` fields already existed
  there, added by a prior mission. This is what "never rename" binds — the stored-document shape.
- **The live form's own input state** (`VendorRegisterFormState` in
  `lib/vendor-register-form-payload.ts`, `INITIAL_STATE`, and the client-side validation in
  `lib/vendor-register-form-validation.ts`) **does** stop collecting `staffPerDay` — the current
  source document no longer asks for one combined number, only five separate ones.
  `buildVendorRegistrationPayload()` never sets `staffPerDay` for a submission created through
  this form from now on.
- **staffPerDay legacy fallback (read/display side).** `emails/VendorApprovalConfirmation.tsx`
  gains one new exported pure function, `resolveStaffAttendanceDisplay(input)`, returning
  `{ mode: 'breakdown' | 'legacy' | 'none', ... }`:
  - `'breakdown'` when any of the 5 `staffCount*` fields is non-null — every submission created
    after this feature ships. Renders the 5-line per-day table.
  - `'legacy'`, as a fallback, when only `staffPerDay` is non-null — every submission created
    before this feature. Renders the single original "Staff per day: {value}" line, unchanged
    wording and position, via the existing `formatOptionalField()` helper.
  - `'none'` when neither is populated — the existing "Not specified" behaviour, unchanged.
  - If both are ever non-null on one document, `'breakdown'` wins (the more granular, newer-shaped
    data) — this combination cannot arise from this feature's own write paths, but the function
    must still answer it rather than fall through undefined.
- **Pre-existing `vendorSubmissions` documents stay readable** because nothing in the read path
  was removed, only added to: the email interface's 5 new fields are optional-only additions, and
  `resolveStaffAttendanceDisplay` falls back to the legacy field whenever the new fields are
  absent.
- **The email signature is unchanged.** `sendVendorApprovalConfirmationEmail()`'s own parameters,
  return type, and injectable-mailer (`SendVendorApprovalConfirmationDeps`) shape do not change at
  all — only `VendorApprovalConfirmationInput` gains 5 optional (`?: number | null`) fields,
  alongside the kept `staffPerDay`, never instead of it.
- **The second caller, `app/api/admin/vendors/applications/[id]/review/route.ts:223`, is
  untouched.** It calls `sendVendorApprovalConfirmationEmail()` with a narrower input
  (business/contact/registration fields only, no staff/booth/logistics fields at all), which takes
  the component down its `registrationLink` branch — a structurally different render path that
  never renders any staff field regardless of what's in scope. Because the 5 new fields are
  optional-only additions to an existing interface, this call site keeps compiling and rendering
  bit-for-bit unchanged with no edit of its own — proved, not just asserted, by contract
  assertion A10 (a fixture call using this call site's exact literal input shape).

No Firestore write path is touched by this feature, so the stripUndefinedProperties() safety net
(`docs/firestore-undefined-write-safety.md`) already covers every field this feature wires onto.

## Gaps / questions for Lee-Ann (named, not resolved by this feature)

1. **Exhibitor passes** — the source table only has `Day` / `Number of Staff`, no separate
   "exhibitor pass" question, yet a prior mission added `exhibitorPassesRequired`/
   `exhibitorPassesCount` to the data model. Is a distinct exhibitor-pass count needed, or was
   that invented in error and safe to leave permanently unrendered?
2. **`specialWasteRequirements`** — present in the data model, absent from the current source text
   under "WASTE, CLEANING AND ENVIRONMENTAL IMPACTS." Confirm whether it was meant to capture
   something the current docx doesn't mention, or drop the expectation that it will be rendered.
3. **Load-in/load-out slot contradiction** — the live form lets a vendor type a *preferred*
   load-in/load-out slot (free text). The current source text says slots are organiser-*allocated*
   a week before setup, not vendor-chosen. Should the preference inputs be removed/relabelled, or
   is "preferred" intentional?
4. **Two different "final booth allocation" sentences in the same document** — the BOOTH
   REQUIREMENTS section and the Terms & Conditions "Vendor Allocation" clause say closely related
   but differently worded things. This feature renders only the Terms & Conditions sentence
   (already correct) and does not add a second rendering of the BOOTH REQUIREMENTS one. Is the
   document's own duplication intentional, or is one of the two sentences a drafting leftover that
   should be dropped from the source itself?

These are not @dev's or @docs's to resolve — they need Lee-Ann's answer, routed through the SAOC
lead, before any follow-up feature touches those fields again.

## Related

- [docs/lee-ann-drive-watch.md](lee-ann-drive-watch.md) — the F2 companion tool that would have
  surfaced this 2026-10-07 edit automatically.
- [docs/vendor-registration-form-rebuild-f1.md](vendor-registration-form-rebuild-f1.md) and
  [docs/vendor-registration-form-rebuild-f2.md](vendor-registration-form-rebuild-f2.md) — the
  prior mission that added the `staffCount*`/waste/storage fields to the data model with no UI
  wiring, which this feature wires up.
- [docs/firestore-undefined-write-safety.md](firestore-undefined-write-safety.md) — the
  `stripUndefinedProperties()` convention this feature relies on without touching.
- [docs/handover/vendor-form-copy-20261007.md](handover/vendor-form-copy-20261007.md) — handover
  note to the SAOC lead.

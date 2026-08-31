# F3 (vendor-registration-form-rebuild) — UI: Vendor Category & Products (Section 3, full): decision record

Source: `docs/leeann-source/2027-vendor-registration-form_2026-08-25.md`, Section 3 (3.1-3.9).
Depends on F1 (`goldens/f1-data-model-foundation.md`), which already added every Section 3 field
this feature collects to `types/index.ts` and wired them into `lib/vendor-submissions.ts`, all
optional, deliberately leaving `vendorCategory` untouched (F1's sequencing rule: "vendorCategory
enum stays untouched here ... deferred to F3"). This feature is the enum correction itself, one
genuinely new field (`vendorCategoryOther`), and the UI for every other Section 3 addition.

## The vendorCategory enum correction: WIDENING, not renaming — the good news

The live `VendorCategory` union (`types/index.ts`) has 8 members:
`'plant-sales' | 'product-sales' | 'rare-exotic-plants' | 'food-retailer' | 'hardware' | 'books' |
'art' | 'other'`.

Source 3.1 lists 11 checkboxes:

> Orchid plant sales · Other plant sales · Rare / exotic plants · Orchid growing products /
> supplies · Greenhouse / hardware / infrastructure · Fertilisers / growing media / plant care
> products · Books / publications · Art / crafts · Pottery / ceramics · Food / beverage retailer ·
> Other

Mapping every source item against the live 8:

| Source item | Live value | Verdict |
|---|---|---|
| Orchid plant sales | `plant-sales` | keep, label already correct |
| Other plant sales | — | **new**: `other-plant-sales` |
| Rare / exotic plants | `rare-exotic-plants` | keep, label already correct |
| Orchid growing products / supplies | `product-sales` | keep value, correct label (was "Orchid product sales") |
| Greenhouse / hardware / infrastructure | `hardware` | keep value, correct label (was already close) |
| Fertilisers / growing media / plant care products | — | **new**: `fertilisers-growing-media` |
| Books / publications | `books` | keep value, correct label (was "Books") |
| Art / crafts | `art` | keep value, correct label (was "Art") |
| Pottery / ceramics | — | **new**: `pottery-ceramics` |
| Food / beverage retailer | `food-retailer` | keep value, correct label (was "Food retailer") |
| Other | `other` | keep, unchanged — now additionally gates a genuinely new `vendorCategoryOther` free-text field (see below) |

**Every one of the 8 live values is kept, verbatim, unrenamed.** The correction is a pure
**widening** — 3 new members added (`other-plant-sales`, `fertilisers-growing-media`,
`pottery-ceramics`), 5 existing values get a corrected display **label only** (no value-string
change), and 3 values needed no change at all. This is the exact opposite of F4's `boothType`
situation (a genuine 3→4 member breaking rename) — do not copy F4's two-phase deploy-safety
pattern here; it does not apply.

### Why this is deploy-safe without any special sequencing, unlike F4's boothType

`validateVendorCategory`'s closed-set check (`lib/vendor-submissions.ts`) is `value.filter((entry)
=> !VENDOR_CATEGORIES.includes(entry))` — a value is rejected only if it is **not** in the allowed
set. Adding 3 new allowed values can only make the check accept **more** inputs, never fewer. A
real, still-deployed pre-F3 form (emitting only the old 8 values) continues to validate
identically after this feature deploys, in the same deploy, with no intermediate unsafe state —
there is no scenario analogous to F1/F2's "field required before any UI collects it" problem here,
because nothing is *removed* or *narrowed*. `check-f3-category-enum-widened-and-validated.mjs`'s
proofs (a) and (e) are the load-bearing evidence for this claim: (a) proves each of the 8 old
values still individually validates; (e) proves F2's own two golden `VendorRegisterFormState`
JSON fixtures, run through the real `buildVendorRegistrationPayload()`, still validate end to end.

## Why a mandatory ripple sweep is baked into this contract anyway (F2's hard lesson #1)

Even though this specific change is additive-safe by construction, F2's own golden README records
a hard lesson from the mission's standing workflow rule: **a diff-scoped Codex review only catches
fixtures that happen to overlap the literal diff.** Widening `VendorCategory` touches a type used
by name across five *other*, already-shipped contracts' own compiler-checked fixtures
(`vendor-f4-submissions-model`, `vendor-f6-review-workflow`, `vendor-f7-payment-path`,
`vendor-form-ui`) plus four Playwright-driven contracts that click a checkbox by a DOM id derived
from the literal string `'plant-sales'`
(`vendor-boothcount-guarded-parse-f1`, `vendor-form-client-validation-gate-f1`,
`vendor-form-maxlength-and-phone-pattern-f1`, and `vendor-form-ui`'s own checks). None of these are
in this feature's diff, so Codex's diff-scoped pass will never look at them. **A1 (`pnpm
type-check`) also does not cover them** — the root `tsconfig.json` excludes `contracts/` from the
main compile; each of those contracts type-checks itself only via its own scoped
`tsconfig.typecheck.json`, run as its own contract's own assertion, never re-run by anything else
automatically.

`check-f3-ripple-sweep.sh` (A5, below) is the assertion that forces this sweep to actually happen,
independent of Codex: it (1) re-runs `npx tsc --noEmit` against all 4 downstream contracts' own
scoped tsconfigs that reference `VendorCategory` in a compiler fixture, (2) greps `types/index.ts`
to confirm all 8 pre-existing literal values are still spelled identically (proving no silent
rename), and (3) greps the rebuilt `VendorCategoryFieldset.tsx` to confirm the `'plant-sales'`
option value — the one 4 live Playwright contracts click by DOM id
(`#vendor-register-vendorCategory-plant-sales`) — still exists. This is deliberately broader than
"prove the change is theoretically additive" (already covered by
`check-f3-category-enum-widened-and-validated.mjs`); it proves the *actual currently-shipped
fixtures* were not silently broken, not just that they theoretically shouldn't be.

## The new `vendorCategoryOther` field

Unlike every other Section 3 addition (all staged by F1), `vendorCategoryOther` did **not** exist
before this feature — F1's brief explicitly deferred all of `vendorCategory` (including its "+
Other free text" companion) to F3. This is a brand-new, purely additive, optional field:
`vendorCategoryOther?: string` (max length 100, matching every other short "Other" free-text field
in this codebase — `businessEntityTypeOther`, `wasteTypesOther`, `vehicleTypeOther`). It is gated
by a new `isVendorCategoryOtherFieldApplicable(state)` guard (`state.vendorCategory.includes('other')`),
mirroring `isTradingNameFieldApplicable`/`isVatNumberFieldApplicable`'s existing pattern exactly.

## Field-by-field: what F1 already added (optional, unvalidated-for-UI-purposes) vs. this feature's job

From `goldens/f1-data-model-foundation.md`'s Section 3 entry, all already on `VendorSubmission` and
wired into `validateVendorSubmissionInput()`/`buildVendorSubmission()`, all optional, none with
UI yet:

- `sellsLivePlants?: boolean`
- `livePlantTypes?: VendorLivePlantType[]` (7-member closed union: `'orchids' | 'other-plants' |
  'bulbs-tubers' | 'seeds' | 'cut-flowers' | 'tissue-culture' | 'other'`)
- `livePlantTypesOther?: string` (100)
- `plantsImportedForEvent?: boolean`
- `importCountryOfOrigin?: string` (200)
- `citesListedSpecies?: boolean`
- `foodHealthTradingDocumentation?: string` (500)

This feature's job: (1) correct `vendorCategory` per the mapping above, (2) add
`vendorCategoryOther`, (3) give every one of the 7 fields above real UI, wired into the real
gate/payload/render layers — never a parallel state or validation path.

## Files touched

1. **`types/index.ts`** — `VendorCategory` gains its 3 new members (`'other-plant-sales' |
   'fertilisers-growing-media' | 'pottery-ceramics'`), inserted in source order alongside the
   existing 8 (the exact declared order does not matter to TypeScript, but keep the source's own
   3.1 ordering for readability: `plant-sales`, `other-plant-sales`, `rare-exotic-plants`,
   `product-sales`, `hardware`, `fertilisers-growing-media`, `books`, `art`, `pottery-ceramics`,
   `food-retailer`, `other`). Adds one new field, `vendorCategoryOther?: string`, directly after
   `vendorCategory: VendorCategory[];`. Replaces the now-stale F1 comment ("vendorCategory enum
   stays untouched here ... deferred to F3") with an F3 provenance comment. No other field's
   optionality changes; `VendorLivePlantType`, `citesListedSpecies`, etc. are untouched — they
   already have the right shape from F1.

2. **`lib/vendor-submissions.ts`** — `VENDOR_CATEGORIES` gains the 3 new members (all 8 old
   members appear unmodified, same spelling, same order they're in today — do not reorder or
   respell any of them). `FIELD_MAX_LENGTHS` gains `vendorCategoryOther: 100`. One new
   `validateOptionalStringMaxLength(record, 'vendorCategoryOther', errors,
   FIELD_MAX_LENGTHS.vendorCategoryOther)` call, grouped with the other F1-added optional string
   checks. `buildVendorSubmission()`'s explicit field-by-field copy gains
   `vendorCategoryOther: input.vendorCategoryOther,` (never a spread). No existing validation rule
   is loosened or tightened; `validateVendorCategory`'s logic itself is unchanged — only the array
   it checks membership against grows.

3. **`lib/vendor-register-form-payload.ts`** — `VendorRegisterFormState` gains 8 new fields:
   `vendorCategoryOther: string`, `sellsLivePlants: '' | 'true' | 'false'` (mirrors
   `vatRegistered`/`powerRequired`'s existing controlled-string convention), `livePlantTypes:
   string[]`, `livePlantTypesOther: string`, `plantsImportedForEvent: '' | 'true' | 'false'`,
   `importCountryOfOrigin: string`, `citesListedSpecies: '' | 'true' | 'false'`,
   `foodHealthTradingDocumentation: string`.

   Five new leak-proof render-gate + payload-exclusion guard functions, exported exactly like the
   existing `isElectricalLoadApplicable`/`isFoodRetailer`/`isTradingNameFieldApplicable`, each used
   identically by both the render layer and the payload builder:
   - `isVendorCategoryOtherFieldApplicable(state)` → `state.vendorCategory.includes('other')`.
   - `isLivePlantTypesFieldApplicable(state)` → `state.sellsLivePlants === 'true'`. Gates the
     entire `livePlantTypes` checkbox group's render and the payload's `livePlantTypes`/
     `livePlantTypesOther` keys.
   - `isLivePlantTypesOtherFieldApplicable(state)` → `state.livePlantTypes.includes('other')`.
     Independently gates just `livePlantTypesOther`'s own free-text input within the group (only
     relevant once `isLivePlantTypesFieldApplicable` is already true — the payload builder checks
     both).
   - `isImportCountryOfOriginFieldApplicable(state)` → `state.plantsImportedForEvent === 'true'`.
   - `isCitesPermitNumberFieldApplicable(state)` → `state.citesListedSpecies === 'true'`. **This
     changes existing behaviour**: `citesPermitNumber` is a pre-existing field, rendered
     unconditionally today. This feature gates its render for the first time, matching source
     3.5's own conditional structure ("If yes, provide relevant permit/reference number(s)"). This
     is a judgement call recorded here: the field's type/optionality/validation is completely
     unchanged (still optional, no new required-ness) — only its *visibility* becomes conditional,
     mirroring `isElectricalLoadApplicable`'s existing precedent (F4's `electricalLoad` field was
     already gated this same way against a pre-existing field). The payload-exclusion side of the
     gate is new; a stale-but-hidden `citesPermitNumber` value must not leak onto the wire when
     `citesListedSpecies` is `''`/`'false'` (`check-f3-payload-gates.mjs` proves this).

   `foodHealthTradingDocumentation` is **not** given a new gate — it reuses the existing
   `isFoodRetailer(state)` guard, exactly like the pre-existing `foodHandlingCertificateNumber`/
   `foodItemList`. Source 3.9 sits inside the Food Retailers block (immediately after 3.7/3.8),
   so gating it identically is the natural reading, not a new judgement call.

   `buildVendorRegistrationPayload` extends its explicit field-by-field object literal (never a
   spread) with all 8 new fields, applying `omitBlank`/`toOptionalBoolean` and the gates above
   exactly as every existing optional/gated field already does.

4. **`lib/vendor-register-form-validation.ts`** — **no changes.** Source 3.1 (`vendorCategory`)
   and 3.2 (`productDescription`) are already required and already validated client-side; nothing
   else in Section 3 carries an asterisk. No new required check, no new format check (no
   phone/email-shaped field is added by this feature).

5. **`components/vendors/VendorCategoryFieldset.tsx`** — rebuilt in place (no new fieldset file;
   this feature corrects an existing one, unlike F2's new `VendorEmergencyContactFieldset.tsx`),
   following source order:
   1. `vendorCategory` — `VendorCheckboxGroupField`, 11 options (values/labels per the mapping
      table above), still `required`.
   2. `vendorCategoryOther` — `VendorFormField`, gated on
      `isVendorCategoryOtherFieldApplicable`.
   3. `productDescription` — unchanged.
   4. `sellsLivePlants` — new `VendorBooleanRadioField` (Yes/No, mirroring `powerRequired`).
   5. `livePlantTypes` — new `VendorCheckboxGroupField` (7 options: `orchids`/`other-plants`/
      `bulbs-tubers`/`seeds`/`cut-flowers`/`tissue-culture`/`other`, labels Title Case matching
      source 3.3's own wording), gated on `isLivePlantTypesFieldApplicable`; `livePlantTypesOther`
      (`VendorFormField`) gated additionally on `isLivePlantTypesOtherFieldApplicable`.
   6. `plantsImportedForEvent` — new `VendorBooleanRadioField`; `importCountryOfOrigin`
      (`VendorFormField`) gated on `isImportCountryOfOriginFieldApplicable`.
   7. `citesListedSpecies` — new `VendorBooleanRadioField`; `citesPermitNumber` (existing
      `VendorFormField`, now gated on `isCitesPermitNumberFieldApplicable` per the judgement call
      above).
   8. `phytosanitaryPermitNumber` — unchanged, still ungated (source 3.6 has no "if yes" —
      "where applicable" only, no gating boolean exists anywhere in the data model for it).
   9. `foodHandlingCertificateNumber`, `foodItemList` — unchanged, still gated on the existing
      `isFoodRetailer(state)`.
   10. `foodHealthTradingDocumentation` — new `VendorFormField`, gated on `isFoodRetailer(state)`
       (see above).

   **Explicitly excluded from this feature**: source 3.8 (food prepared/cooked on site). F1's own
   golden README already recorded the dedup judgement call — source 3.8 is modelled as Section 8's
   two independent booleans (`foodPreparationOnSite`, `foodCookingOnSite`), owned by F5, not
   reintroduced here. `check-f3-fieldset-structure.sh` asserts neither name appears in this file.

   Reuses `VendorFormField`/`VendorCheckboxGroupField`/`VendorBooleanRadioField` exactly as they
   exist today — **no new primitive component is introduced**, matching F2's own precedent.

6. **`components/vendors/VendorRegisterForm.tsx`** — `INITIAL_STATE` gains the 8 new keys (`''`
   for strings/`[]` for `livePlantTypes` per their type, matching every other field's empty-state
   convention). No mount-order change — `<VendorCategoryFieldset .../>` is already mounted where
   it needs to be.

## Deploy-safety / sequencing verdict

**No special two-phase deploy handling is needed.** Unlike F4's `boothType` rename (a genuine
breaking narrowing that must ship in the same deploy as the UI that stops emitting the old
values), this feature's `vendorCategory` change is purely additive at the type/validator level —
every old value stays valid forever, nothing is narrowed. The only reason UI and data-model land
together here is ordinary feature hygiene (an unreachable field is pointless to add on its own),
not a deploy-safety requirement. There is no intermediate deployed state where a real vendor's
category selection could be rejected by this change, at any point before, during, or after
deploy.

## Live Firestore data check

No `vendorCategory` value used by any real/seed vendor submission is removed or renamed by this
feature (see the widening argument above), so there is no risk to already-submitted
`vendorSubmissions` documents from this change, regardless of what values they currently hold.

## What this feature does NOT do

- Does not touch `boothType` or `paymentMethodsAccepted` (F4/F8's job).
- Does not touch Section 8's `foodPreparationOnSite`/`foodCookingOnSite` (F5's job) — see the
  explicit exclusion above.
- Does not add a repeating-row UI or any new leaf primitive component.
- Does not change any Section 1/2/4+ field or fieldset.
- Does not touch the public vendor directory or vendor-to-ticket linkage — out of mission scope.

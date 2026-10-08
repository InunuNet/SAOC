#!/usr/bin/env bash
# F1 (vendor-form-copy-20261007) -- structural proof that every copy/structure delta from
# Lee-Ann's 2026-10-07 source doc landed: the three new fieldsets exist, are exported and
# mounted; the two relabeled strings and the two corrected advisory/permission strings are
# verbatim in the right file; the old wrong/missing strings are gone; the staff-per-day
# consumer chain is additively re-wired (staffPerDay kept, 5 new fields added) per the SAOC
# lead's backward-compat constraint; the existing Terms & Conditions allocation note is
# reconciled, not duplicated. Defeats: a fieldset that exists but is never mounted; a label
# changed in the wrong component; a paraphrase left in place instead of the verbatim source
# string; dropping staffPerDay from the email chain instead of keeping it; adding a second
# allocation note.
set -euo pipefail

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

# --- New fieldsets exist, reuse existing primitives, are exported and mounted ---
for f in VendorStaffPassesFieldset VendorStorageFieldset VendorWasteFieldset; do
  FILE="components/vendors/${f}.tsx"
  [ -f "$FILE" ] || fail "$FILE does not exist."
  grep -q "VendorFormField\|VendorCheckboxField\|VendorCheckboxGroupField\|VendorBooleanRadioField\|VendorRadioGroupField" "$FILE" \
    || fail "$FILE must reuse an existing Vendor*Field primitive, not a bespoke input."
  LINE_COUNT=$(wc -l < "$FILE" | tr -d ' ')
  [ "$LINE_COUNT" -le 150 ] || fail "$FILE is $LINE_COUNT lines, exceeds the project's 150-line component convention."
  grep -q "$f" components/vendors/index.ts || fail "components/vendors/index.ts must export $f."
  grep -q "<$f" components/vendors/VendorRegisterForm.tsx || fail "VendorRegisterForm.tsx must mount <$f .../>."
done

# --- Item 1: staff per day, 5 fields wired to the existing staffCount* server fields ---
grep -q "staffCountSetupDay" components/vendors/VendorStaffPassesFieldset.tsx || fail "VendorStaffPassesFieldset.tsx must render staffCountSetupDay."
grep -q "staffCountDay1" components/vendors/VendorStaffPassesFieldset.tsx || fail "VendorStaffPassesFieldset.tsx must render staffCountDay1."
grep -q "staffCountDay2" components/vendors/VendorStaffPassesFieldset.tsx || fail "VendorStaffPassesFieldset.tsx must render staffCountDay2."
grep -q "staffCountDay3" components/vendors/VendorStaffPassesFieldset.tsx || fail "VendorStaffPassesFieldset.tsx must render staffCountDay3."
grep -q "staffCountBreakdownDay" components/vendors/VendorStaffPassesFieldset.tsx || fail "VendorStaffPassesFieldset.tsx must render staffCountBreakdownDay."
grep -rq "fieldKey=\"staffPerDay\"" components/vendors/ && fail "No fieldset may still render staffPerDay as a live-form input -- the current source only asks for the 5 per-day counts."
grep -q "exhibitorPasses" components/vendors/VendorStaffPassesFieldset.tsx && fail "exhibitorPassesRequired/exhibitorPassesCount are not in the current source doc -- must not be rendered."

# --- Item 2: waste section ---
grep -q "wasteTypes" components/vendors/VendorWasteFieldset.tsx || fail "VendorWasteFieldset.tsx must render wasteTypes."
grep -q "General waste" components/vendors/VendorWasteFieldset.tsx || fail "VendorWasteFieldset.tsx must use the verbatim source label \"General waste\"."
grep -q "Food Waste" components/vendors/VendorWasteFieldset.tsx || fail "VendorWasteFieldset.tsx must use the verbatim source capitalisation \"Food Waste\"."
grep -q "Vendors are responsible for maintaining a clean and safe booths throughout the event" components/vendors/VendorWasteFieldset.tsx \
  || fail "VendorWasteFieldset.tsx must render the waste advisory note verbatim, typo included."
grep -q "specialWasteRequirements" components/vendors/VendorWasteFieldset.tsx && fail "specialWasteRequirements has no source text under this heading -- must not be rendered."

# --- Item 3: storage & security ---
grep -q "storageRiskAcknowledged" components/vendors/VendorStorageFieldset.tsx || fail "VendorStorageFieldset.tsx must render storageRiskAcknowledged."
grep -q "Security will be provided on the premises" components/vendors/VendorStorageFieldset.tsx \
  || fail "VendorStorageFieldset.tsx must render the storage/security advisory note verbatim."

# --- Item 4: vehicle registration labels ---
BOOTH_FILE="components/vendors/VendorBoothFieldset.tsx"
grep -q "Less than 1 ton Delivery Van registration Number" "$BOOTH_FILE" || fail "$BOOTH_FILE must use the verbatim source delivery-van label."
grep -q "Above 1 ton Truck registration number" "$BOOTH_FILE" || fail "$BOOTH_FILE must use the verbatim source truck label."
grep -q "'Delivery van registration number'" "$BOOTH_FILE" && fail "$BOOTH_FILE still has the old generic delivery-van label."
grep -q "'Truck registration number'" "$BOOTH_FILE" && fail "$BOOTH_FILE still has the old generic truck label."

# --- Item 5: VAT Vendor label ---
VAT_FILE="components/vendors/VendorBusinessAddressFieldset.tsx"
grep -q 'label="VAT Vendor"' "$VAT_FILE" || fail "$VAT_FILE must relabel the VAT radio \"VAT Vendor\" (verbatim source)."
grep -q 'label="VAT registered"' "$VAT_FILE" && fail "$VAT_FILE must not still say \"VAT registered\"."

# --- Item 6: booth allocation note -- RECONCILE, do not duplicate (SAOC lead, 2026-10-08) ---
# The existing Terms & Conditions clause is the one and only allocation note this feature
# ships. No second note is added to VendorBoothPositionFieldset.tsx.
grep -q "Final booth allocation will be determined by the Show Organising Committee" components/vendors/VendorTermsFieldset.tsx \
  || fail "VendorTermsFieldset.tsx must still render its existing Vendor Allocation clause (reconciled against the source, not removed)."
grep -q "Final booth allocation is made by the Show Organising Committee and is subject to availability and operational requirements" \
  components/vendors/VendorBoothPositionFieldset.tsx \
  && fail "VendorBoothPositionFieldset.tsx must NOT gain a second allocation note -- the SAOC lead's instruction is to reconcile the existing VendorTermsFieldset.tsx note, not duplicate it."

# --- Item 7: marketing permission wording ---
MARKETING_FILE="components/vendors/VendorMarketingFieldset.tsx"
grep -q "I hereby give the 2027 SAOC National Show permission to use my business name, logo, supplied photographs and promotional information for reasonable event-related marketing and publicity" \
  "$MARKETING_FILE" || fail "$MARKETING_FILE must use the verbatim full-permission source string."
grep -q "I do not grant permission for use beyond the vendor listing" "$MARKETING_FILE" \
  || fail "$MARKETING_FILE must use the verbatim listing-only source string."
grep -q "I give permission for SAOC to use my business name, logo, and photos for marketing purposes" "$MARKETING_FILE" \
  && fail "$MARKETING_FILE must not still have the old paraphrased permission string."

# --- Item 8: advisory notes ---
grep -q "comply with applicable South African electrical safety requirements" components/vendors/VendorBoothUtilitiesFieldset.tsx \
  || fail "VendorBoothUtilitiesFieldset.tsx must render the electrical safety advisory note verbatim."
grep -q "delivery and collection time slots will be allocated a week before the set-up day" "$BOOTH_FILE" \
  || fail "$BOOTH_FILE must render the delivery/collection slots advisory note verbatim."
grep -q "Booths spaces are confirmed only once this registration form has been received and the payment has reflected in the bank account" \
  components/vendors/VendorPaymentFieldset.tsx \
  || fail "VendorPaymentFieldset.tsx must render the booth-confirmation-on-payment note verbatim."

# --- Consumer wiring: INITIAL_STATE picks up the new keys, drops staffPerDay as a live-form
# input (this is the UI input-state layer, not the stored-document schema -- see item 9 below
# for why the email chain keeps staffPerDay instead of dropping it) ---
INITIAL_STATE_FILE="lib/vendor-register-form-initial-state.ts"
for key in staffCountSetupDay staffCountDay1 staffCountDay2 staffCountDay3 staffCountBreakdownDay wasteTypes wasteTypesOther storageRiskAcknowledged; do
  grep -q "$key" "$INITIAL_STATE_FILE" || fail "$INITIAL_STATE_FILE must initialise the new state key \"$key\"."
done
grep -q "staffPerDay" "$INITIAL_STATE_FILE" && fail "$INITIAL_STATE_FILE must drop staffPerDay from the live form's own input state -- no fieldset collects it any more."
grep -q "staffPerDay" lib/vendor-register-form-payload.ts && fail "lib/vendor-register-form-payload.ts's VendorRegisterFormState/buildVendorRegistrationPayload must drop staffPerDay from the live form's input/payload layer."

# --- Consumer wiring: the approval-confirmation email chain is ADDITIVE (SAOC lead,
# 2026-10-08: "staffPerDay stays and the per-day fields are additive") -- it must show the
# per-day breakdown AND keep the legacy staffPerDay field/line for pre-feature documents, not
# replace one with the other. ---
EMAIL_FILE="emails/VendorApprovalConfirmation.tsx"
CONFIRMATION_LIB="lib/vendor-approval-confirmation.ts"
REVIEW_ROUTE="app/api/admin/vendors/[id]/review/route.ts"
for f in staffPerDay staffCountSetupDay staffCountDay1 staffCountDay2 staffCountDay3 staffCountBreakdownDay; do
  grep -q "$f" "$EMAIL_FILE" || fail "$EMAIL_FILE must render $f (additive: staffPerDay is a kept fallback, the 5 staffCount* fields are new)."
  grep -q "$f" "$CONFIRMATION_LIB" || fail "$CONFIRMATION_LIB must pass $f through to the email (additive, not a replacement)."
  grep -q "$f" "$REVIEW_ROUTE" || fail "$REVIEW_ROUTE must pass $f through to sendVendorApprovalConfirmationEmail (additive, not a replacement)."
done

# --- No unexpected new file beyond the three specified fieldsets ---
UNEXPECTED=$(git status --porcelain components/vendors/ | grep '^??' \
  | grep -v 'VendorStaffPassesFieldset.tsx\|VendorStorageFieldset.tsx\|VendorWasteFieldset.tsx' || true)
if [ -n "$UNEXPECTED" ]; then
  fail $'unexpected new untracked file(s) in components/vendors/ beyond the three specified fieldsets:\n'"$UNEXPECTED"
fi

echo "PASS: F1 structural copy/structure deltas all present, old wrong strings gone, allocation note reconciled (not duplicated), staff-per-day consumer chain additively re-wired, no stray new file."

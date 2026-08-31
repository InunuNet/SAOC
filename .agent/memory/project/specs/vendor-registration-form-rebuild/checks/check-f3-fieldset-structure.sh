#!/usr/bin/env bash
# F3 (vendor-registration-form-rebuild) -- structural proof that VendorCategoryFieldset.tsx
# renders all 11 vendorCategory options (by value, matching the DOM-id convention
# vendor-register-vendorCategory-<value> that 4 already-shipped Playwright contracts depend on),
# the new gated fields by name, and that no unexpected new file lands in components/vendors/
# beyond what this feature is scoped to add.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FILE="components/vendors/VendorCategoryFieldset.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE does not exist." >&2
  exit 1
fi

# All 11 category option VALUES (not labels -- labels are free to match the source doc's
# wording, but the value is what the DOM id and the closed-union type are built from).
for value in plant-sales other-plant-sales rare-exotic-plants product-sales hardware fertilisers-growing-media books art pottery-ceramics food-retailer other; do
  if ! grep -q "value: '${value}'" "$FILE"; then
    echo "FAIL: $FILE must render a vendorCategory option with value '${value}'." >&2
    exit 1
  fi
done

for key in vendorCategoryOther sellsLivePlants livePlantTypes livePlantTypesOther plantsImportedForEvent importCountryOfOrigin citesListedSpecies foodHealthTradingDocumentation; do
  if ! grep -q "$key" "$FILE"; then
    echo "FAIL: $FILE must render the new field \"$key\"." >&2
    exit 1
  fi
done

# The 3 pre-existing food-retailer-gated fields must still be present, untouched, per the
# mission brief ("stay food-retailer-gated exactly as isFoodRetailer() already gates them
# today").
for key in phytosanitaryPermitNumber citesPermitNumber foodHandlingCertificateNumber foodItemList; do
  if ! grep -q "$key" "$FILE"; then
    echo "FAIL: $FILE must still render the pre-existing field \"$key\" (F3 must not remove it)." >&2
    exit 1
  fi
done

# Source 3.8 (food prepared/cooked on site) is explicitly F1's dedup call against Section 8's
# foodPreparationOnSite/foodCookingOnSite (F5's job) -- must NOT be reintroduced here.
if grep -qE "foodPreparationOnSite|foodCookingOnSite" "$FILE"; then
  echo "FAIL: $FILE must NOT render foodPreparationOnSite or foodCookingOnSite -- that is F5's Section 8 fieldset, not F3's (see F1's golden README dedup note)." >&2
  exit 1
fi

if ! grep -q "VendorCategoryFieldset" components/vendors/index.ts; then
  echo "FAIL: components/vendors/index.ts must still export VendorCategoryFieldset." >&2
  exit 1
fi

if ! grep -q "<VendorCategoryFieldset" components/vendors/VendorRegisterForm.tsx; then
  echo "FAIL: components/vendors/VendorRegisterForm.tsx must still mount <VendorCategoryFieldset ... />." >&2
  exit 1
fi

# No unexpected new file lands in components/vendors/ -- this feature rebuilds an existing
# fieldset, it does not need a new one (unlike F2's VendorEmergencyContactFieldset.tsx).
NEW_FILES=$(git status --porcelain components/vendors/ | grep '^??' || true)
if [ -n "$NEW_FILES" ]; then
  echo "FAIL: unexpected new untracked file(s) in components/vendors/ -- F3 rebuilds VendorCategoryFieldset.tsx in place, it does not introduce a new fieldset file:" >&2
  echo "$NEW_FILES" >&2
  exit 1
fi

echo "PASS: VendorCategoryFieldset.tsx renders all 11 vendorCategory option values, every new Section 3 field, the 3 pre-existing food-retailer-gated fields, no Section 8 fields, and no stray new file was added to components/vendors/."

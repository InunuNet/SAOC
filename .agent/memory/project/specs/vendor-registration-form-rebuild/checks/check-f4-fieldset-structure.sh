#!/usr/bin/env bash
# F4 (vendor-registration-form-rebuild) -- structural proof that VendorBoothFieldset.tsx renders
# the 4 renamed/new boothType option values (by value, NOT the old 'standard' value), every new
# Section 4/6 field by name, still renders the unchanged fields (tableCount, chairCount,
# staffPerDay, vehicleRegistrations, loadInSlot, loadOutSlot), and that no unexpected new file
# lands in components/vendors/ beyond what this feature is scoped to add.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FAIL=0
FILE="components/vendors/VendorBoothFieldset.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE does not exist." >&2
  exit 1
fi

# The 4 renamed/new boothType option VALUES.
for value in standard-in-row corner end-of-row no-preference; do
  if ! grep -q "value: '${value}'" "$FILE"; then
    echo "FAIL: $FILE must render a boothType option with value '${value}'." >&2
    FAIL=1
  fi
done

# The OLD value must be gone -- this is a rename, not a widening.
if grep -q "value: 'standard'" "$FILE" && ! grep -q "value: 'standard-in-row'" "$FILE"; then
  echo "FAIL: $FILE still renders the old boothType option value 'standard' without the renamed 'standard-in-row' -- the rename did not happen." >&2
  FAIL=1
fi
if grep -Eq "\{ value: 'standard', label:" "$FILE"; then
  echo "FAIL: $FILE still has a literal { value: 'standard', ... } option entry -- this feature must rename it to 'standard-in-row', not leave it alongside the new values." >&2
  FAIL=1
fi

# Every new Section 4/6 field must be rendered by name.
for key in boothPositionRequest adjacentBoothRequested adjacentBoothVendorName specialDisplayRequirements electricalOutletsRequired electricalEquipmentList electricalEquipmentContinuousOperation electricalEquipmentContinuousDetails waterIntendedUse wastewaterDrainageRequired wastewaterDrainageDetails; do
  if ! grep -q "$key" "$FILE"; then
    echo "FAIL: $FILE must render the new field \"$key\"." >&2
    FAIL=1
  fi
done

# The pre-existing, unchanged fields must still be present.
for key in boothCount tableCount chairCount powerRequired electricalLoad waterRequired staffPerDay vehicleRegistrations loadInSlot loadOutSlot; do
  if ! grep -q "$key" "$FILE"; then
    echo "FAIL: $FILE must still render the pre-existing, unchanged field \"$key\"." >&2
    FAIL=1
  fi
done

if ! grep -q "VendorBoothFieldset" components/vendors/index.ts; then
  echo "FAIL: components/vendors/index.ts must still export VendorBoothFieldset." >&2
  FAIL=1
fi

if ! grep -q "<VendorBoothFieldset" components/vendors/VendorRegisterForm.tsx; then
  echo "FAIL: components/vendors/VendorRegisterForm.tsx must still mount <VendorBoothFieldset ... />." >&2
  FAIL=1
fi

# No unexpected new file lands in components/vendors/ -- this feature rebuilds an existing
# fieldset, it does not need a new one.
NEW_FILES=$(git status --porcelain components/vendors/ | grep '^??' || true)
if [ -n "$NEW_FILES" ]; then
  echo "FAIL: unexpected new untracked file(s) in components/vendors/ -- F4 rebuilds VendorBoothFieldset.tsx in place, it does not introduce a new fieldset file:" >&2
  echo "$NEW_FILES" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo "STRUCTURAL CHECK FAILED -- see above." >&2
  exit 1
fi

echo "PASS: VendorBoothFieldset.tsx renders the renamed/new boothType option values (not the old 'standard' value), every new Section 4/6 field, every pre-existing unchanged field, and no stray new file was added to components/vendors/."

#!/usr/bin/env bash
# F2 (vendor-registration-form-rebuild) -- structural proof that the new Emergency Contact
# fieldset exists, reuses the existing VendorFormField primitive (no new leaf-input component is
# introduced), is exported from the barrel, and is actually mounted in VendorRegisterForm.tsx.
# Defeats: a new bespoke input component invented for this feature; a fieldset that exists but is
# never rendered; a fieldset missing the two required fields.
set -euo pipefail

FILE="components/vendors/VendorEmergencyContactFieldset.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE does not exist." >&2
  exit 1
fi

if ! grep -q "VendorFormField" "$FILE"; then
  echo "FAIL: $FILE must reuse the existing VendorFormField primitive." >&2
  exit 1
fi

if ! grep -q "emergencyContactName" "$FILE" || ! grep -q "emergencyContactCellPhone" "$FILE" || ! grep -q "emergencyContactRelationship" "$FILE"; then
  echo "FAIL: $FILE must render emergencyContactName, emergencyContactRelationship, and emergencyContactCellPhone." >&2
  exit 1
fi

LINE_COUNT=$(wc -l < "$FILE" | tr -d ' ')
if [ "$LINE_COUNT" -gt 150 ]; then
  echo "FAIL: $FILE is $LINE_COUNT lines, exceeds the project's 150-line component-size rule." >&2
  exit 1
fi

if ! grep -q "VendorEmergencyContactFieldset" components/vendors/index.ts; then
  echo "FAIL: components/vendors/index.ts must export VendorEmergencyContactFieldset." >&2
  exit 1
fi

if ! grep -q "<VendorEmergencyContactFieldset" components/vendors/VendorRegisterForm.tsx; then
  echo "FAIL: components/vendors/VendorRegisterForm.tsx must mount <VendorEmergencyContactFieldset ... />." >&2
  exit 1
fi

CONTACT_FILE="components/vendors/VendorContactFieldset.tsx"
for key in tradingNameSameAsBusiness businessEntityType vatRegistered countryOfBusinessRegistration postalAddressSameAsPhysical contactPosition alternativeContactNumber accountsContactName accountsContactEmail; do
  if ! grep -q "$key" "$CONTACT_FILE"; then
    echo "FAIL: $CONTACT_FILE must render the new field \"$key\"." >&2
    exit 1
  fi
done

# No new leaf primitive component introduced -- only the fieldset itself is new.
NEW_PRIMITIVES=$(git status --porcelain components/vendors/ | grep '^??' | grep -v 'VendorEmergencyContactFieldset.tsx' || true)
if [ -n "$NEW_PRIMITIVES" ]; then
  echo "FAIL: unexpected new untracked file(s) in components/vendors/ beyond VendorEmergencyContactFieldset.tsx:" >&2
  echo "$NEW_PRIMITIVES" >&2
  exit 1
fi

echo "PASS: VendorEmergencyContactFieldset exists, reuses VendorFormField, is exported and mounted; VendorContactFieldset renders every new Section 1 field; no stray new primitive was added."

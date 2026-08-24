#!/usr/bin/env bash
# A2 — proves the SAME file A1 found wires canManagePaymentSettings into the <AdminNav call from
# a real hasCapability(..., 'manage-payment-settings', ...) derivation in that file, not a
# hardcoded literal or an omitted prop.
set -euo pipefail

CANDIDATES=("app/admin/settings/page.tsx" "app/admin/settings/layout.tsx")
FOUND=""

for f in "${CANDIDATES[@]}"; do
  [ -f "$f" ] || continue
  if grep -q "<AdminNav" "$f"; then
    FOUND="$f"
    break
  fi
done

if [ -z "$FOUND" ]; then
  echo "FAIL: no candidate file renders <AdminNav — run check-chrome-structural.sh (A1) first"
  exit 1
fi

if ! grep -q "'manage-payment-settings'" "$FOUND"; then
  echo "FAIL: $FOUND does not reference the 'manage-payment-settings' capability string"
  exit 1
fi

if ! grep -q "canManagePaymentSettings" "$FOUND"; then
  echo "FAIL: $FOUND does not define/use canManagePaymentSettings"
  exit 1
fi

if grep -E "canManagePaymentSettings=\{(true|false)\}" "$FOUND" >/dev/null; then
  echo "FAIL: $FOUND passes canManagePaymentSettings as a hardcoded true/false literal instead of a hasCapability()-derived identifier"
  exit 1
fi

if ! grep -q "canManagePaymentSettings={canManagePaymentSettings}" "$FOUND"; then
  echo "FAIL: $FOUND's <AdminNav call does not pass canManagePaymentSettings={canManagePaymentSettings}"
  exit 1
fi

echo "PASS: $FOUND derives canManagePaymentSettings via hasCapability('manage-payment-settings') and passes it to <AdminNav"
exit 0

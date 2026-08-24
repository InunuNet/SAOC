#!/usr/bin/env bash
# A3 — components/admin/AdminNav.tsx: canManagePaymentSettings is a REQUIRED boolean prop (no
# `?`), buildLinks() takes it as a second param, and conditionally pushes exactly
# { id: 'settings', label: 'Settings', href: '/admin/settings' } when true.
set -euo pipefail

FILE="components/admin/AdminNav.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE does not exist"
  exit 1
fi

if grep -q "canManagePaymentSettings?:" "$FILE"; then
  echo "FAIL: $FILE declares canManagePaymentSettings as OPTIONAL (?:) — must be required"
  exit 1
fi

if ! grep -q "canManagePaymentSettings: boolean" "$FILE"; then
  echo "FAIL: $FILE's AdminNavProps does not declare canManagePaymentSettings: boolean"
  exit 1
fi

if ! grep -Eq "function buildLinks\(canReviewVendors: boolean, canManagePaymentSettings: boolean\)" "$FILE"; then
  echo "FAIL: $FILE's buildLinks() signature does not take canManagePaymentSettings as its second boolean param"
  exit 1
fi

if ! grep -q "id: 'settings'" "$FILE" \
  || ! grep -q "label: 'Settings'" "$FILE" \
  || ! grep -q "href: '/admin/settings'" "$FILE"; then
  echo "FAIL: $FILE's buildLinks() does not push { id: 'settings', label: 'Settings', href: '/admin/settings' }"
  exit 1
fi

if ! grep -q "buildLinks(canReviewVendors, canManagePaymentSettings)" "$FILE"; then
  echo "FAIL: $FILE's AdminNav component does not call buildLinks(canReviewVendors, canManagePaymentSettings)"
  exit 1
fi

echo "PASS: AdminNav.tsx declares the required canManagePaymentSettings prop and wires it through buildLinks() to a Settings link"
exit 0

#!/usr/bin/env bash
# A-STRUCT-01 — structural facts a grep can actually settle: the three provisioning scripts
# exist, import the Admin SDK (never the client SDK), and never log a secret value wholesale.
set -euo pipefail

FAIL=0

for f in scripts/admin-grant.ts scripts/admin-revoke.ts scripts/admin-list.ts; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f does not exist"
    FAIL=1
    continue
  fi

  if ! grep -q "firebase-admin/auth" "$f"; then
    echo "FAIL: $f does not import from firebase-admin/auth"
    FAIL=1
  fi

  if grep -q "from 'firebase/auth'" "$f"; then
    echo "FAIL: $f imports the CLIENT SDK ('firebase/auth') — must use firebase-admin/auth only"
    FAIL=1
  fi

  if grep -qE "console\.(log|info|warn|error)\(\s*process\.env\s*\)" "$f"; then
    echo "FAIL: $f logs process.env wholesale"
    FAIL=1
  fi

  if grep -qE "console\.(log|info|warn|error)\([^)]*FIREBASE_ADMIN_PRIVATE_KEY" "$f"; then
    echo "FAIL: $f logs FIREBASE_ADMIN_PRIVATE_KEY"
    FAIL=1
  fi

  if grep -qE "console\.(log|info|warn|error)\([^)]*ADMIN_EMAIL_ALLOWLIST" "$f"; then
    echo "FAIL: $f logs ADMIN_EMAIL_ALLOWLIST"
    FAIL=1
  fi
done

if grep -qE "auth\.deleteUser" scripts/admin-grant.ts scripts/admin-revoke.ts 2>/dev/null; then
  echo "FAIL: grant or revoke script calls auth.deleteUser — revoke must clear admin capability, not delete the account (see golden spec)"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: A-STRUCT-01 — provisioning scripts exist, use the Admin SDK only, and never log a secret wholesale"
fi

exit "$FAIL"

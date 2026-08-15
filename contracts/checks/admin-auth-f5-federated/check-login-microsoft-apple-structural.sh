#!/usr/bin/env bash
# A-STRUCT-01 (F5) — app/admin/login/page.tsx offers Microsoft (OAuthProvider('microsoft.com'))
# and Apple (OAuthProvider('apple.com')) sign-in paths, both funnelling through the SAME
# POST /api/admin/session call, exactly like F4's Google path — reusing the provider-agnostic
# plumbing rather than a parallel implementation per provider. Also requires the Apple path to
# request the 'email' scope explicitly — belt and braces: Firebase already auto-requests it
# under the default "One account per email address" setting this project keeps (F4's revised
# decision — see contracts/golden/admin-auth-f5-federated/README.md "Apple's email scope"), but
# stating it in code is safer than relying on an implicit default. Currently RED — none of this
# exists in the login page yet.
set -euo pipefail

FILE="app/admin/login/page.tsx"
FAIL=0

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE does not exist"
  exit 1
fi

if ! grep -q "OAuthProvider('microsoft.com')" "$FILE" && ! grep -q '"microsoft.com"' "$FILE"; then
  echo "FAIL: $FILE does not construct a microsoft.com OAuthProvider"
  FAIL=1
fi

if ! grep -q "OAuthProvider('apple.com')" "$FILE" && ! grep -q '"apple.com"' "$FILE"; then
  echo "FAIL: $FILE does not construct an apple.com OAuthProvider"
  FAIL=1
fi

if ! grep -q "addScope('email')" "$FILE" && ! grep -q 'addScope("email")' "$FILE"; then
  echo "FAIL: $FILE does not explicitly request the 'email' scope (defensive explicitness — see check header comment)"
  FAIL=1
fi

SESSION_POST_COUNT=$(grep -c "/api/admin/session" "$FILE" || true)
if [ "$SESSION_POST_COUNT" -eq 0 ]; then
  echo "FAIL: $FILE no longer POSTs to /api/admin/session at all"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: A-STRUCT-01 (F5) — Microsoft and Apple sign-in paths present, funnel through the existing session route, Apple requests email scope"
fi

exit "$FAIL"

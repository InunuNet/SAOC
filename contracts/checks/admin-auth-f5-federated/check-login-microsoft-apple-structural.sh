#!/usr/bin/env bash
# A-STRUCT-01 (F5) — app/admin/login/page.tsx offers Microsoft (OAuthProvider('microsoft.com'))
# and Apple (OAuthProvider('apple.com')) sign-in paths, both funnelling through the SAME
# POST /api/admin/session call, exactly like F4's Google path — reusing the provider-agnostic
# plumbing rather than a parallel implementation per provider. Also requires the Apple path to
# request the 'email' scope explicitly — belt and braces: Firebase already auto-requests it
# under the default "One account per email address" setting this project keeps (F4's revised
# decision — see contracts/golden/admin-auth-f5-federated/README.md "Apple's email scope"), but
# stating it in code is safer than relying on an implicit default.
#
# Hardened 2026-08-17 (orchestrator ruling, non-blocking @qa finding): the original four
# context-free greps would have stayed green if `addScope('email')` were moved onto the
# Google or Microsoft branch (still present *somewhere* in the file), or if the session-route
# assertion were satisfied by a comment mentioning the URL rather than a real fetch call. Now:
#   - `addScope('email')` must appear in a line window immediately AFTER the
#     `OAuthProvider('apple.com')` match, not merely anywhere in the file — anchors it to the
#     Apple branch specifically without needing a full AST parse.
#   - the session-route assertion requires an actual `fetch('/api/admin/session'` (or
#     double-quoted) call, not just the substring `/api/admin/session` appearing anywhere
#     (a comment would no longer satisfy it).
set -euo pipefail

FILE="app/admin/login/page.tsx"
FAIL=0
# How many lines after the OAuthProvider('apple.com') match to search for addScope('email').
APPLE_WINDOW=8

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE does not exist"
  exit 1
fi

if ! grep -q "OAuthProvider('microsoft.com')" "$FILE" && ! grep -q '"microsoft.com"' "$FILE"; then
  echo "FAIL: $FILE does not construct a microsoft.com OAuthProvider"
  FAIL=1
fi

APPLE_LINE=$(grep -nE "OAuthProvider\(['\"]apple\.com['\"]\)" "$FILE" | head -1 | cut -d: -f1 || true)
if [ -z "$APPLE_LINE" ]; then
  echo "FAIL: $FILE does not construct an apple.com OAuthProvider"
  FAIL=1
else
  APPLE_SCOPE_WINDOW_END=$((APPLE_LINE + APPLE_WINDOW))
  APPLE_SCOPE_FOUND=$(sed -n "${APPLE_LINE},${APPLE_SCOPE_WINDOW_END}p" "$FILE" \
    | grep -E "addScope\(['\"]email['\"]\)" || true)
  if [ -z "$APPLE_SCOPE_FOUND" ]; then
    echo "FAIL: $FILE does not call addScope('email') within $APPLE_WINDOW lines of the" \
      "apple.com OAuthProvider construction — the 'email' scope must be requested on the" \
      "Apple branch specifically, not merely anywhere in the file"
    FAIL=1
  fi
fi

if ! grep -qE "fetch\(['\"]/api/admin/session['\"]" "$FILE"; then
  echo "FAIL: $FILE does not make a real fetch('/api/admin/session', ...) call — a comment" \
    "or string mentioning the route is not sufficient"
  FAIL=1
fi

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: A-STRUCT-01 (F5) — Microsoft and Apple sign-in paths present, funnel through the existing session route, Apple requests email scope"
fi

exit "$FAIL"

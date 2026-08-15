#!/usr/bin/env bash
# A-DOCS-01 (F5) — docs/admin-access.md documents the F5 additions: Microsoft Entra app
# registration + tenant decision, Apple's paid-Developer-Program requirement and Services
# ID/Key/Team ID/Return URL, and the Apple private-email-relay interaction with the
# email-based allowlist. Documentation-completeness only — console/portal registration is a
# human step this contract cannot perform or verify live, exactly as F4's account-linking
# console step and F3's self-signup console step are documented, not scripted.
set -euo pipefail

DOC="docs/admin-access.md"
FAIL=0

if [ ! -f "$DOC" ]; then
  echo "FAIL: $DOC does not exist"
  exit 1
fi

for header in \
  "## Microsoft sign-in" \
  "## Apple sign-in"; do
  if ! grep -qF "$header" "$DOC"; then
    echo "FAIL: $DOC is missing required section header: $header"
    FAIL=1
  fi
done

for text in \
  "Entra" \
  "Team ID" \
  "Services ID" \
  "Apple Developer Program" \
  "privaterelay.appleid.com" \
  "__/auth/handler"; do
  if ! grep -qF -- "$text" "$DOC"; then
    echo "FAIL: $DOC does not mention required text: $text"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: A-DOCS-01 (F5) — docs/admin-access.md documents Microsoft and Apple prerequisites, including the relay-email trap"
fi

exit "$FAIL"

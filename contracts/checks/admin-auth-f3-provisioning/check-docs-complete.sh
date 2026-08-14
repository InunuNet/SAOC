#!/usr/bin/env bash
# A-DOCS-01 — docs/admin-access.md contains the required F3 additions. A documentation-
# completeness check: it proves the required text is PRESENT, not that any console-only step
# (disabling self-signup) was actually performed — see docs-admin-access-additions.golden.md.
set -euo pipefail

DOC="docs/admin-access.md"
FAIL=0

if [ ! -f "$DOC" ]; then
  echo "FAIL: $DOC does not exist"
  exit 1
fi

for header in \
  "## Who may hold admin" \
  "## Granting admin access" \
  "## Revoking admin access" \
  "## Verifying grant or revoke actually took effect" \
  "## Disabling self-signup"; do
  if ! grep -qF "$header" "$DOC"; then
    echo "FAIL: $DOC is missing required section header: $header"
    FAIL=1
  fi
done

for text in \
  "scripts/admin-grant.ts" \
  "scripts/admin-revoke.ts" \
  "revokeRefreshTokens" \
  "console-only"; do
  if ! grep -qF "$text" "$DOC"; then
    echo "FAIL: $DOC does not mention required text: $text"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: A-DOCS-01 — docs/admin-access.md contains all required F3 sections and references"
fi

exit "$FAIL"

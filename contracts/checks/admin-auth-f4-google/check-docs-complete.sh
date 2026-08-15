#!/usr/bin/env bash
# A-DOCS-01 (F4) — docs/admin-access.md documents the F4 additions: the claim-before-allowlist
# ordering rule (with rationale), the squatter-shape warning behaviour, and Google console
# setup steps. A documentation-completeness check: proves the text is PRESENT, not that the
# ordering rule is actually followed by every operator — see README.md "The residual risk" and
# F3's own precedent ("A green contract gate does NOT prove this console step was performed").
set -euo pipefail

DOC="docs/admin-access.md"
FAIL=0

if [ ! -f "$DOC" ]; then
  echo "FAIL: $DOC does not exist"
  exit 1
fi

for header in \
  "## Claim before allowlist" \
  "## Google sign-in"; do
  if ! grep -qF "$header" "$DOC"; then
    echo "FAIL: $DOC is missing required section header: $header"
    FAIL=1
  fi
done

for text in \
  "before it is ever added" \
  "account linking" \
  "does NOT prove" \
  "GoogleAuthProvider" \
  "never verified"; do
  if ! grep -qF -- "$text" "$DOC"; then
    echo "FAIL: $DOC does not mention required text: $text"
    FAIL=1
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: A-DOCS-01 (F4) — docs/admin-access.md documents the claim-first ordering rule and Google setup"
fi

exit "$FAIL"

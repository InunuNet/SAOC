#!/usr/bin/env bash
# A-DOCS-01 — docs/admin-access.md must be updated, not just appended to. Its existing
# "Disabling self-signup (defence in depth, console-only)" section documents the OLD,
# rejected console-toggle approach ("Navigate to the Identity Platform Settings page...
# console.cloud.google.com/customer-identity/settings", "auth/admin-restricted-operation") —
# that section must be replaced with the shipped functions.auth.user().onCreate() mechanism,
# or it actively misleads the next operator into believing self-signup still requires a manual
# console step this contract already closed.
set -euo pipefail

DOC=docs/admin-access.md
FAIL=0

if [ ! -f "$DOC" ]; then
  echo "FAIL: $DOC does not exist"
  exit 1
fi

# The stale console-toggle instructions must be gone.
if grep -q 'customer-identity/settings' "$DOC"; then
  echo "FAIL: $DOC still contains the old Identity Platform console-toggle instructions (customer-identity/settings link) — must be replaced, this approach was rejected"
  FAIL=1
fi

if grep -q 'auth/admin-restricted-operation' "$DOC"; then
  echo "FAIL: $DOC still documents auth/admin-restricted-operation as the expected error — that signal is Identity-Platform-only and this feature deliberately does not use it"
  FAIL=1
fi

# The new mechanism must be documented.
REQUIRED_PHRASES=(
  "onCreate"
  "grace window"
)
for phrase in "${REQUIRED_PHRASES[@]}"; do
  if ! grep -qi "$phrase" "$DOC"; then
    echo "FAIL: $DOC does not mention \"$phrase\" — required to document the shipped self-signup guard mechanism"
    FAIL=1
  fi
done

# Must NOT claim dependency on ADMIN_EMAIL_ALLOWLIST for this specific mechanism.
if grep -qi 'onCreate' "$DOC" && grep -B5 -A15 -i 'onCreate' "$DOC" | grep -qi 'ADMIN_EMAIL_ALLOWLIST'; then
  echo "FAIL: $DOC's onCreate documentation references ADMIN_EMAIL_ALLOWLIST — this mechanism must be documented as independent of the allowlist (see README.md section 2)"
  FAIL=1
fi

# Must document the residual gap and the admin-grant.ts timing requirement.
if ! grep -qi 'residual' "$DOC" && ! grep -qi 'zero capability' "$DOC"; then
  echo "FAIL: $DOC does not document the residual gap (valid token during grace window, zero capability without the admin claim)"
  FAIL=1
fi

if [ "$FAIL" -eq 1 ]; then
  exit 1
fi
echo "PASS: docs/admin-access.md documents the shipped onCreate mechanism and the stale console-toggle section is gone"

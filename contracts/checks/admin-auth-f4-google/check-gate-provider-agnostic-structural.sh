#!/usr/bin/env bash
# A-STRUCT-01 (F4) — regression guard, must stay green. lib/admin-auth.ts and
# app/api/admin/session/route.ts decide admission purely from { admin claim, email_verified,
# ADMIN_EMAIL_ALLOWLIST } — the same three inputs regardless of which sign-in provider produced
# the token. Proves no provider-conditional branch was added anywhere in the decision path
# (no "google.com" / "microsoft.com" / "apple.com" / "sign_in_provider" / "firebase.identities"
# special-casing). This is exactly the structural fact that lets F1/F2's A-STATE-01/A-ALLOW-01
# — which already prove the gate correct for arbitrary claim/verified/allowlist combinations —
# stand in for "a Google/Microsoft/Apple identity gets refused/admitted on the same terms",
# without needing to drive a real OAuth consent flow in a check (which no tooling in this repo
# can do headlessly). See README.md "Why no new behavioural gate check for F4/F5".
#
# A grep is appropriate here — this is a structural fact about which literals appear in one
# file, exactly the class of fact contract-admin-auth-hardening.yaml's own A-STRUCT-01 and
# contract-admin-auth-f3-provisioning.yaml's A-STRUCT-01 already settle by grep, not a security
# decision standing in for a real test.
set -euo pipefail

FAIL=0
FORBIDDEN='google\.com|microsoft\.com|apple\.com|sign_in_provider|firebase\.identities|providerId|providerData'

for f in lib/admin-auth.ts app/api/admin/session/route.ts; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f does not exist"
    FAIL=1
    continue
  fi
  if grep -qiE "$FORBIDDEN" "$f"; then
    echo "FAIL: $f contains provider-specific logic ($(grep -inE "$FORBIDDEN" "$f" | head -3)) — the admission decision must stay provider-agnostic"
    FAIL=1
  fi
done

# Self-test: the residue pattern must actually fire on a known bad shape, or this check proves
# nothing (same discipline as F1/F2's A-STRUCT-01 self-test).
TMP=$(mktemp)
echo "if (decoded.firebase.sign_in_provider === 'google.com') { return true; }" > "$TMP"
if ! grep -qiE "$FORBIDDEN" "$TMP"; then
  echo "FAIL: self-test — the forbidden-pattern grep did not fire on a known provider-specific shape; this check cannot be trusted"
  FAIL=1
fi
rm -f "$TMP"

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: A-STRUCT-01 (F4) — the admission decision remains provider-agnostic"
fi

exit "$FAIL"

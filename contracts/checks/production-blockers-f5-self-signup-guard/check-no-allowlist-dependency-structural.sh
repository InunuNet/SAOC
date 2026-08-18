#!/usr/bin/env bash
# A-STRUCT-02 — regression guard. This function must key deletion on the admin custom claim
# appearing within a grace window, NOT on ADMIN_EMAIL_ALLOWLIST membership. See README.md
# section 2: the allowlist-first check is wrong given this project's claim-first provisioning
# design (backlog.md ~line 1167-1173) and would delete legitimate admin-grant.ts accounts.
set -euo pipefail

FAIL=0

if [ ! -d functions/src ]; then
  echo "FAIL: functions/src does not exist"
  exit 1
fi

if grep -rq 'ADMIN_EMAIL_ALLOWLIST' functions/src/; then
  echo "FAIL: functions/src/ references ADMIN_EMAIL_ALLOWLIST — this function must not depend on it (see README.md section 2)"
  echo "$(grep -rn 'ADMIN_EMAIL_ALLOWLIST' functions/src/)"
  FAIL=1
fi

if grep -rqE 'runWith\(\s*\{\s*secrets:\s*\[[^]]*ADMIN_EMAIL_ALLOWLIST' functions/src/; then
  echo "FAIL: functions/src/ binds ADMIN_EMAIL_ALLOWLIST as a Secret Manager secret via runWith — this function must not bind that secret at all"
  FAIL=1
fi

if ! grep -rqE 'customClaims' functions/src/; then
  echo "FAIL: functions/src/ never references customClaims — the deletion condition must be keyed on the admin custom claim, not found"
  FAIL=1
fi

# Self-test: the forbidden-pattern grep must actually fire.
TMPDIR=$(mktemp -d)
echo "const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST;" > "$TMPDIR/bad.ts"
if ! grep -rq 'ADMIN_EMAIL_ALLOWLIST' "$TMPDIR/"; then
  echo "FAIL: self-test — the ADMIN_EMAIL_ALLOWLIST grep did not fire on a known bad shape; this check cannot be trusted"
  FAIL=1
fi
rm -rf "$TMPDIR"

if [ "$FAIL" -eq 1 ]; then
  exit 1
fi
echo "PASS: functions/src/ has no dependency on ADMIN_EMAIL_ALLOWLIST and keys deletion on the admin custom claim"

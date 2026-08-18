#!/usr/bin/env bash
# A-STRUCT-01 — functions/ is a real Cloud Functions package wired into firebase.json, and no
# GCIP-upgrade API (Identity Platform / Blocking Functions) appears anywhere in it. This is a
# hard boundary set by Brad, not a preference — see README.md.
set -euo pipefail

FAIL=0

if [ ! -f functions/package.json ]; then
  echo "FAIL: functions/package.json does not exist"
  exit 1
fi

for dep in firebase-functions firebase-admin; do
  if ! grep -q "\"$dep\"" functions/package.json; then
    echo "FAIL: functions/package.json does not declare $dep as a dependency"
    FAIL=1
  fi
done

if ! grep -q '"node"[[:space:]]*:[[:space:]]*"22"' functions/package.json; then
  echo "FAIL: functions/package.json engines.node is not pinned to \"22\" (must match apphosting.yaml's runtime: nodejs22)"
  FAIL=1
fi

if [ ! -f functions/src/index.ts ]; then
  echo "FAIL: functions/src/index.ts does not exist"
  exit 1
fi

if ! grep -qE 'functions\.auth\.user\(\)\.onCreate\(' functions/src/index.ts; then
  echo "FAIL: functions/src/index.ts does not build a trigger from functions.auth.user().onCreate()"
  FAIL=1
fi

if [ ! -f firebase.json ]; then
  echo "FAIL: firebase.json does not exist"
  exit 1
fi

if ! grep -q '"functions"' firebase.json; then
  echo "FAIL: firebase.json has no top-level \"functions\" entry"
  FAIL=1
fi

if ! grep -q '"source"[[:space:]]*:[[:space:]]*"functions"' firebase.json; then
  echo "FAIL: firebase.json's functions entry does not point source at \"functions\""
  FAIL=1
fi

FORBIDDEN='beforeCreate|beforeSignIn|identityplatform|IdentityPlatform|Identity Platform|blocking.?function|BlockingFunction'
for f in $(find functions/src firebase.json -type f 2>/dev/null); do
  if grep -qiE "$FORBIDDEN" "$f"; then
    echo "FAIL: $f references a GCIP-upgrade API/concept ($(grep -inE "$FORBIDDEN" "$f" | head -3)) — hard boundary, not allowed anywhere in this feature"
    FAIL=1
  fi
done

# Self-test: the forbidden-pattern grep must actually fire on a known bad shape.
TMP=$(mktemp)
echo "exports.guard = functions.auth.user().beforeCreate((user) => { return user; });" > "$TMP"
if ! grep -qiE "$FORBIDDEN" "$TMP"; then
  echo "FAIL: self-test — the GCIP-forbidden-pattern grep did not fire on a known beforeCreate shape; this check cannot be trusted"
  FAIL=1
fi
rm -f "$TMP"

if [ "$FAIL" -eq 1 ]; then
  exit 1
fi
echo "PASS: functions/ deploy topology exists, is wired into firebase.json, and contains no GCIP-upgrade API"

#!/usr/bin/env bash
# Golden test: bump_version.sh increments PATCH and dual-writes.
# PASS = exit 0, FAIL = exit 1.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT" || { echo "FAIL: cannot cd to repo root"; exit 1; }

SCRIPT="execution/bump_version.sh"
V_CANON=".agent/version"
V_TPL="template/.agent/version"

[ -x "$SCRIPT" ] || { echo "FAIL: $SCRIPT not executable"; exit 1; }
[ -f "$V_CANON" ] || { echo "FAIL: $V_CANON missing"; exit 1; }
[ -f "$V_TPL" ] || { echo "FAIL: $V_TPL missing"; exit 1; }

BACKUP_CANON="/tmp/athanor_version_canon.bak.$$"
BACKUP_TPL="/tmp/athanor_version_tpl.bak.$$"
cp "$V_CANON" "$BACKUP_CANON"
cp "$V_TPL"   "$BACKUP_TPL"

restore() {
  cp "$BACKUP_CANON" "$V_CANON" 2>/dev/null || true
  cp "$BACKUP_TPL"   "$V_TPL"   2>/dev/null || true
  rm -f "$BACKUP_CANON" "$BACKUP_TPL"
}
trap restore EXIT

OLD="$(cat "$V_CANON" | tr -d '[:space:]')"
echo "$OLD" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "FAIL: pre-state non-semver: $OLD"; exit 1; }

OLD_MAJOR="$(echo "$OLD" | cut -d. -f1)"
OLD_MINOR="$(echo "$OLD" | cut -d. -f2)"
OLD_PATCH="$(echo "$OLD" | cut -d. -f3)"
EXPECTED_NEW="${OLD_MAJOR}.${OLD_MINOR}.$((OLD_PATCH + 1))"

bash "$SCRIPT" >/tmp/bump_out.$$ 2>&1
RC=$?
if [ "$RC" -ne 0 ]; then
  echo "FAIL: script exited $RC"
  cat /tmp/bump_out.$$
  rm -f /tmp/bump_out.$$
  exit 1
fi
rm -f /tmp/bump_out.$$

NEW_CANON="$(cat "$V_CANON" | tr -d '[:space:]')"
NEW_TPL="$(cat "$V_TPL" | tr -d '[:space:]')"

if [ "$NEW_CANON" != "$EXPECTED_NEW" ]; then
  echo "FAIL: canonical expected=$EXPECTED_NEW got=$NEW_CANON"
  exit 1
fi
if [ "$NEW_TPL" != "$EXPECTED_NEW" ]; then
  echo "FAIL: template expected=$EXPECTED_NEW got=$NEW_TPL"
  exit 1
fi
if [ "$NEW_CANON" != "$NEW_TPL" ]; then
  echo "FAIL: canonical=$NEW_CANON != template=$NEW_TPL"
  exit 1
fi

echo "PASS: $OLD -> $NEW_CANON (both files in sync)"
exit 0

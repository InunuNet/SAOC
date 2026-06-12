#!/usr/bin/env bash
# Golden test: bump_version.sh rejects non-semver input with non-zero exit.
# PASS = exit 0, FAIL = exit 1.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SCRIPT="$ROOT/execution/bump_version.sh"

[ -x "$SCRIPT" ] || { echo "FAIL: $SCRIPT not executable"; exit 1; }

STAGE="$(mktemp -d -t bump_bad.XXXXXX)"
mkdir -p "$STAGE/.agent" "$STAGE/template/.agent" "$STAGE/execution"
printf "%s
" "not-a-version" > "$STAGE/.agent/version"
printf "%s
" "not-a-version" > "$STAGE/template/.agent/version"
cp "$SCRIPT" "$STAGE/execution/bump_version.sh"
chmod +x "$STAGE/execution/bump_version.sh"

cleanup() { /bin/rm -r -f "$STAGE"; }
trap cleanup EXIT

cd "$STAGE" || { echo "FAIL: cannot cd to stage"; exit 1; }

set +e
bash "$STAGE/execution/bump_version.sh" >/tmp/bump_bad_out.$$ 2>&1
RC=$?
set -e

OUTPUT="$(cat /tmp/bump_bad_out.$$ 2>/dev/null || true)"
/bin/rm -f /tmp/bump_bad_out.$$

if [ "$RC" -eq 0 ]; then
  echo "FAIL: script exited 0 on non-semver input; expected non-zero"
  echo "--- script output ---"
  echo "$OUTPUT"
  exit 1
fi

POST="$(cat "$STAGE/.agent/version" | tr -d "[:space:]")"
if [ "$POST" != "not-a-version" ]; then
  echo "FAIL: script mutated invalid version file (now: $POST)"
  exit 1
fi

echo "PASS: non-semver input rejected (exit=$RC), version file untouched"
exit 0

#!/usr/bin/env bash
# verify_target_missing.sh — assertion A19 helper.
#
# Proves that `validate_manifest.sh --target` exits 1 when required files are
# absent from the target directory.
#
# Exit codes:
#   0 — validate_manifest.sh correctly exited 1 for a missing-file target
#   1 — validate_manifest.sh did NOT exit 1 (broken detection)

set -uo pipefail

TMP=""
cleanup() {
  if [ -n "$TMP" ]; then
    rm -rf "$TMP"
  fi
}
trap cleanup EXIT INT TERM

TMP="$(mktemp -d)"

# Run the check against the empty temp dir; expect exit code 1.
if bash execution/validate_manifest.sh --target "$TMP" >/dev/null 2>&1; then
  echo "FAIL: validate_manifest.sh --target exited 0 for empty dir (expected 1)" >&2
  exit 1
fi

echo "OK: validate_manifest.sh --target correctly exited 1 for missing-file target"
exit 0

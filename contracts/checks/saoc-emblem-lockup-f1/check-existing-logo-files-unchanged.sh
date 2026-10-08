#!/usr/bin/env bash
# A4 — the pre-existing saoc-logo-*.png files are never overwritten by the
# generator. Guards the "trivially revertible" requirement: reverting this
# feature's diff + deleting the two new files must be a full, clean revert.
set -euo pipefail

BASELINE=".agent/memory/project/specs/saoc-emblem-lockup/goldens/fixtures/pre-existing-logo-checksums.txt"

if [ ! -f "$BASELINE" ]; then
  echo "missing baseline: $BASELINE"
  exit 1
fi

if ! sha256sum -c "$BASELINE" --quiet; then
  echo "one or more pre-existing logo files changed since the baseline was recorded"
  exit 1
fi

echo "OK: all pre-existing saoc-logo-*.png files unchanged"

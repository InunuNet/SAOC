#!/usr/bin/env bash
# SEC-03 route auth matrix. Runs route-matrix.mjs under the Firebase Auth emulator only
# (demo- project, no real credentials, nothing written to Sanity or the live project).
set -euo pipefail

cd "$(dirname "$0")/../../.."

if ! command -v firebase >/dev/null 2>&1; then
  echo "FAIL: firebase-tools is not on PATH, required for the emulator-based check"
  exit 1
fi

firebase emulators:exec \
  --project demo-saoc-webapp \
  --only auth \
  "node --import tsx contracts/checks/sec-03-signup-gate/route-matrix.mjs"

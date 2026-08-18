#!/usr/bin/env bash
# A-BEHAV-01 — runs negative-path.mjs under the Firebase Auth + Functions emulator. Never
# touches the real saoc-webapp project (demo- project ID, no real credentials involved).
set -euo pipefail

cd "$(dirname "$0")/../../.."

if ! command -v firebase >/dev/null 2>&1; then
  echo "FAIL: firebase-tools is not on PATH — required to run the emulator-based behavioural check"
  exit 1
fi

if [ ! -d functions ]; then
  echo "FAIL: functions/ does not exist — nothing to test yet (expected RED until @dev implements A-STRUCT-01)"
  exit 1
fi

firebase emulators:exec \
  --project demo-saoc-webapp \
  --only auth,functions \
  "node contracts/checks/production-blockers-f5-self-signup-guard/negative-path.mjs"

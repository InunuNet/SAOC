#!/usr/bin/env bash
# A4 — TypeScript compiles cleanly after the className change.
set -euo pipefail
npx tsc --noEmit -p tsconfig.json

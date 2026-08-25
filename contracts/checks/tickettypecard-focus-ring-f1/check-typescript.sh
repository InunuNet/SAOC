#!/usr/bin/env bash
# A3 — TypeScript compiles cleanly after the className change.
set -euo pipefail
npx tsc --noEmit -p tsconfig.json

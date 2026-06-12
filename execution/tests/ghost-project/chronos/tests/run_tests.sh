#!/usr/bin/env bash
# Chronos test runner — reports PASS N/12 or FAIL N/12
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$SCRIPT_DIR/test_chronos.py"
exit $?

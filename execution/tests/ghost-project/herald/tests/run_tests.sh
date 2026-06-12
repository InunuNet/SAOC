#!/usr/bin/env bash
# Herald test runner — reports PASS N/10 or FAIL N/10
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERALD_DIR="$(dirname "$SCRIPT_DIR")"

cd "$HERALD_DIR"

python3 tests/test_herald.py
EXIT_CODE=$?
exit $EXIT_CODE

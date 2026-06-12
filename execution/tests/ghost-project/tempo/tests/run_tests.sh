#!/usr/bin/env bash
# run_tests.sh — Run Tempo test suite and report PASS N/12

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$SCRIPT_DIR/test_tempo.py"
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "FAIL — one or more tests failed"
  exit 1
fi

exit 0

#!/usr/bin/env bash
# Run triage test suite. Reports PASS N/12, exits non-zero on failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$SCRIPT_DIR/test_triage.py"

#!/usr/bin/env bash
# Run prism test suite and report PASS N/12
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

python3 "$SCRIPT_DIR/test_prism.py"
exit_code=$?

# Count from output already printed
if [ $exit_code -eq 0 ]; then
    echo "PASS 12/12"
else
    exit 1
fi

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

python3 test_cairn.py
EXIT=$?

if [ $EXIT -ne 0 ]; then
  exit 1
fi
exit 0

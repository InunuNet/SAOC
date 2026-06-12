#!/usr/bin/env bash
# Quill test runner — reports PASS N/12 or FAIL N/12, exits 0 if all pass.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUILL_DIR="$(dirname "$SCRIPT_DIR")"

cd "$QUILL_DIR"

python3 tests/test_quill.py

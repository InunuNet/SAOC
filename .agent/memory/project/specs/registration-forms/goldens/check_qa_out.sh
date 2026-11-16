#!/usr/bin/env bash
# Verifies a saved codex_qa output: last non-empty line must be PASS. exit 0 PASS, 1 FAIL, 2 usage.
set -u
[ $# -eq 1 ] && [ -f "$1" ] || { echo "usage: check_qa_out.sh <qa.out>" >&2; exit 2; }
last=$(grep -v '^[[:space:]]*$' "$1" | tail -n 1 | tr -d '[:space:]')
[ "$last" = "PASS" ] && exit 0
echo "last line is not PASS: $last" >&2
exit 1

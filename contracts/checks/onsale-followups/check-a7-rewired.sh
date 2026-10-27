#!/bin/sh
# A5 -- ticket-onsale-predicate A7 calls the fail-closed helper and no longer carries the negated pipeline.
set -u
FILE=.agent/memory/project/specs/ticket-onsale-predicate/contract-f1.yaml
BLOCK=$(sed -n '/^    - id: A7$/,/^      timeout_seconds:/p' "$FILE")
[ -n "$BLOCK" ] || { echo "FAIL A7 block not found"; exit 1; }
CMD=$(printf '%s\n' "$BLOCK" | grep '^      command:') || { echo "FAIL A7 has no command"; exit 1; }
case "$CMD" in
  *check-national-show-not-prerendered-admin.py*) ;;
  *) echo "FAIL A7 does not call the helper: $CMD"; exit 1 ;;
esac
case "$CMD" in
  *"! "*|*"| grep"*|*"sed -n"*) echo "FAIL A7 still carries the negated pipeline: $CMD"; exit 1 ;;
esac
echo "PASS A5 A7 calls the fail-closed helper"

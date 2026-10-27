#!/bin/sh
# A5 -- ticket-onsale-predicate A7 is EXACTLY the fail-closed helper invocation. Exact string
# equality closes every fail-open shape (`|| true`, `;`, `&&`, pipes, negation, extra args,
# quoting tricks, a continuation line, a duplicate A7 or a second command).
set -u
FILE=.agent/memory/project/specs/ticket-onsale-predicate/contract-f1.yaml
HELPER=contracts/checks/onsale-followups/check-national-show-not-prerendered-admin.py
WANT="      command: python3 $HELPER ."
test -f "$HELPER" || { echo "FAIL helper missing: $HELPER"; exit 1; }
[ "$(grep -c '^    - id: A7$' "$FILE")" = 1 ] || { echo "FAIL A7 id count is not exactly 1"; exit 1; }
BLOCK=$(sed -n '/^    - id: A7$/,/^    - id: /p' "$FILE" | sed '$d')
[ -n "$BLOCK" ] || { echo "FAIL A7 block not found"; exit 1; }
[ "$(printf '%s\n' "$BLOCK" | grep -c 'command:')" = 1 ] || { echo "FAIL A7 block does not hold exactly one command"; exit 1; }
CMD=$(printf '%s\n' "$BLOCK" | grep '^      command:') || { echo "FAIL A7 has no command"; exit 1; }
[ "$CMD" = "$WANT" ] || { echo "FAIL A7 command is not exactly the helper invocation: $CMD"; exit 1; }
# The line after the command must be the next key, never a YAML continuation of the command.
NEXT=$(printf '%s\n' "$BLOCK" | grep -A1 '^      command:' | sed -n 2p)
case "$NEXT" in
  "      timeout_seconds:"*) ;;
  *) echo "FAIL A7 command is followed by '$NEXT', not timeout_seconds"; exit 1 ;;
esac
echo "PASS A5 A7 is exactly the fail-closed helper invocation"

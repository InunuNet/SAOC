#!/usr/bin/env bash
# A2 — regression guard: the full 4-token focus-visible ring string appears
# exactly 3 times in the file (2 existing stepper buttons + 1 new list-mode
# Link), proving nothing was duplicated and the steppers weren't altered.
set -euo pipefail

FILE="components/tickets/TicketTypeCard.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

TOKEN_SET="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
COUNT="$(grep -c -F "$TOKEN_SET" "$FILE")"

if [ "$COUNT" -ne 3 ]; then
  echo "FAIL: expected 3 occurrences of the focus-visible ring token set, found $COUNT"
  exit 1
fi

echo "PASS: focus-visible ring token set appears exactly 3 times (2 stepper buttons + 1 list Link)"
exit 0

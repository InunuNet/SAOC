#!/usr/bin/env bash
# A1 — the mode==='list' <Link> wrapper in TicketTypeCard.tsx carries all four
# focus-visible ring tokens verbatim, matching the stepper buttons' set exactly.
set -euo pipefail

FILE="components/tickets/TicketTypeCard.tsx"

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE not found"
  exit 1
fi

BLOCK="$(awk '/mode === .list./,/^  }/' "$FILE")"

for token in "focus-visible:outline-none" "focus-visible:ring-2" "focus-visible:ring-ink/40" "focus-visible:ring-offset-2"; do
  if ! echo "$BLOCK" | grep -qF "$token"; then
    echo "FAIL: mode==='list' block missing token: $token"
    exit 1
  fi
done

echo "PASS: mode==='list' Link carries all four focus-visible ring tokens"
exit 0

#!/usr/bin/env bash
# A2 — denylist of specific invented strings (today's non-Lee-Ann page.tsx
# copy, plus the design handoff's own invented About placeholder prose) that
# must not appear anywhere under app/(marketing)/about/ or components/about/
# after the rebuild. A best-effort regression guard, not an exhaustive proof
# — A1 (content-verbatim) plus Brad's own review of localhost:3002/about is
# the real gate for "nothing else invented snuck in." See the golden's §4
# per-slot decision table for why each string here was removed.
set -euo pipefail

FIXTURE=".agent/memory/project/specs/saoc-about-page/goldens/fixtures/f1-banned-invented-strings.txt"
SCAN_PATHS=("app/(marketing)/about" "components/about")

if [ ! -f "$FIXTURE" ]; then
  echo "FAIL: denylist fixture not found at $FIXTURE" >&2
  exit 1
fi

found_any=0
while IFS= read -r needle; do
  [ -z "$needle" ] && continue
  for path in "${SCAN_PATHS[@]}"; do
    if [ -d "$path" ]; then
      if grep -rFl -- "$needle" "$path" 2>/dev/null; then
        echo "FAIL: banned invented string found under $path: \"$needle\"" >&2
        found_any=1
      fi
    fi
  done
done < "$FIXTURE"

if [ "$found_any" -ne 0 ]; then
  exit 1
fi

echo "OK: none of the denylisted invented strings found under ${SCAN_PATHS[*]}"

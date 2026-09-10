#!/usr/bin/env bash
# assert-content-state-single-consumer.sh — A37 (national-show-ia-alignment, M4, F24).
#
# Grep guard on the ShowPageResult boundary, sibling to
# assert-gated-prose-single-consumer.sh — a second layer that does not trust eslint. The
# type brand on ShowPageResult alone enforces nothing; lint plus this guard are what
# make it real, exactly as gated-prose-internal.ts's own header records.
#
# Only components/show/nos/ShowContentState.tsx (opens the result) and
# lib/data/show-pages.ts (constructs one, via the wrap side, never re-exported) may
# import components/show/nos/show-content-state-internal.ts.
set -euo pipefail

ALLOWED_FILES="components/show/nos/ShowContentState.tsx
lib/data/show-pages.ts"

MATCHES=$(grep -rl 'show-content-state-internal' app/ components/ lib/ scripts/ --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' 2>/dev/null \
  | grep -v -F "components/show/nos/show-content-state-internal.ts" || true)

VIOLATIONS=""
while IFS= read -r match; do
  [ -z "$match" ] && continue
  if ! grep -qxF "$match" <<< "$ALLOWED_FILES"; then
    VIOLATIONS="${VIOLATIONS}${match}"$'\n'
  fi
done <<< "$MATCHES"

if [ -n "$VIOLATIONS" ]; then
  echo "A37 FAIL: show-content-state-internal.ts imported outside its two allowed consumers:" >&2
  echo "$VIOLATIONS" >&2
  exit 1
fi

exit 0

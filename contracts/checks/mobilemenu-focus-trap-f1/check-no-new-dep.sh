#!/usr/bin/env bash
# A2 — no focus-trap/radix/headlessui/react-aria dependency was added. Regression
# guard per README "No focus-trap dependency exists" — this feature must hand-roll
# useFocusTrap, not pull in a library.
set -euo pipefail

BANNED_PATTERN='focus-trap|focus-trap-react|@radix-ui|@headlessui|react-aria'

for FILE in package.json pnpm-lock.yaml; do
  if [ ! -f "$FILE" ]; then
    echo "FAIL: $FILE not found"
    exit 1
  fi

  # Only new lines (additions) matter — a pre-existing unrelated match must not fail this.
  ADDED=$(git diff HEAD -- "$FILE" | grep -E '^\+' | grep -viE '^\+\+\+' || true)
  if echo "$ADDED" | grep -qiE "$BANNED_PATTERN"; then
    echo "FAIL: $FILE gained a banned focus-trap dependency:"
    echo "$ADDED" | grep -iE "$BANNED_PATTERN"
    exit 1
  fi
done

# Belt-and-braces: confirm none of the banned packages are present as a direct
# dependency in the current package.json at all.
if grep -qiE '"(focus-trap|focus-trap-react|@radix-ui/[^"]+|@headlessui/[^"]+|react-aria)"[[:space:]]*:' package.json; then
  echo "FAIL: package.json declares a banned focus-trap dependency"
  exit 1
fi

echo "PASS: no focus-trap/radix/headlessui/react-aria dependency added"
exit 0

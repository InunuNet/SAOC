#!/usr/bin/env bash
# A1 — lib/hooks/useFocusTrap.ts exists and components/chrome/MobileMenu.tsx
# imports and calls it.
set -euo pipefail

HOOK_FILE="lib/hooks/useFocusTrap.ts"
MENU_FILE="components/chrome/MobileMenu.tsx"

if [ ! -f "$HOOK_FILE" ]; then
  echo "FAIL: $HOOK_FILE not found"
  exit 1
fi

if ! grep -qE 'export function useFocusTrap' "$HOOK_FILE"; then
  echo "FAIL: $HOOK_FILE does not export a useFocusTrap function"
  exit 1
fi

if [ ! -f "$MENU_FILE" ]; then
  echo "FAIL: $MENU_FILE not found"
  exit 1
fi

if ! grep -qE "import \{ useFocusTrap \} from '@/lib/hooks/useFocusTrap'" "$MENU_FILE"; then
  echo "FAIL: $MENU_FILE does not import useFocusTrap from lib/hooks/useFocusTrap"
  exit 1
fi

if ! grep -qE 'useFocusTrap\(' "$MENU_FILE"; then
  echo "FAIL: $MENU_FILE imports useFocusTrap but never calls it"
  exit 1
fi

echo "PASS: lib/hooks/useFocusTrap.ts exists and is imported+called by MobileMenu.tsx"
exit 0
